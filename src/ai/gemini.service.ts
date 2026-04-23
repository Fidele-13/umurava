import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Bottleneck from 'bottleneck';
import { Candidate } from '../candidates/schemas/candidate.schema';
import { Job } from '../jobs/schemas/job.schema';

type CandidateForRanking =
  | Candidate
  | {
      candidateId: string;
      schemaData?: Partial<Candidate>;
      parsedData?: unknown;
      mergedProfile?: Partial<Candidate>;
      confidenceScore?: number;
    };

interface RankedOutput {
  candidateId: string;
  score: number;
  explanation: string;
  strengths: string[];
  concerns: string[];
  scores?: {
    skillScore: number;
    experienceScore: number;
    educationScore: number;
    projectScore: number;
    overallScore: number;
  };
  decision?: 'Selected' | 'Consider' | 'Reject';
  weaknesses?: string[];
  missingRequirements?: string[];
  confidence?: number;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 1000,
  });
  private readonly defaultModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-flash-latest',
    'gemini-pro-latest',
  ] as const;

  constructor(private readonly configService: ConfigService) {}

  async rankCandidates(
    job: Job,
    candidates: CandidateForRanking[],
    topN: number,
    customPrompt?: string,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      return {
        usedGemini: false,
        raw: 'Fallback ranking used because GEMINI_API_KEY is not set.',
        ranked: this.fallbackRank(job, candidates, topN, customPrompt),
      };
    }

    try {
      const ai = new GoogleGenerativeAI(apiKey);

      const prompt = this.buildPrompt(job, candidates, topN, customPrompt);
      const text = await this.generateWithFallbackModels(ai, prompt);
      const parsed = this.parseModelOutput(text, candidates, topN);

      return {
        usedGemini: true,
        raw: text,
        ranked: parsed,
      };
    } catch (error) {
      this.logger.error(
        'Gemini call failed, falling back to local scorer',
        error as Error,
      );
      return {
        usedGemini: false,
        raw: 'Gemini request failed, fallback ranking used.',
        ranked: this.fallbackRank(job, candidates, topN, customPrompt),
      };
    }
  }

  async chat(prompt: string, context?: string) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      return `Fallback assistant response: ${prompt.slice(0, 300)}${context ? `\n\nContext: ${context.slice(0, 400)}` : ''}`;
    }

    const ai = new GoogleGenerativeAI(apiKey);
    return this.generateWithFallbackModels(
      ai,
      `${context ?? ''}\n\nHR prompt: ${prompt}`,
    );
  }

  private buildPrompt(
    job: Job,
    candidates: CandidateForRanking[],
    topN: number,
    customPrompt?: string,
  ) {
    const parsedProfiles = candidates
      .filter(
        (
          candidate,
        ): candidate is Extract<CandidateForRanking, { candidateId: string }> =>
          'candidateId' in candidate,
      )
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        parsedData: candidate.parsedData ?? null,
        mergedProfile: candidate.mergedProfile ?? null,
        confidenceScore: candidate.confidenceScore ?? 0,
      }));

    return `You are an expert AI recruitment assistant.

Your task is to evaluate and rank candidates for a specific job using MULTIPLE DATA SOURCES:

1) JOB DETAILS (source of truth for requirements)
2) CANDIDATE STRUCTURED PROFILE (API / schema data)
3) PARSED RESUME DATA (extracted from documents)
4) HR ADMIN PROMPT (custom evaluation instruction)

You MUST combine ALL sources intelligently.
DO NOT rely on only one source.

INPUT DATA
JOB:
${JSON.stringify(job, null, 2)}

CANDIDATES:
${JSON.stringify(candidates, null, 2)}

PARSED_RESUMES:
${JSON.stringify(parsedProfiles, null, 2)}

HR_PROMPT:
${customPrompt ?? 'None'}

CORE INSTRUCTIONS
- IDENTITY RULE: ALWAYS use candidateId. NEVER use email.
- DATA FUSION: Prefer parsed resume for skills/experience, structured profile for identity/contact.
- EVALUATION: skills, experience, projects, education, certifications, consistency, HR prompt.
- SCORING WEIGHTS: Skills 30%, Experience 25%, Projects 20%, Education 15%, Other 10%.
- QUALITY: no hallucinations, no duplicates, evaluate every candidate in input.

OUTPUT FORMAT (STRICT JSON ONLY)
{
  "jobId": "${job.jobId}",
  "summary": {
    "totalCandidates": number,
    "evaluatedCandidates": number,
    "selectionCriteria": "string"
  },
  "rankings": [
    {
      "candidateId": "string",
      "rank": number,
      "scores": {
        "skillScore": number,
        "experienceScore": number,
        "educationScore": number,
        "projectScore": number,
        "overallScore": number
      },
      "decision": "Selected | Consider | Reject",
      "explanation": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "missingRequirements": ["string"],
      "confidence": number
    }
  ],
  "topCandidates": [
    {
      "candidateId": "string",
      "rank": number,
      "overallScore": number,
      "summary": "string"
    }
  ]
}

Ensure rankings are sorted by overallScore DESC and rank starts at 1.
Return valid JSON only.`;
  }

  private parseModelOutput(
    text: string,
    candidates: CandidateForRanking[],
    topN: number,
  ): RankedOutput[] {
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as {
        rankings?: Array<{
          candidateId?: string;
          rank?: number;
          scores?: Partial<RankedOutput['scores']>;
          decision?: string;
          explanation?: string;
          strengths?: unknown[];
          weaknesses?: unknown[];
          missingRequirements?: unknown[];
          confidence?: number;
        }>;
        ranked?: Array<Partial<RankedOutput>>;
      };
      const candidateIds = new Set(
        candidates
          .filter(
            (
              candidate,
            ): candidate is Extract<CandidateForRanking, { candidateId: string }> =>
              'candidateId' in candidate,
          )
          .map((candidate) => candidate.candidateId),
      );

      const normalizeStringArray = (value: unknown): string[] =>
        Array.isArray(value)
          ? value.filter((item): item is string => typeof item === 'string')
          : [];

      const fromRankings: RankedOutput[] = [];
      for (const item of parsed.rankings ?? []) {
          if (!item.candidateId || !candidateIds.has(item.candidateId)) {
            continue;
          }

          const scores = {
            skillScore:
              typeof item.scores?.skillScore === 'number'
                ? item.scores.skillScore
                : 0,
            experienceScore:
              typeof item.scores?.experienceScore === 'number'
                ? item.scores.experienceScore
                : 0,
            educationScore:
              typeof item.scores?.educationScore === 'number'
                ? item.scores.educationScore
                : 0,
            projectScore:
              typeof item.scores?.projectScore === 'number'
                ? item.scores.projectScore
                : 0,
            overallScore:
              typeof item.scores?.overallScore === 'number'
                ? item.scores.overallScore
                : 0,
          };

          const decision: RankedOutput['decision'] =
            item.decision === 'Selected' ||
            item.decision === 'Consider' ||
            item.decision === 'Reject'
              ? item.decision
              : 'Consider';

          fromRankings.push({
            candidateId: item.candidateId,
            score: scores.overallScore,
            explanation:
              typeof item.explanation === 'string'
                ? item.explanation
                : 'No explanation provided.',
            strengths: normalizeStringArray(item.strengths),
            concerns: normalizeStringArray(item.weaknesses),
            scores,
            decision,
            weaknesses: normalizeStringArray(item.weaknesses),
            missingRequirements: normalizeStringArray(item.missingRequirements),
            confidence:
              typeof item.confidence === 'number'
                ? Math.max(0, Math.min(1, item.confidence))
                : 0,
          });
      }

      const fromLegacyRanked: RankedOutput[] = [];
      for (const item of parsed.ranked ?? []) {
          if (!item.candidateId || !candidateIds.has(item.candidateId)) {
            continue;
          }

          fromLegacyRanked.push({
            candidateId: item.candidateId,
            score: typeof item.score === 'number' ? item.score : 0,
            explanation:
              typeof item.explanation === 'string'
                ? item.explanation
                : 'No explanation provided.',
            strengths: normalizeStringArray(item.strengths),
            concerns: normalizeStringArray(item.concerns),
            scores: {
              skillScore: Math.max(0, Math.min(100, item.score ?? 0)),
              experienceScore: Math.max(0, Math.min(100, item.score ?? 0)),
              educationScore: Math.max(0, Math.min(100, item.score ?? 0)),
              projectScore: Math.max(0, Math.min(100, item.score ?? 0)),
              overallScore: Math.max(0, Math.min(100, item.score ?? 0)),
            },
            decision: 'Consider',
            weaknesses: normalizeStringArray(item.concerns),
            missingRequirements: [],
            confidence: 0,
          });
      }

      const ranked = fromRankings.length ? fromRankings : fromLegacyRanked;

      if (!ranked.length) {
        return this.fallbackRank(
          { preferredSkills: [], requiredSkills: [] } as unknown as Job,
          candidates,
          topN,
        );
      }

      return ranked
        .sort(
          (a, b) =>
            (b.scores?.overallScore ?? b.score) -
            (a.scores?.overallScore ?? a.score),
        )
        .slice(0, topN);
    } catch {
      return this.fallbackRank(
        { preferredSkills: [], requiredSkills: [] } as unknown as Job,
        candidates,
        topN,
      );
    }
  }

  private fallbackRank(
    job: Job,
    candidates: CandidateForRanking[],
    topN: number,
    customPrompt?: string,
  ): RankedOutput[] {
    const custom = (customPrompt ?? '').toLowerCase();

    const scored = candidates.map((candidateInput) => {
      const candidate = this.extractCandidateForFallback(candidateInput);
      let score = 50;
      const strengths: string[] = [];
      const concerns: string[] = [];

      const skillNames = new Set(
        candidate.skills.map((skill) => skill.name.toLowerCase()),
      );

      for (const requiredSkill of job.requiredSkills ?? []) {
        if (skillNames.has(requiredSkill.toLowerCase())) {
          score += 10;
          strengths.push(`Matches required skill: ${requiredSkill}`);
        } else {
          score -= 6;
          concerns.push(`Missing required skill: ${requiredSkill}`);
        }
      }

      for (const preferredSkill of job.preferredSkills ?? []) {
        if (skillNames.has(preferredSkill.toLowerCase())) {
          score += 5;
          strengths.push(`Matches preferred skill: ${preferredSkill}`);
        }
      }

      const totalYears = candidate.skills.reduce(
        (sum, skill) => sum + (skill.yearsOfExperience ?? 0),
        0,
      );
      score += Math.min(20, totalYears);
      strengths.push(`Total skill-years signal: ${totalYears}`);

      if (custom.includes('express') && !custom.includes('nestjs')) {
        const hasExpress = skillNames.has('express');
        const hasNest = skillNames.has('nestjs');

        if (hasExpress) {
          score += 8;
          strengths.push('Custom prompt preference matched: Express');
        }

        if (hasNest && !hasExpress) {
          score -= 5;
          concerns.push('Custom prompt deprioritizes NestJS over Express');
        }
      }

      const decision: RankedOutput['decision'] =
        score >= 75 ? 'Selected' : score >= 55 ? 'Consider' : 'Reject';

      return {
        candidateId:
          'candidateId' in candidateInput
            ? candidateInput.candidateId
            : candidate.email,
        score: Math.max(0, Math.min(100, score)),
        explanation: `Scored using fallback engine with required/preferred skill match, experience signal, and custom HR preference handling.`,
        strengths,
        concerns,
        scores: {
          skillScore: Math.max(0, Math.min(100, score)),
          experienceScore: Math.max(0, Math.min(100, score)),
          educationScore: 50,
          projectScore: 50,
          overallScore: Math.max(0, Math.min(100, score)),
        },
        decision,
        weaknesses: concerns,
        missingRequirements: concerns,
        confidence:
          'confidenceScore' in candidateInput &&
          typeof candidateInput.confidenceScore === 'number'
            ? Math.max(0, Math.min(1, candidateInput.confidenceScore))
            : 0.5,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, topN);
  }

  private extractCandidateForFallback(candidate: CandidateForRanking): Candidate {
    if (!('candidateId' in candidate)) {
      return candidate as Candidate;
    }

    const mergedProfile =
      (candidate.mergedProfile as Partial<Candidate> | undefined) ??
      candidate.schemaData ??
      ({} as Partial<Candidate>);

    return {
      ...mergedProfile,
      email:
        mergedProfile.email ??
        `candidate+${candidate.candidateId}@unknown.local`,
      skills: Array.isArray(mergedProfile.skills) ? mergedProfile.skills : [],
      requiredSkills: [],
      preferredSkills: [],
    } as unknown as Candidate;
  }

  private async scheduleWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (attempt > 1) {
          await this.sleep(1000 * attempt);
        }

        return await this.limiter.schedule(operation);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: number }).status)
            : undefined;

        const isTransientStatus =
          typeof status === 'number' &&
          [429, 500, 502, 503, 504].includes(status);

        if (
          !isTransientStatus &&
          !/429|500|502|503|504|quota|rate limit|service unavailable|high demand|overload|temporar|fetch failed|timed out|econn|enotfound|404/i.test(
            message,
          )
        ) {
          throw error;
        }

        this.logger.warn(`Gemini attempt ${attempt} failed: ${message}`);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Gemini request failed after retries');
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async generateWithFallbackModels(
    ai: GoogleGenerativeAI,
    prompt: string,
  ): Promise<string> {
    let lastError: unknown;
    const configuredPrimaryModel = this.normalizeModelName(
      this.configService.get<string>('GEMINI_MODEL'),
    );
    const configuredFallbackModels = (
      this.configService.get<string>('GEMINI_FALLBACK_MODELS') ?? ''
    )
      .split(',')
      .map((model) => this.normalizeModelName(model))
      .filter((model): model is string => Boolean(model));

    const preferredModels = [
      ...(configuredPrimaryModel ? [configuredPrimaryModel] : []),
      ...configuredFallbackModels,
      ...this.defaultModels,
    ].filter((model, index, allModels) => allModels.indexOf(model) === index);

    for (const modelName of preferredModels) {
      try {
        const model = ai.getGenerativeModel({ model: modelName });
        const response = await this.scheduleWithRetry(() =>
          model.generateContent(prompt),
        );
        return response.response.text();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: number }).status)
            : undefined;

        const isRecoverableStatus =
          typeof status === 'number' &&
          [404, 429, 500, 502, 503, 504].includes(status);

        if (
          isRecoverableStatus ||
          /404|429|500|502|503|504|not found|not supported|service unavailable|high demand|overload|temporar|fetch failed|network|timed out|econn|enotfound/i.test(
            message,
          )
        ) {
          this.logger.warn(`Gemini model ${modelName} unavailable: ${message}`);
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('No supported Gemini model available');
  }

  private normalizeModelName(modelName?: string | null): string | undefined {
    if (!modelName) {
      return undefined;
    }

    const cleaned = modelName.trim();

    if (!cleaned) {
      return undefined;
    }

    return cleaned.replace(/^models\//i, '');
  }
}
