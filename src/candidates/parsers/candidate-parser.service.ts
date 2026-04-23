import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { createHash } from 'node:crypto';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';
import {
  TalentProfile,
  normalizeTalentProfile,
} from '../dto/talent-profile.dto';
import {
  ResumeParseCache,
  ResumeParseCacheDocument,
} from '../schemas/resume-parse-cache.schema';

type ParsedFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

type ExtractionPass = {
  name: string;
  fields: Array<keyof TalentProfile>;
  instructions: string;
};

@Injectable()
export class CandidateParserService {
  private readonly logger = new Logger(CandidateParserService.name);
  private readonly geminiAI?: GoogleGenerativeAI;
  private readonly geminiModels = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-lite',
  ] as const;
  private readonly extractionPasses: ExtractionPass[] = [
    {
      name: 'identity',
      fields: [
        'firstName',
        'lastName',
        'email',
        'headline',
        'bio',
        'location',
        'socialLinks',
      ],
      instructions:
        'Extract only explicit identity/contact data. Do not infer missing values.',
    },
    {
      name: 'skills',
      fields: ['skills', 'languages'],
      instructions:
        'Extract only skills and languages explicitly written in the resume. Do not infer from titles, tools, responsibilities, or domain context. Default skill level to "Intermediate" when unspecified.',
    },
    {
      name: 'experience',
      fields: ['experience', 'projects'],
      instructions:
        'Extract only explicit job and project entries. Do not create roles, companies, dates, descriptions, or technologies when absent.',
    },
    {
      name: 'education',
      fields: ['education', 'certifications', 'availability'],
      instructions:
        'Extract only explicit education, certifications, and availability. If availability is absent, omit it.',
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ResumeParseCache.name)
    private readonly resumeParseCacheModel: Model<ResumeParseCacheDocument>,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.geminiAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async parseDocument(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<TalentProfile> {
    const cacheKey = this.buildCacheKey(fileBuffer, filename, mimeType);
    const cached = await this.resumeParseCacheModel.findOne({ cacheKey }).exec();

    if (cached) {
      return normalizeTalentProfile(cached.parsedData as Partial<TalentProfile>);
    }

    const text = await this.extractText(fileBuffer, filename, mimeType);
    if (!text.trim()) {
      throw new BadRequestException(
        'No text could be extracted from the document',
      );
    }

    const fallbackBasicOnly = this.parseWithFallback(text);
    const deterministicProfile = this.parseDeterministic(text, fallbackBasicOnly);

    if (!this.geminiAI) {
      await this.resumeParseCacheModel.create({
        cacheKey,
        fileHash: this.hashBuffer(fileBuffer),
        filename,
        mimeType,
        parsedData: deterministicProfile,
        fallbackData: fallbackBasicOnly,
        parserVersion: 'v1',
      });
      return deterministicProfile;
    }

    try {
      const aiResult = await this.parseWithGemini(text, fallbackBasicOnly);
      const merged = this.mergeProfiles(deterministicProfile, aiResult);

      await this.resumeParseCacheModel.create({
        cacheKey,
        fileHash: this.hashBuffer(fileBuffer),
        filename,
        mimeType,
        parsedData: merged,
        fallbackData: fallbackBasicOnly,
        parserVersion: 'v1',
      });

      return merged;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown parsing error';
      const logMethod = /fetch failed|network|timed out|econn|enotfound|429|quota|rate limit/i.test(
        message,
      )
        ? 'warn'
        : 'error';
      this.logger[logMethod](
        `Gemini parsing failed, using deterministic parser: ${message}`,
      );
      await this.resumeParseCacheModel.create({
        cacheKey,
        fileHash: this.hashBuffer(fileBuffer),
        filename,
        mimeType,
        parsedData: deterministicProfile,
        fallbackData: fallbackBasicOnly,
        parserVersion: 'v1',
      });
      return deterministicProfile;
    }
  }

  async parseResumePdf(fileBuffer: Buffer): Promise<TalentProfile> {
    return this.parseDocument(fileBuffer, 'resume.pdf', 'application/pdf');
  }

  parseCsv(fileBuffer: Buffer): TalentProfile[] {
    const rows = parseCsvSync(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    }) as Record<string, unknown>[];

    return rows.map((row) => normalizeTalentProfile(this.mapRowToProfile(row)));
  }

  parseXlsx(fileBuffer: Buffer): TalentProfile[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const profiles: TalentProfile[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });
      profiles.push(
        ...rows.map((row) => normalizeTalentProfile(this.mapRowToProfile(row))),
      );
    }

    return profiles;
  }

  async parseMultipleDocuments(files: ParsedFile[]): Promise<TalentProfile[]> {
    const results = await Promise.allSettled(
      files.map((file) =>
        this.parseDocument(file.buffer, file.filename, file.mimeType),
      ),
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<TalentProfile> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);
  }

  private async extractText(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const extension = filename.split('.').pop()?.toLowerCase();

    if (mimeType === 'application/pdf' || extension === 'pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        const pdfData = await parser.getText();
        return pdfData.text;
      } finally {
        await parser.destroy();
      }
    }

    if (
      mimeType.includes('spreadsheet') ||
      extension === 'xlsx' ||
      extension === 'xls'
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      return workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return JSON.stringify(rows);
      }).join('\n');
    }

    if (mimeType === 'text/csv' || extension === 'csv') {
      const rows = parseCsvSync(buffer, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      });
      return JSON.stringify(rows);
    }

    if (
      mimeType.includes('word') ||
      extension === 'docx' ||
      extension === 'doc'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mimeType === 'text/plain' || extension === 'txt') {
      return buffer.toString('utf-8');
    }

    throw new BadRequestException(`Unsupported file type: ${mimeType}`);
  }

  private async parseWithGemini(
    text: string,
    fallback: TalentProfile,
  ): Promise<TalentProfile> {
    const chunks = this.chunkText(text, 8000, 500);
    const merged: Partial<TalentProfile> = {};

    for (const pass of this.extractionPasses) {
      const passResult: Record<string, unknown> = {};

      for (const chunk of chunks) {
        const prompt = this.buildPassPrompt(pass, chunk, fallback);
        const content = await this.generateGeminiContent(prompt);
        const parsed = this.safeParseJsonObject(content);
        this.mergeObjects(passResult, parsed);
      }

      this.mergeObjects(merged as Record<string, unknown>, passResult);
    }

    return this.sanitizeAiProfile(merged);
  }

  private buildPassPrompt(
    pass: ExtractionPass,
    chunk: string,
    fallback: TalentProfile,
  ): string {
    return `
You extract resume data into a strict JSON TalentProfile subset.

Return ONLY a JSON object with these fields for this pass: ${pass.fields.join(', ')}

Hard rules:
- Never invent data
- Never infer skills from job titles, responsibilities, industry, or context
- Never create experience, education, certifications, projects, or languages unless explicitly present
- If a field is not explicitly present, omit it or return an empty array / null
- Skill level must be one of: Beginner, Intermediate, Advanced, Expert
- If a skill is explicit but no level is stated, use "Intermediate"
- yearsOfExperience must be 0 when not explicitly known
- Availability must only be included when explicit
- Use exact enum values only
- Output must be valid JSON, no markdown, no commentary

Pass guidance:
${pass.instructions}

Safe fallback context:
${JSON.stringify(fallback)}

Resume text chunk:
${chunk}
`.trim();
  }

  private parseWithFallback(text: string): TalentProfile {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const email = this.extractFirstMatch(
      text,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    );
    const name = this.extractName(lines);

    return normalizeTalentProfile({
      firstName: name.firstName,
      lastName: name.lastName,
      email: email ?? undefined,
      headline: 'Unknown',
      bio: null,
      location: this.extractLocation(text, lines),
      skills: [],
      languages: [],
      experience: [],
      education: [],
      certifications: this.extractCertifications(text),
      projects: [],
      availability: {
        status: 'Open to Opportunities',
        type: 'Full-time',
        startDate: null,
      },
      socialLinks: this.extractLinks(text),
    });
  }

  private parseDeterministic(
    text: string,
    fallbackBasicOnly: TalentProfile,
  ): TalentProfile {
    const summary = this.extractSummary(text);
    const skills = this.extractExplicitSkills(text);
    const experience = this.extractExplicitExperience(text);
    const education = this.extractExplicitEducation(text);
    const certifications = this.extractCertifications(text);
    const languages = this.extractExplicitLanguages(text);

    return normalizeTalentProfile({
      ...fallbackBasicOnly,
      headline: this.extractExplicitHeadline(text, summary),
      bio: summary,
      skills,
      languages,
      experience,
      education,
      certifications,
      projects: [],
    });
  }

  private async generateGeminiContent(prompt: string): Promise<string> {
    let lastError: unknown;

    for (const modelName of this.geminiModels) {
      try {
        const model = this.geminiAI!.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(prompt);
        return response.response.text();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (/404|not found|not supported|fetch failed|network|timed out|econn|enotfound/i.test(message)) {
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

  private mergeProfiles(
    fallbackBasicOnly: TalentProfile,
    aiResult: TalentProfile,
  ): TalentProfile {
    return normalizeTalentProfile({
      ...fallbackBasicOnly,
      ...aiResult,
      skills: aiResult.skills?.length ? aiResult.skills : [],
      languages: aiResult.languages?.length ? aiResult.languages : [],
      experience: aiResult.experience?.length ? aiResult.experience : [],
      education: aiResult.education?.length ? aiResult.education : [],
      certifications: aiResult.certifications?.length
        ? aiResult.certifications
        : fallbackBasicOnly.certifications,
      projects: aiResult.projects?.length ? aiResult.projects : [],
      socialLinks: {
        ...fallbackBasicOnly.socialLinks,
        ...aiResult.socialLinks,
      },
      availability: aiResult.availability ?? fallbackBasicOnly.availability,
    });
  }

  private sanitizeAiProfile(input: Partial<TalentProfile>): TalentProfile {
    const normalized = normalizeTalentProfile(input);

    normalized.skills = this.dedupeByName(
      normalized.skills,
      (item) => item.name,
    );
    normalized.languages = this.dedupeByName(
      normalized.languages,
      (item) => item.name,
    );
    normalized.certifications = this.dedupeByName(
      normalized.certifications,
      (item) => item.name,
    );
    normalized.projects = this.dedupeByName(
      normalized.projects,
      (item) => item.name,
    );
    normalized.education = this.dedupeByName(
      normalized.education,
      (item) => item.institution.toLowerCase(),
    );
    normalized.experience = this.dedupeByName(
      normalized.experience,
      (item) => `${item.company.toLowerCase()}::${item.role.toLowerCase()}`,
    );

    return normalized;
  }

  private extractLinks(text: string): TalentProfile['socialLinks'] {
    const urls = Array.from(
      new Set(
        (
          text.match(
            /\b(?:https?:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]*\)|[^\s<>().,;:!?])?/gi,
          ) ?? []
        ).map((value) => this.normalizeUrl(value)),
      ),
    );

    return {
      linkedin: urls.find((url) => /linkedin\.com/i.test(url)) ?? null,
      github: urls.find((url) => /github\.com/i.test(url)) ?? null,
      portfolio:
        urls.find((url) => !/linkedin\.com|github\.com/i.test(url)) ?? null,
    };
  }

  private extractName(lines: string[]): {
    firstName: string;
    lastName: string;
  } {
    const firstLine = lines[0] ?? '';
    const cleaned = firstLine.replace(/[|/@]/g, ' ').trim();

    if (
      !cleaned ||
      /\d/.test(cleaned) ||
      /@|https?:\/\/|www\.|curriculum vitae|resume|cv/i.test(cleaned)
    ) {
      return { firstName: 'Unknown', lastName: 'Unknown' };
    }

    const parts = cleaned
      .replace(/[^A-Za-z\s'-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length < 2 || parts.length > 4) {
      return { firstName: 'Unknown', lastName: 'Unknown' };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private extractLocation(text: string, lines: string[]): string {
    for (const line of lines.slice(0, 8)) {
      const match = line.match(
        /^(location|based in|address|city|residence)\s*:?\s*(.+)$/i,
      );
      if (match?.[2]) {
        const value = match[2].trim();
        if (value && !/@|https?:\/\/|www\.|\d{4}-\d{2}-\d{2}/i.test(value)) {
          return value;
        }
      }
    }

    return 'Unknown';
  }

  private extractSummary(text: string): string | null {
    const section = this.extractSection(text, [
      'summary',
      'professional summary',
      'profile',
      'about',
    ]);

    if (!section) {
      return null;
    }

    const value = section.replace(/\s+/g, ' ').trim();
    return value ? value.slice(0, 1200) : null;
  }

  private extractExplicitHeadline(
    text: string,
    summary: string | null,
  ): string {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.slice(1, 8)) {
      if (
        line.length < 80 &&
        /[A-Za-z]/.test(line) &&
        !/@|^\+?\d|date of birth|summary|education|experience|skills|certifications/i.test(
          line,
        )
      ) {
        return line;
      }
    }

    if (summary) {
      const firstSentence = summary.split(/[.!?]\s/)[0]?.trim();
      if (firstSentence && firstSentence.length <= 120) {
        return firstSentence;
      }
    }

    return 'Unknown';
  }

  private extractExplicitSkills(text: string): TalentProfile['skills'] {
    const section = this.extractSection(text, [
      'skills',
      'technical skills',
      'skills certifications',
      'skills & certifications',
    ]);

    if (!section) {
      return [];
    }

    const skillNames = new Set<string>();
    const lines = section
      .split(/\r?\n/)
      .map((line) => line.replace(/^[*\-•]\s*/, '').trim())
      .filter(Boolean);

    for (const line of lines) {
      if (
        /^(programming|frameworks|other|blockchain|ai|ml|languages?|certifications?)$/i.test(
          line,
        )
      ) {
        continue;
      }

      const parts = this.extractSkillTokens(line);
      for (const part of parts) {
        skillNames.add(part);
      }
    }

    return Array.from(skillNames).map((name) => ({
      name,
      level: 'Intermediate' as const,
      yearsOfExperience: 0,
    }));
  }

  private extractExplicitLanguages(text: string): TalentProfile['languages'] {
    const section = this.extractSection(text, ['languages']);

    if (!section) {
      return [];
    }

    return section
      .split(/\r?\n|,/)
      .map((line) => line.replace(/^[*\-•]\s*/, '').trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[-–:]/).map((value) => value.trim());
        return {
          name: parts[0],
          proficiency: this.normalizeLanguageProficiency(parts[1]),
        };
      })
      .filter((item) => Boolean(item.name));
  }

  private extractExplicitExperience(text: string): TalentProfile['experience'] {
    const section = this.extractSection(text, [
      'experience',
      'key experience',
      'work experience',
      'professional experience',
      'employment',
    ]);

    if (!section) {
      return [];
    }

    const lines = section
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const experiences: TalentProfile['experience'] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (this.isBulletLine(line) || this.isLikelyDateLine(line)) {
        i += 1;
        continue;
      }

      const next = lines[i + 1];
      if (!next || this.isBulletLine(next)) {
        i += 1;
        continue;
      }

      const roleCompany = this.parseRoleCompanyPair(line, next);
      if (!roleCompany) {
        i += 1;
        continue;
      }

      i += 2;
      const descriptionLines: string[] = [];
      const dateLines: string[] = [];

      while (i < lines.length) {
        const current = lines[i];
        if (!current) {
          i += 1;
          break;
        }

        if (
          i + 1 < lines.length &&
          !this.isBulletLine(current) &&
          !this.isLikelyDateLine(current) &&
          !this.isBulletLine(lines[i + 1])
        ) {
          break;
        }

        if (this.isLikelyDateLine(current)) {
          dateLines.push(current);
        } else if (this.isBulletLine(current)) {
          descriptionLines.push(
            current.replace(/^[*\-•]\s*/, '').replace(/\s+/g, ' ').trim(),
          );
        }

        i += 1;
      }

      const dates = this.extractDateRange(dateLines.join(' '));
      experiences.push({
        company: roleCompany.company,
        role: roleCompany.role,
        startDate: dates.startDate ?? 'Unknown',
        endDate: dates.endDate ?? 'Unknown',
        description: descriptionLines.join(' ').slice(0, 1000),
        technologies: this.extractTechnologiesFromLines(descriptionLines),
        isCurrent: dates.endDate === 'Present',
      });
    }

    return experiences.filter((item) => item.company && item.role);
  }

  private extractExplicitEducation(text: string): TalentProfile['education'] {
    const section = this.extractSection(text, [
      'education',
      'academic background',
      'academic qualifications',
    ]);

    if (!section) {
      return [];
    }

    const lines = section
      .split(/\r?\n/)
      .map((line) => line.replace(/^[*\-•]\s*/, '').trim())
      .filter(Boolean);

    const entries: TalentProfile['education'] = [];
    for (let i = 0; i < lines.length; i += 3) {
      const degree = lines[i];
      const institution = lines[i + 1];
      const fieldOfStudy = lines[i + 2];

      if (!degree || !institution) {
        continue;
      }

      const years = this.extractYearRange(
        [degree, institution, fieldOfStudy].filter(Boolean).join(' '),
      );

      entries.push({
        institution,
        degree,
        fieldOfStudy: fieldOfStudy ?? 'Unknown',
        startYear: years.startYear,
        endYear: years.endYear,
      });
    }

    return entries;
  }

  private extractCertifications(text: string): TalentProfile['certifications'] {
    const section = this.extractSection(text, [
      'certifications',
      'certificates',
      'licenses',
      'license',
    ]);

    if (!section) {
      return [];
    }

    const lines = section
      .split(/\r?\n/)
      .map((line) => line.replace(/^[*\-•]\s*/, '').trim())
      .filter(
        (line) =>
          Boolean(line) &&
          !/^(interests|achievements|interests\s*&\s*achievements)$/i.test(
            line,
          ),
      )
      .slice(0, 10);

    return lines.map((line) => {
      const parts = line
        .split(/\s+[|—–-]\s+|\s+by\s+/i)
        .map((part) => part.trim());
      return {
        name: (parts[0] ?? line).replace(/^[•●]\s*/, '').trim(),
        issuer: parts[1] ?? 'Unknown',
        issueDate: this.extractIssueDate(line) ?? 'Unknown',
      };
    });
  }

  private extractSection(text: string, sectionNames: string[]): string | null {
    const lines = text.split(/\r?\n/);
    let inSection = false;
    const collected: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const normalized = this.normalizeSectionHeading(line);

      if (
        sectionNames.some(
          (name) =>
            normalized === this.normalizeSectionHeading(name) ||
            normalized.startsWith(`${this.normalizeSectionHeading(name)} `),
        )
      ) {
        inSection = true;
        continue;
      }

      if (!inSection) {
        continue;
      }

      if (!line) {
        if (collected.length > 0) {
          break;
        }
        continue;
      }

      if (
        /^(education|experience|key experience|work experience|professional experience|employment|skills|technical skills|projects|certifications|languages|summary|professional summary|profile|about|interests|achievements)\b/i.test(
          normalized,
        )
      ) {
        break;
      }

      collected.push(line);
    }

    return collected.length ? collected.join('\n') : null;
  }

  private mapRowToProfile(row: Record<string, unknown>): Partial<TalentProfile> {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const entry = Object.entries(row).find(
          ([candidateKey]) => candidateKey.toLowerCase() === key.toLowerCase(),
        );
        if (entry && `${entry[1]}`.trim()) {
          return `${entry[1]}`.trim();
        }
      }
      return undefined;
    };

    const firstName = get('firstName', 'first_name', 'firstname');
    const lastName = get('lastName', 'last_name', 'lastname');
    const fullName = get('name', 'fullName', 'full_name');
    const [derivedFirstName, ...derivedLastName] = (fullName ?? '')
      .split(/\s+/)
      .filter(Boolean);

    const skills = (get('skills', 'techStack', 'tech_stack') ?? '')
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        level: 'Intermediate' as const,
        yearsOfExperience: 0,
      }));

    return {
      firstName: firstName ?? derivedFirstName,
      lastName: lastName ?? derivedLastName.join(' '),
      email: get('email'),
      headline: get('headline', 'title', 'role') ?? 'Unknown',
      bio: get('bio', 'summary') ?? null,
      location: get('location', 'city', 'country') ?? 'Unknown',
      skills,
      experience: [],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
      availability: {
        status: 'Open to Opportunities',
        type: 'Full-time',
        startDate: null,
      },
      socialLinks: {
        linkedin: get('linkedin') ?? null,
        github: get('github') ?? null,
        portfolio: get('portfolio', 'website') ?? null,
      },
    };
  }

  private safeParseJsonObject(value: string): Record<string, unknown> {
    const jsonText = this.extractJson(value);
    if (!jsonText) {
      return {};
    }

    try {
      const parsed = JSON.parse(jsonText);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown JSON parse error';
      this.logger.warn(`Unable to parse AI response as JSON: ${message}`);
      return {};
    }
  }

  private extractJson(value: string): string | null {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    return value.slice(start, end + 1);
  }

  private mergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (Array.isArray(value)) {
        const existing = Array.isArray(target[key])
          ? (target[key] as unknown[])
          : [];
        target[key] = this.mergeArrays(existing, value);
        continue;
      }

      if (value && typeof value === 'object') {
        const existing =
          target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
            ? (target[key] as Record<string, unknown>)
            : {};
        target[key] = { ...existing, ...(value as Record<string, unknown>) };
        continue;
      }

      target[key] = value;
    }
  }

  private mergeArrays(existing: unknown[], incoming: unknown[]): unknown[] {
    const merged = [...existing];

    for (const candidate of incoming) {
      const serialized = JSON.stringify(candidate);
      if (!merged.some((item) => JSON.stringify(item) === serialized)) {
        merged.push(candidate);
      }
    }

    return merged;
  }

  private chunkText(text: string, maxLength: number, overlap: number): string[] {
    const normalized = text.replace(/\r/g, '');
    if (normalized.length <= maxLength) {
      return [normalized];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < normalized.length) {
      const sliceEnd = Math.min(cursor + maxLength, normalized.length);
      chunks.push(normalized.slice(cursor, sliceEnd));
      if (sliceEnd === normalized.length) {
        break;
      }
      cursor = Math.max(sliceEnd - overlap, cursor + 1);
    }

    return chunks;
  }

  private buildCacheKey(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
  ): string {
    return `${filename}:${mimeType}:${this.hashBuffer(fileBuffer)}:v1`;
  }

  private hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private extractFirstMatch(text: string, pattern: RegExp): string | null {
    return text.match(pattern)?.[0] ?? null;
  }

  private extractIssueDate(value: string): string | null {
    const explicitYearMonth = value.match(/\b(19|20)\d{2}[-/](0[1-9]|1[0-2])\b/);
    if (explicitYearMonth) {
      return explicitYearMonth[0].replace('/', '-');
    }

    const monthYear = value.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}\b/i,
    );
    if (monthYear) {
      const monthIndex = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
      ].findIndex((month) =>
        month.startsWith(monthYear[1].toLowerCase()),
      );

      if (monthIndex >= 0) {
        return `${monthYear[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
      }
    }

    const yearOnly = value.match(/\b(19|20)\d{2}\b/);
    return yearOnly ? `${yearOnly[0]}-01` : null;
  }

  private normalizeUrl(value: string): string {
    const trimmed = value.trim().replace(/[),.;]+$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  private normalizeSectionHeading(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9&\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&/g, ' ')
      .trim();
  }

  private extractSkillTokens(line: string): string[] {
    const expanded = line.replace(/[()]/g, ',');

    return expanded
      .split(/[,/]| and /i)
      .map((value) => value.trim())
      .filter(
        (value) =>
          Boolean(value) &&
          value.length > 1 &&
          !/^\d{4}/.test(value) &&
          !/^(programming|frameworks|other|blockchain|ai|ml)$/i.test(value),
      );
  }

  private normalizeLanguageProficiency(
    value: string | undefined,
  ): TalentProfile['languages'][number]['proficiency'] {
    if (!value) {
      return 'Conversational';
    }

    const normalized = value.toLowerCase();
    if (normalized.includes('native')) return 'Native';
    if (normalized.includes('fluent')) return 'Fluent';
    if (normalized.includes('basic')) return 'Basic';
    return 'Conversational';
  }

  private isBulletLine(value: string): boolean {
    return /^[*\-•●]/.test(value);
  }

  private isLikelyDateLine(value: string): boolean {
    return /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])\b/.test(value);
  }

  private parseRoleCompanyPair(
    first: string,
    second: string,
  ): { role: string; company: string } | null {
    const left = first.trim();
    const right = second.trim();

    if (!left || !right) {
      return null;
    }

    if (this.looksLikeOrganization(left) && !this.looksLikeOrganization(right)) {
      return { company: left, role: right };
    }

    if (!this.looksLikeOrganization(left) && this.looksLikeOrganization(right)) {
      return { role: left, company: right };
    }

    return { role: left, company: right };
  }

  private looksLikeOrganization(value: string): boolean {
    return /\b(group|company|chamber|ltd|llc|inc|university|college|school|freelance)\b/i.test(
      value,
    ) || /^[A-Z\s.&-]{4,}$/.test(value);
  }

  private extractDateRange(value: string): {
    startDate: string | null;
    endDate: string | null;
  } {
    const matches = value.match(/\b(19|20)\d{2}[-/](0[1-9]|1[0-2])\b/g) ?? [];

    if (!matches.length) {
      return { startDate: null, endDate: null };
    }

    const normalized = matches.map((match) => match.replace('/', '-'));
    const endDate =
      /\b(now|present|current)\b/i.test(value) && normalized.length === 1
        ? 'Present'
        : normalized[1] ?? normalized[0] ?? null;

    return {
      startDate: normalized[0] ?? null,
      endDate,
    };
  }

  private extractTechnologiesFromLines(lines: string[]): string[] {
    const technologies = new Set<string>();

    for (const line of lines) {
      for (const token of this.extractSkillTokens(line)) {
        if (
          /\b(go|django|flask|react|next\.js|sql|postgresql|mongodb|python|javascript|c\+\+|tailwind css|solidity|web3|scikit-learn|tensorflow|pytorch)\b/i.test(
            token,
          )
        ) {
          technologies.add(token);
        }
      }
    }

    return Array.from(technologies);
  }

  private extractYearRange(value: string): {
    startYear: number;
    endYear: number;
  } {
    const years = value.match(/\b(19|20)\d{2}\b/g) ?? [];
    return {
      startYear: years[0] ? Number(years[0]) : 0,
      endYear: years[1] ? Number(years[1]) : 0,
    };
  }

  private dedupeByName<T>(values: T[], selector: (value: T) => string): T[] {
    const seen = new Set<string>();

    return values.filter((value) => {
      const key = selector(value).trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
