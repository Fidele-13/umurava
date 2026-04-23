import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Candidate } from './schemas/candidate.schema';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CandidateParserService } from './parsers/candidate-parser.service';
import { CandidatesService } from './candidates.service';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { ApplicationsService } from '../applications/applications.service';
import { UploadLogsService } from '../upload-logs/upload-logs.service';

type NormalizedJsonUploadPayload = {
  candidates: {
    payload: Partial<CreateCandidateDto>;
    jobExternalIds: string[];
  }[];
};

type UploadedCandidateFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

function isUploadedCandidateFile(
  value: unknown,
): value is UploadedCandidateFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return (
    Buffer.isBuffer(candidate.buffer) &&
    typeof candidate.mimetype === 'string' &&
    typeof candidate.originalname === 'string'
  );
}

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly candidateParserService: CandidateParserService,
    private readonly applicationsService: ApplicationsService,
    private readonly uploadLogsService: UploadLogsService,
  ) {}

  @Post()
  async create(@Body() payload: CreateCandidateDto) {
    const jobExternalIds = this.collectJobExternalIds(payload);
    const candidatePayload = this.stripJobLinkFields(payload);

    const candidate = await this.candidatesService.createOrUpdateSchemaProfile(
      candidatePayload,
      'manual',
      {
        sourceSnapshot: candidatePayload as unknown as Record<string, unknown>,
      },
    );

    if (jobExternalIds.length) {
      await this.candidatesService.linkCandidateToJobs(
        String(candidate._id),
        jobExternalIds,
        'manual',
      );
    }

    return candidate;
  }

  @Get()
  findAll() {
    return this.candidatesService.findAll();
  }

  @Get('with-jobs')
  async findAllWithJobs() {
    const candidates = await this.candidatesService.findAll();

    const enriched = await Promise.all(
      candidates.map(async (candidate) => {
        const applications = await this.applicationsService.findByCandidateId(
          String(candidate._id),
        );

        const appliedJobs = applications.map((application) => {
          const job = this.asRecord(application.jobId as unknown);

          return {
            applicationId: String(application._id),
            jobId: job?.jobId ? String(job.jobId) : null,
            mongoJobId: job?._id ? String(job._id) : String(application.jobId),
            title: job?.title ? String(job.title) : null,
            status: application.status,
            source: application.source,
          };
        });

        return {
          candidate,
          appliedJobIds: appliedJobs
            .map((item) => item.jobId)
            .filter((item): item is string => Boolean(item)),
          applications: appliedJobs,
        };
      }),
    );

    return enriched;
  }

  @Get(':id/with-jobs')
  async findOneWithJobs(@Param('id') id: string) {
    const candidate = await this.candidatesService.findOne(id);
    const applications = await this.applicationsService.findByCandidateId(id);

    const appliedJobs = applications.map((application) => {
      const job = this.asRecord(application.jobId as unknown);

      return {
        applicationId: String(application._id),
        jobId: job?.jobId ? String(job.jobId) : null,
        mongoJobId: job?._id ? String(job._id) : String(application.jobId),
        title: job?.title ? String(job.title) : null,
        status: application.status,
        source: application.source,
      };
    });

    return {
      candidate,
      appliedJobIds: appliedJobs
        .map((item) => item.jobId)
        .filter((item): item is string => Boolean(item)),
      applications: appliedJobs,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOneWithParsedProfile(id);
  }

  @Post('upload/json')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadJson(
    @Body() payload: Record<string, unknown>,
    @Body('jobId') jobId?: string,
    @UploadedFile() _unusedFile?: unknown,
    @UploadedFiles() files?: unknown,
  ) {
    const fileMeta = this.extractUploadMeta(files);
    const normalizedJobId = this.normalizeJobExternalId(jobId) ?? null;

    try {
      const normalizedPayload = this.normalizeJsonUploadPayload(
        payload,
        files,
        jobId,
      );

      const candidates = await Promise.all(
        normalizedPayload.candidates.map(async (entry) => {
          const candidate =
            await this.candidatesService.createOrUpdateSchemaProfile(
              this.stripJobLinkFields(entry.payload),
              'manual',
              {
                sourceSnapshot: entry.payload as unknown as Record<string, unknown>,
              },
            );

          if (entry.jobExternalIds.length) {
            await this.candidatesService.linkCandidateToJobs(
              String(candidate._id),
              entry.jobExternalIds,
              'manual',
            );
          }

          return candidate;
        }),
      );

      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-json',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: candidates.length,
        jobId: normalizedJobId,
        message: `Successfully uploaded ${candidates.length} candidates`,
      });

      return candidates;
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-json',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        jobId: normalizedJobId,
        message: this.resolveErrorMessage(error, 'Candidate JSON upload failed'),
      });

      throw error;
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateCandidateDto) {
    return this.candidatesService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatesService.remove(id);
  }

  @Post(':id/recompute')
  recompute(@Param('id') id: string) {
    return this.candidatesService.recomputeCandidateProfile(id);
  }

  @Post('upload/resume')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(
    @UploadedFile() file?: unknown,
    @Body('jobId') jobId?: string,
  ) {
    const fileMeta = this.extractUploadMeta(file);
    const normalizedJobId = this.normalizeJobExternalId(jobId) ?? null;

    try {
      if (!isUploadedCandidateFile(file)) {
        throw new BadRequestException('File is required');
      }

      const parsed = await this.candidateParserService.parseResumePdf(
        file.buffer,
      );

      const result = await this.candidatesService.createFromParsedResume(
        parsed,
        'resume-pdf',
        {
          jobExternalId: normalizedJobId ?? undefined,
          sourceSnapshot: {
            filename: file.originalname,
            mimeType: file.mimetype,
          },
        },
      );

      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-resume',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: 1,
        jobId: normalizedJobId,
        candidateId: String(result.candidate._id),
        message: `Successfully parsed resume and created candidate: ${result.candidate.firstName} ${result.candidate.lastName}`,
      });

      return result;
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-resume',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        jobId: normalizedJobId,
        message: this.resolveErrorMessage(error, 'Resume upload failed'),
      });

      throw error;
    }
  }

  @Post(':id/reparse')
  @UseInterceptors(FileInterceptor('file'))
  async reparseResume(
    @Param('id') id: string,
    @UploadedFile() file?: unknown,
  ) {
    const fileMeta = this.extractUploadMeta(file);

    try {
      if (!isUploadedCandidateFile(file)) {
        throw new BadRequestException('File is required');
      }

      const parsed = await this.candidateParserService.parseDocument(
        file.buffer,
        file.originalname,
        file.mimetype,
      );

      const parsedProfile = await this.candidatesService.reparse(
        id,
        parsed,
        'resume-pdf',
      );

      await this.uploadLogsService.safeCreateLog({
        type: 'reparse',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: 1,
        candidateId: id,
        message: 'Successfully reparsed candidate document',
      });

      return {
        success: true,
        parsedProfile,
      };
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'reparse',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        candidateId: id,
        message: this.resolveErrorMessage(error, 'Candidate reparse failed'),
      });

      throw error;
    }
  }

  @Post('upload/spreadsheet')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSpreadsheet(
    @UploadedFile() file?: unknown,
    @Body('jobId') jobId?: string,
  ) {
    const fileMeta = this.extractUploadMeta(file);
    const normalizedJobId = this.normalizeJobExternalId(jobId) ?? null;

    try {
      if (!isUploadedCandidateFile(file)) {
        throw new BadRequestException('File is required');
      }

      const isCsv =
        file.mimetype === 'text/csv' ||
        file.originalname.toLowerCase().endsWith('.csv');

      const isXlsx =
        file.mimetype ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.toLowerCase().endsWith('.xlsx') ||
        file.originalname.toLowerCase().endsWith('.xls');

      if (!isCsv && !isXlsx) {
        throw new BadRequestException('Only CSV/XLS/XLSX files are supported');
      }

      const rows = isCsv
        ? this.candidateParserService.parseCsv(file.buffer)
        : this.candidateParserService.parseXlsx(file.buffer);

      const source: Candidate['source'] = isCsv ? 'csv' : 'xlsx';
      const candidates = await this.candidatesService.createMany(
        rows,
        source,
        normalizedJobId ?? undefined,
      );

      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-spreadsheet',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: candidates.length,
        jobId: normalizedJobId,
        message: `Successfully uploaded ${candidates.length} candidates from spreadsheet`,
      });

      return candidates;
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'candidates-spreadsheet',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        jobId: normalizedJobId,
        message: this.resolveErrorMessage(
          error,
          'Candidate spreadsheet upload failed',
        ),
      });

      throw error;
    }
  }

  private normalizeJsonUploadPayload(
    payload: Record<string, unknown>,
    files?: unknown,
    externalJobId?: string,
  ): NormalizedJsonUploadPayload {
    const fromFile = this.tryParseJsonFile(files);
    const data = fromFile ?? payload;
    const defaultJobExternalIds = this.collectJobExternalIds(data, [
      ...this.collectJobExternalIds(payload),
      ...this.normalizeStringArray(externalJobId),
    ]);

    const candidatesInput =
      this.toArray(data.candidates) ?? this.toArray(data.talentProfiles);

    if (!candidatesInput?.length) {
      throw new BadRequestException(
        'Provide a JSON body with candidates[] or talentProfiles[], or upload a JSON file in form-data field "file".',
      );
    }

    const candidates = candidatesInput.map((item) => {
      const candidatePayload = this.mapTalentProfileToCandidate(item);
      const jobExternalIds = this.collectJobExternalIds(item, defaultJobExternalIds);

      return {
        payload: candidatePayload,
        jobExternalIds,
      };
    });

    return {
      candidates,
    };
  }

  private tryParseJsonFile(files?: unknown): Record<string, unknown> | null {
    const candidates = Array.isArray(files) ? files : files ? [files] : [];
    const file = candidates.find((entry) => isUploadedCandidateFile(entry));

    if (!isUploadedCandidateFile(file)) {
      return null;
    }

    const parsed = this.parseJsonWithFallbacks(file.buffer);
    if (!parsed) {
      // Try to provide helpful error context
      const preview = file.buffer.toString('utf-8').substring(0, 200);
      throw new BadRequestException(
        `Invalid JSON file content. Supported formats: JSON object, JSON array, JSON with BOM/comments/trailing commas, or NDJSON. File preview: ${preview}...`,
      );
    }

    return parsed;
  }

  private parseJsonWithFallbacks(buffer: Buffer): Record<string, unknown> | null {
    const candidates: string[] = [];

    // Try UTF-8 with BOM
    candidates.push(this.stripBom(buffer.toString('utf-8')));
    
    // Try UTF-16LE with BOM
    candidates.push(this.stripBom(buffer.toString('utf16le')));
    
    // Try latin1 as fallback
    candidates.push(this.stripBom(buffer.toString('latin1')));
    
    // Try ascii
    candidates.push(this.stripBom(buffer.toString('ascii')));

    for (const text of candidates) {
      const parsed = this.tryParseJsonText(text);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private tryParseJsonText(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    // Attempt 1: Direct JSON parse
    const direct = this.parseJsonCandidate(trimmed);
    if (direct) {
      return direct;
    }

    // Attempt 2: Remove JSONC comments and trailing commas
    const relaxed = trimmed
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
      .replace(/^\s*\/\/.*$/gm, '')       // Remove // comments
      .replace(/,\s*([}\]])/g, '$1')      // Remove trailing commas
      .replace(/,\s*$/gm, '');            // Remove trailing commas at end of lines

    const relaxedParsed = this.parseJsonCandidate(relaxed);
    if (relaxedParsed) {
      return relaxedParsed;
    }

    // Attempt 3: Try NDJSON format (one JSON object per line)
    const ndjsonLines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (ndjsonLines.length > 1 && ndjsonLines.length < 1000) {
      let allValidObjects = true;
      const ndjsonObjects: Record<string, unknown>[] = [];
      
      for (const line of ndjsonLines) {
        try {
          const value = JSON.parse(line) as unknown;
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            allValidObjects = false;
            break;
          }
          ndjsonObjects.push(value as Record<string, unknown>);
        } catch {
          allValidObjects = false;
          break;
        }
      }

      if (allValidObjects && ndjsonObjects.length > 0) {
        return { talentProfiles: ndjsonObjects };
      }
    }

    return null;
  }

  private parseJsonCandidate(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text) as unknown;

      if (Array.isArray(parsed)) {
        const objectItems = parsed.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        );
        return { talentProfiles: objectItems };
      }

      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }

      return null;
    } catch {
      return null;
    }
  }

  private stripBom(text: string): string {
    // Remove UTF-8 BOM
    if (text.charCodeAt(0) === 0xfeff) {
      return text.slice(1);
    }
    // Remove UTF-8 BOM as string
    if (text.startsWith('\ufeff')) {
      return text.slice(1);
    }
    // Remove common BOM patterns
    return text.replace(/^\uFEFF/, '').replace(/^[\x00\x01\x02\x03]/, '');
  }

  private toArray(value: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object',
    );
  }

  private mapTalentProfileToCandidate(
    input: Record<string, unknown>,
  ): Partial<CreateCandidateDto> {
    const basicInfo =
      input.basicInfo && typeof input.basicInfo === 'object'
        ? (input.basicInfo as Record<string, unknown>)
        : {};

    const socialLinks =
      input.socialLinks && typeof input.socialLinks === 'object'
        ? (input.socialLinks as Record<string, unknown>)
        : {};

    return {
      externalCandidateId:
        this.asString(input.externalCandidateId) ??
        this.asString(input.candidateId) ??
        this.asString(input.id) ?? undefined,
      firstName:
        this.asString(input.firstName) ?? this.asString(basicInfo.firstName) ?? 'Unknown',
      lastName:
        this.asString(input.lastName) ?? this.asString(basicInfo.lastName) ?? 'Unknown',
      email:
        this.asString(input.email) ??
        this.asString(basicInfo.email) ??
        'unknown@example.com',
      headline:
        this.asString(input.headline) ??
        this.asString(basicInfo.headline) ??
        'Unknown',
      bio: this.asString(input.bio) ?? this.asString(basicInfo.bio) ?? null,
      location:
        this.asString(input.location) ??
        this.asString(basicInfo.location) ??
        'Unknown',
      skills: (this.toArray(input.skills) ?? []) as unknown as CreateCandidateDto['skills'],
      languages: (this.toArray(input.languages) ?? []) as unknown as CreateCandidateDto['languages'],
      experience: (this.toArray(input.experience) ?? []) as unknown as CreateCandidateDto['experience'],
      education: (this.toArray(input.education) ?? []) as unknown as CreateCandidateDto['education'],
      certifications: (this.toArray(input.certifications) ?? []) as unknown as CreateCandidateDto['certifications'],
      projects: (this.toArray(input.projects) ?? []) as unknown as CreateCandidateDto['projects'],
      availability:
        input.availability && typeof input.availability === 'object'
          ? (input.availability as CreateCandidateDto['availability'])
          : { status: 'Open to Opportunities', type: 'Full-time', startDate: null },
      socialLinks: {
        linkedin: this.asString(socialLinks.linkedin) ?? null,
        github: this.asString(socialLinks.github) ?? null,
        portfolio:
          this.asString(socialLinks.portfolio) ??
          this.asString(socialLinks.twitter) ??
          this.asString(socialLinks.medium) ??
          null,
      },
      jobId: this.asString(input.jobId) ?? undefined,
      appliedJobIds: this.normalizeStringArray(input.appliedJobIds),
    };
  }

  private collectJobExternalIds(
    payload: Record<string, unknown> | Partial<CreateCandidateDto>,
    fallback: string[] = [],
  ) {
    const directJobId = this.asString((payload as Record<string, unknown>).jobId);
    const appliedJobIds = this.normalizeStringArray(
      (payload as Record<string, unknown>).appliedJobIds,
    );

    return [...new Set([...(directJobId ? [directJobId] : []), ...appliedJobIds, ...fallback])];
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.asString(item))
        .filter((item): item is string => Boolean(item));
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private stripJobLinkFields(
    payload: Partial<CreateCandidateDto>,
  ): Partial<CreateCandidateDto> {
    const { jobId: _jobId, appliedJobIds: _appliedJobIds, ...candidatePayload } = payload;
    return candidatePayload;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private normalizeJobExternalId(jobId?: string): string | undefined {
    return this.asString(jobId) ?? undefined;
  }

  private extractUploadMeta(input?: unknown) {
    const files = Array.isArray(input) ? input : input ? [input] : [];
    const file = files.find((entry) => isUploadedCandidateFile(entry));

    if (!isUploadedCandidateFile(file)) {
      return {
        fileName: 'request-body',
        fileSize: 0,
      };
    }

    return {
      fileName: file.originalname,
      fileSize: file.buffer.byteLength,
    };
  }

  private resolveErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }
}
