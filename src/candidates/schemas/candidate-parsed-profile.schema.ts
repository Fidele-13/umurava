import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CandidateParsedProfileDocument =
  HydratedDocument<CandidateParsedProfile>;

@Schema({ timestamps: true, versionKey: false })
export class CandidateParsedProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'Candidate',
    required: true,
    unique: true,
    index: true,
  })
  candidateId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  parsedData: unknown;

  @Prop({ type: Object, required: true })
  mergedProfile: unknown;

  @Prop({ min: 0, max: 1, default: 0 })
  confidenceScore: number;

  @Prop({ default: 'resume-pdf' })
  source: string;

  @Prop({ default: '' })
  parserVersion: string;

  @Prop({ default: Date.now })
  parsedAt: Date;
}

export const CandidateParsedProfileSchema =
  SchemaFactory.createForClass(CandidateParsedProfile);
