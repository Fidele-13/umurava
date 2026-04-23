import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  JobApplication,
  JobApplicationDocument,
} from '../applications/schemas/job-application.schema';
import { ChatService } from '../chat/chat.service';
import {
  Candidate,
  CandidateDocument,
} from '../candidates/schemas/candidate.schema';
import {
  CandidateParsedProfile,
  CandidateParsedProfileDocument,
} from '../candidates/schemas/candidate-parsed-profile.schema';
import { Job, JobDocument } from '../jobs/schemas/job.schema';
import {
  ScreeningResult,
  ScreeningResultDocument,
} from './schemas/screening-result.schema';
import { GeminiService } from './gemini.service';

@Injectable()
export class AiService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectModel(JobApplication.name)
    private readonly jobApplicationModel: Model<JobApplicationDocument>,
    @InjectModel(Candidate.name)
    private readonly candidateModel: Model<CandidateDocument>,
    @InjectModel(CandidateParsedProfile.name)
    private readonly parsedProfileModel: Model<CandidateParsedProfileDocument>,
    @InjectModel(ScreeningResult.name)
    private readonly screeningResultModel: Model<ScreeningResultDocument>,
    private readonly geminiService: GeminiService,
    private readonly chatService: ChatService,
  ) {}

  private readonly screeningPopulatePaths: string[] = [
    'jobId',
    'rankedCandidates.candidateId',
  ];

  async rankCandidates(input: {
    jobId: string;
    topN?: number;
    customPrompt?: string;
    candidateIds?: string[];
  }) {
    const job = await this.jobModel.findOne({ jobId: input.jobId }).exec();

    if (!job) {
      throw new NotFoundException(`Job ${input.jobId} not found`);
    }

    const topN = input.topN ?? 5;

    let candidates = input.candidateIds?.length
      ? await this.candidateModel
          .find({ _id: { $in: input.candidateIds } })
          .exec()
      : [];

    if (!candidates.length) {
      const applications = await this.jobApplicationModel
        .find({ jobId: job._id })
        .exec();

      if (applications.length) {
        const candidateIds = applications.map((application) =>
          String(application.candidateId),
        );
        candidates = await this.candidateModel
          .find({ _id: { $in: candidateIds } })
          .exec();
      }
    }

    if (!candidates.length) {
      candidates = await this.candidateModel.find().exec();
    }

    const parsedProfiles = await this.parsedProfileModel
      .find({ candidateId: { $in: candidates.map((candidate) => candidate._id) } })
      .exec();

    const parsedByCandidateId = new Map(
      parsedProfiles.map((profile) => [String(profile.candidateId), profile]),
    );

    const candidateContext = candidates.map((candidate) => {
      const parsedProfile = parsedByCandidateId.get(String(candidate._id));

      return {
        candidateId: String(candidate._id),
        schemaData: candidate.toObject(),
        parsedData: parsedProfile?.parsedData ?? null,
        mergedProfile: parsedProfile?.mergedProfile ?? candidate.toObject(),
        confidenceScore: parsedProfile?.confidenceScore ?? 0,
      };
    });

    const result = await this.geminiService.rankCandidates(
      job,
      candidateContext,
      topN,
      input.customPrompt,
    );

    const rankedCandidates = result.ranked
      .map((ranked) => {
        const candidate = candidates.find(
          (item) => String(item._id) === ranked.candidateId,
        );
        if (!candidate) {
          return null;
        }

        return {
          candidateId: candidate._id,
          rank: 0,
          score: ranked.score,
          explanation: ranked.explanation,
          strengths: ranked.strengths,
          concerns: ranked.concerns,
          scores: ranked.scores ?? null,
          decision: ranked.decision ?? 'Consider',
          weaknesses: ranked.weaknesses ?? ranked.concerns,
          missingRequirements: ranked.missingRequirements ?? [],
          confidence: ranked.confidence ?? 0,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

    const saved = await this.screeningResultModel.create({
      jobId: job._id,
      jobExternalId: job.jobId,
      topN,
      customPrompt: input.customPrompt ?? '',
      rankedCandidates,
      usedGemini: result.usedGemini,
      rawModelOutput: result.raw,
    });

    const populated = await this.screeningResultModel
      .findById(saved._id)
      .populate(this.screeningPopulatePaths)
      .exec();

    return populated ?? saved;
  }

  async chat(input: { sessionId?: string; jobId?: string; prompt: string }) {
    let jobContext = input.jobId
      ? await this.jobModel.findOne({ jobId: input.jobId }).lean().exec()
      : null;

    if (!jobContext && input.jobId && Types.ObjectId.isValid(input.jobId)) {
      jobContext = await this.jobModel.findById(input.jobId).lean().exec();
    }

    let applicantsContext: Array<{
      candidateId: string;
      applicationStatus: JobApplication['status'];
      applicationSource: JobApplication['source'];
      schemaData: Candidate;
      parsedData: unknown;
      mergedProfile: unknown;
      confidenceScore: number;
    }> = [];

    if (jobContext) {
      const applications = await this.jobApplicationModel
        .find({ jobId: jobContext._id })
        .lean()
        .exec();

      const candidateIds = applications.map((application) => application.candidateId);

      if (candidateIds.length) {
        const [candidates, parsedProfiles] = await Promise.all([
          this.candidateModel.find({ _id: { $in: candidateIds } }).lean().exec(),
          this.parsedProfileModel
            .find({ candidateId: { $in: candidateIds } })
            .lean()
            .exec(),
        ]);

        const candidatesById = new Map(
          candidates.map((candidate) => [String(candidate._id), candidate]),
        );
        const parsedByCandidateId = new Map(
          parsedProfiles.map((profile) => [String(profile.candidateId), profile]),
        );

        applicantsContext = applications
          .map((application) => {
            const candidateId = String(application.candidateId);
            const candidate = candidatesById.get(candidateId);

            if (!candidate) {
              return null;
            }

            const parsedProfile = parsedByCandidateId.get(candidateId);

            return {
              candidateId,
              applicationStatus: application.status,
              applicationSource: application.source,
              schemaData: candidate,
              parsedData: parsedProfile?.parsedData ?? null,
              mergedProfile: parsedProfile?.mergedProfile ?? candidate,
              confidenceScore: parsedProfile?.confidenceScore ?? 0,
            };
          })
          .filter((value): value is NonNullable<typeof value> => Boolean(value));
      }
    }

    const resolvedJobExternalId = jobContext?.jobId ?? input.jobId;

    const hrSession = await this.chatService.appendMessage({
      sessionId: input.sessionId,
      jobId: jobContext ? String(jobContext._id) : undefined,
      jobExternalId: resolvedJobExternalId,
      role: 'hr',
      content: input.prompt,
    });

    const context = jobContext
      ? `You are assisting HR for one selected job.

JOB_CONTEXT:
${JSON.stringify(jobContext, null, 2)}

APPLICANTS_CONTEXT:
${JSON.stringify(
  {
    totalApplicants: applicantsContext.length,
    applicants: applicantsContext,
  },
  null,
  2,
)}

INSTRUCTION:
- If the user asks for the best candidate for this job, evaluate ONLY applicants in APPLICANTS_CONTEXT.
- If APPLICANTS_CONTEXT is empty, explicitly say no applicants were found for this job and ask to ingest/apply candidates.`
      : undefined;

    const answer = await this.geminiService.chat(input.prompt, context);

    const updatedSession = await this.chatService.appendMessage({
      sessionId: hrSession.sessionId,
      jobId: jobContext ? String(jobContext._id) : undefined,
      jobExternalId: resolvedJobExternalId,
      role: 'assistant',
      content: answer,
    });

    return {
      sessionId: updatedSession.sessionId,
      answer,
      messages: updatedSession.messages,
    };
  }

  getChatHistory(sessionId: string) {
    return this.chatService.getSession(sessionId);
  }

  getScreenings() {
    return this.screeningResultModel
      .find()
      .populate(this.screeningPopulatePaths)
      .sort({ createdAt: -1 })
      .exec();
  }
}
