import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UploadLog,
  UploadLogDocument,
  UploadLogStatus,
  UploadLogType,
} from './schemas/upload-log.schema';

type CreateUploadLogInput = {
  type: UploadLogType;
  fileName: string;
  fileSize: number;
  status: UploadLogStatus;
  count?: number;
  jobId?: string | null;
  candidateId?: string | null;
  message: string;
};

@Injectable()
export class UploadLogsService {
  private readonly logger = new Logger(UploadLogsService.name);

  constructor(
    @InjectModel(UploadLog.name)
    private readonly uploadLogModel: Model<UploadLogDocument>,
  ) {}

  async createLog(input: CreateUploadLogInput) {
    return this.uploadLogModel.create({
      ...input,
      count: Math.max(0, input.count ?? 0),
      jobId: input.jobId ?? null,
      candidateId: input.candidateId ?? null,
    });
  }

  async safeCreateLog(input: CreateUploadLogInput) {
    try {
      await this.createLog(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist upload log: ${message}`);
    }
  }

  async getHistory() {
    const items = await this.uploadLogModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return items.map((item) => ({
      id: String(item._id),
      type: item.type,
      fileName: item.fileName,
      fileSize: item.fileSize,
      status: item.status,
      count: item.count ?? 0,
      jobId: item.jobId ?? null,
      candidateId: item.candidateId ?? null,
      message: item.message,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async getStats() {
    const items = await this.uploadLogModel.find().lean().exec();

    const uploadsByType: Record<string, number> = {};
    let successfulUploads = 0;
    let failedUploads = 0;
    let totalCandidatesAdded = 0;
    let totalJobsAdded = 0;

    for (const item of items) {
      uploadsByType[item.type] = (uploadsByType[item.type] ?? 0) + 1;

      if (item.status === 'success') {
        successfulUploads += 1;
      } else {
        failedUploads += 1;
      }

      if (item.status !== 'success') {
        continue;
      }

      if (
        item.type === 'candidates-json' ||
        item.type === 'candidates-spreadsheet'
      ) {
        totalCandidatesAdded += item.count ?? 0;
      }

      if (item.type === 'jobs-json' || item.type === 'jobs-spreadsheet') {
        totalJobsAdded += item.count ?? 0;
      }

      if (item.type === 'candidates-resume') {
        totalCandidatesAdded += Math.max(1, item.count ?? 0);
      }
    }

    const uploadsOverTime = this.buildUploadsOverTime(items);

    return {
      totalUploads: items.length,
      successfulUploads,
      failedUploads,
      totalCandidatesAdded,
      totalJobsAdded,
      uploadsByType,
      uploadsOverTime,
    };
  }

  private buildUploadsOverTime(items: Array<{ createdAt?: Date }>) {
    const countsByDate = new Map<string, number>();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - offset);
      countsByDate.set(this.toDateKey(date), 0);
    }

    for (const item of items) {
      if (!item.createdAt) {
        continue;
      }

      const key = this.toDateKey(new Date(item.createdAt));
      if (!countsByDate.has(key)) {
        continue;
      }
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }

    return [...countsByDate.entries()].map(([date, count]) => ({
      date,
      count,
    }));
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
