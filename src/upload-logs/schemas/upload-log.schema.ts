import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UploadLogDocument = HydratedDocument<UploadLog>;

export const UPLOAD_LOG_TYPES = [
  'candidates-json',
  'candidates-spreadsheet',
  'candidates-resume',
  'jobs-json',
  'jobs-spreadsheet',
  'reparse',
] as const;

export const UPLOAD_LOG_STATUSES = ['success', 'failed'] as const;

export type UploadLogType = (typeof UPLOAD_LOG_TYPES)[number];
export type UploadLogStatus = (typeof UPLOAD_LOG_STATUSES)[number];

@Schema({ timestamps: true, versionKey: false })
export class UploadLog {
  @Prop({ required: true, enum: UPLOAD_LOG_TYPES, index: true })
  type: UploadLogType;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true, min: 0 })
  fileSize: number;

  @Prop({ required: true, enum: UPLOAD_LOG_STATUSES, index: true })
  status: UploadLogStatus;

  @Prop({ default: 0, min: 0 })
  count: number;

  @Prop({ type: String, default: null, index: true })
  jobId: string | null;

  @Prop({ type: String, default: null, index: true })
  candidateId: string | null;

  @Prop({ required: true })
  message: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const UploadLogSchema = SchemaFactory.createForClass(UploadLog);
