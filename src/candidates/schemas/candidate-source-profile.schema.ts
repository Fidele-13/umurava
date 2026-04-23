import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CandidateSourceProfileDocument =
  HydratedDocument<CandidateSourceProfile>;

@Schema({ timestamps: true, versionKey: false })
export class CandidateSourceProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'Candidate',
    required: true,
    unique: true,
    index: true,
  })
  candidateId: Types.ObjectId;

  @Prop({ type: String, index: true, sparse: true })
  externalCandidateId?: string;

  @Prop({ type: Object, required: true })
  schemaData: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  normalizedSchemaData: Record<string, unknown>;

  @Prop({ default: 'manual-json' })
  source: string;

  @Prop({ default: 'v1' })
  schemaVersion: string;

  @Prop({ default: Date.now })
  ingestedAt: Date;
}

export const CandidateSourceProfileSchema =
  SchemaFactory.createForClass(CandidateSourceProfile);
