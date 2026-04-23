import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { CreateJobDto, UpdateJobDto } from './dto/create-job.dto';
import { Job, JobDocument } from './schemas/job.schema';

type JobInput = Partial<CreateJobDto> & Record<string, unknown>;

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
  ) {}

  async create(payload: JobInput) {
    const normalized = this.normalizeJobPayload(payload);

    return this.jobModel.create({
      ...normalized,
      jobId: normalized.jobId ?? `JOB-${randomUUID().slice(0, 8).toUpperCase()}`,
    });
  }

  async createMany(payloads: JobInput[]) {
    if (!payloads.length) {
      throw new BadRequestException('At least one job is required');
    }

    const docs = payloads.map((payload) => {
      const normalized = this.normalizeJobPayload(payload);
      return {
        ...normalized,
        jobId:
          normalized.jobId ??
          `JOB-${randomUUID().slice(0, 8).toUpperCase()}`,
      };
    });

    return this.jobModel.insertMany(docs, { ordered: false });
  }

  findAll() {
    return this.jobModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByJobId(jobId: string) {
    const job = await this.jobModel.findOne({ jobId }).exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return job;
  }

  async updateByJobId(jobId: string, payload: UpdateJobDto) {
    const normalized = this.normalizeJobPayload(payload as JobInput);
    const job = await this.jobModel
      .findOneAndUpdate(
        { jobId },
        { $set: normalized },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return job;
  }

  async removeByJobId(jobId: string) {
    const job = await this.jobModel.findOneAndDelete({ jobId }).exec();

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return {
      success: true,
      deletedJobId: jobId,
    };
  }

  private normalizeJobPayload(payload: JobInput) {
    const role = this.pickRecord(payload.role);
    const requirements = this.pickRecord(payload.requirements);
    const experience = this.pickRecord(payload.experience);
    const skills = this.pickRecord(payload.skills);

    const requiredSkills = this.ensureStringArray(
      payload.requiredSkills ?? requirements.requiredSkills,
    );
    const preferredSkills = this.ensureStringArray(
      payload.preferredSkills ?? requirements.preferredSkills,
    );
    const minYearsExperience = this.coerceNumber(
      payload.minYearsExperience ?? requirements.minYearsExperience,
      0,
    );

    return {
      jobId: this.asString(payload.jobId),
      title:
        this.asString(payload.title) ??
        this.asString(role.title) ??
        'Untitled Job',
      department:
        this.asString(payload.department) ??
        this.asString((payload as Record<string, unknown>).department) ??
        'General',
      location:
        this.asString(payload.location) ??
        this.asString((payload as Record<string, unknown>).location) ??
        'Unknown',
      description:
        this.asString(payload.description) ??
        this.asString((payload as Record<string, unknown>).description) ??
        'No description provided.',
      role: {
        title:
          this.asString(role.title) ?? this.asString(payload.title) ?? 'Untitled Job',
        responsibilities: this.ensureStringArray(
          role.responsibilities ?? payload.responsibilities,
        ),
        education: this.ensureStringArray(role.education ?? payload.education),
      },
      requirements: {
        requiredSkills,
        preferredSkills,
        minYearsExperience,
      },
      experience: {
        years: this.ensureStringArray(experience.years ?? payload.experienceYears),
        level: this.ensureStringArray(experience.level ?? payload.experienceLevel),
      },
      skills: {
        core: this.ensureStringArray(skills.core ?? payload.skillsCore),
        niceToHave: this.ensureStringArray(
          skills.niceToHave ?? payload.skillsNiceToHave,
        ),
      },
      requiredSkills,
      preferredSkills,
      minYearsExperience,
      isOpen: typeof payload.isOpen === 'boolean' ? payload.isOpen : true,
    };
  }

  private pickRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);
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
}
