import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResumeParseCacheDocument = HydratedDocument<ResumeParseCache>;

@Schema({ timestamps: true, versionKey: false })
export class ResumeParseCache {
  @Prop({ required: true, unique: true, index: true })
  cacheKey: string;

  @Prop({ required: true })
  fileHash: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, type: Object })
  parsedData: unknown;

  @Prop({ required: true, type: Object })
  fallbackData: unknown;

  @Prop({ default: 'v1' })
  parserVersion: string;
}

export const ResumeParseCacheSchema =
  SchemaFactory.createForClass(ResumeParseCache);
