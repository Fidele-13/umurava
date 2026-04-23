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
import { UploadLogsService } from '../upload-logs/upload-logs.service';
import { CreateJobDto, UpdateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

type UploadedJobFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

function isUploadedJobFile(value: unknown): value is UploadedJobFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;

  return (
    Buffer.isBuffer(file.buffer) &&
    typeof file.mimetype === 'string' &&
    typeof file.originalname === 'string'
  );
}

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly uploadLogsService: UploadLogsService,
  ) {}

  @Post()
  create(@Body() payload: CreateJobDto) {
    return this.jobsService.create(payload as unknown as Record<string, unknown>);
  }

  @Post('upload/json')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadJson(
    @Body() payload: Record<string, unknown>,
    @UploadedFile() _unusedFile?: unknown,
    @UploadedFiles() files?: unknown,
  ) {
    const fileMeta = this.extractUploadMeta(files);

    try {
      const normalized = this.normalizeJsonUploadPayload(payload, files);
      const jobs = await this.jobsService.createMany(normalized.jobs);

      await this.uploadLogsService.safeCreateLog({
        type: 'jobs-json',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: jobs.length,
        message: `Successfully uploaded ${jobs.length} jobs`,
      });

      return jobs;
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'jobs-json',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        message: this.resolveErrorMessage(error, 'Jobs JSON upload failed'),
      });

      throw error;
    }
  }

  @Post('upload/spreadsheet')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSpreadsheet(@UploadedFile() file?: unknown) {
    const fileMeta = this.extractUploadMeta(file);

    try {
      if (!isUploadedJobFile(file)) {
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

      const jobs = this.parseJobsSpreadsheet(file.buffer, isCsv);
      const createdJobs = await this.jobsService.createMany(jobs);

      await this.uploadLogsService.safeCreateLog({
        type: 'jobs-spreadsheet',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'success',
        count: createdJobs.length,
        message: `Successfully uploaded ${createdJobs.length} jobs from spreadsheet`,
      });

      return createdJobs;
    } catch (error) {
      await this.uploadLogsService.safeCreateLog({
        type: 'jobs-spreadsheet',
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        status: 'failed',
        count: 0,
        message: this.resolveErrorMessage(
          error,
          'Jobs spreadsheet upload failed',
        ),
      });

      throw error;
    }
  }

  @Get()
  findAll() {
    return this.jobsService.findAll();
  }

  @Get(':jobId')
  findByJobId(@Param('jobId') jobId: string) {
    return this.jobsService.findByJobId(jobId);
  }

  @Patch(':jobId')
  update(@Param('jobId') jobId: string, @Body() payload: UpdateJobDto) {
    return this.jobsService.updateByJobId(jobId, payload);
  }

  @Delete(':jobId')
  remove(@Param('jobId') jobId: string) {
    return this.jobsService.removeByJobId(jobId);
  }

  private normalizeJsonUploadPayload(
    payload: Record<string, unknown>,
    files?: unknown,
  ): { jobs: Record<string, unknown>[] } {
    const fromFile = this.tryParseJsonFile(files);
    const data = fromFile ?? payload;

    const jobsInput =
      this.toArray(data.jobs) ??
      this.toArray(data.jobProfiles) ??
      this.toArray(data.items);

    if (!jobsInput?.length) {
      throw new BadRequestException(
        'Provide jobs[] or jobProfiles[] in JSON body or upload a JSON file in field "file" or "files".',
      );
    }

    return {
      jobs: jobsInput.map((job) => this.mapJobProfile(job)),
    };
  }

  private tryParseJsonFile(files?: unknown): Record<string, unknown> | null {
    const candidates = Array.isArray(files) ? files : files ? [files] : [];
    const file = candidates.find((entry) => isUploadedJobFile(entry));

    if (!isUploadedJobFile(file)) {
      return null;
    }

    const raw = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    return this.tryParseJsonText(raw) ?? this.tryParseJsonText(file.buffer.toString('utf16le'));
  }

  private tryParseJsonText(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return { jobs: parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') };
      }
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {}

    const relaxed = trimmed
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(relaxed) as unknown;
      if (Array.isArray(parsed)) {
        return { jobs: parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') };
      }
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {}

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      const items: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
          items.push(parsed as Record<string, unknown>);
        } catch {
          return null;
        }
      }

      return { jobs: items };
    }

    return null;
  }

  private toArray(value: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }

  private mapJobProfile(input: Record<string, unknown>): Record<string, unknown> {
    const role = this.pickRecord(input.role);
    const requirements = this.pickRecord(input.requirements);
    const experience = this.pickRecord(input.experience);
    const skills = this.pickRecord(input.skills);

    const requiredSkills = this.ensureStringArray(input.requiredSkills ?? requirements.requiredSkills ?? skills.core);
    const preferredSkills = this.ensureStringArray(input.preferredSkills ?? requirements.preferredSkills ?? skills.niceToHave);

    return {
      jobId: this.asString(input.jobId) ?? this.asString(input.id) ?? undefined,
      title: this.asString(input.title) ?? this.asString(role.title) ?? 'Untitled Job',
      department: this.asString(input.department) ?? 'General',
      location: this.asString(input.location) ?? 'Unknown',
      description: this.asString(input.description) ?? 'No description provided.',
      role: {
        title: this.asString(role.title) ?? this.asString(input.title) ?? 'Untitled Job',
        responsibilities: this.ensureStringArray(role.responsibilities ?? input.responsibilities),
        education: this.ensureStringArray(role.education ?? input.education),
      },
      requirements: {
        requiredSkills,
        preferredSkills,
        minYearsExperience: this.coerceNumber(input.minYearsExperience ?? requirements.minYearsExperience, 0),
      },
      experience: {
        years: this.ensureStringArray(experience.years ?? input.experienceYears),
        level: this.ensureStringArray(experience.level ?? input.experienceLevel),
      },
      skills: {
        core: this.ensureStringArray(skills.core ?? input.skillsCore),
        niceToHave: this.ensureStringArray(skills.niceToHave ?? input.skillsNiceToHave),
      },
      requiredSkills,
      preferredSkills,
      minYearsExperience: this.coerceNumber(input.minYearsExperience ?? requirements.minYearsExperience, 0),
      isOpen: typeof input.isOpen === 'boolean' ? input.isOpen : true,
    };
  }

  private pickRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
    }

    return [];
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private coerceNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return fallback;
  }

  private parseJobsSpreadsheet(buffer: Buffer, isCsv: boolean): Record<string, unknown>[] {
    if (isCsv) {
      const { parse } = require('csv-parse/sync');
      const rows = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      }) as Record<string, unknown>[];

      return rows.map((row) => this.mapJobProfile(row));
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const jobs: Record<string, unknown>[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];
      jobs.push(...rows.map((row) => this.mapJobProfile(row)));
    }

    return jobs;
  }

  private extractUploadMeta(input?: unknown) {
    const files = Array.isArray(input) ? input : input ? [input] : [];
    const file = files.find((entry) => isUploadedJobFile(entry));

    if (!isUploadedJobFile(file)) {
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
