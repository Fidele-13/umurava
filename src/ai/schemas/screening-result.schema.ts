import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScreeningResultDocument = HydratedDocument<ScreeningResult>;

@Schema({ _id: false })
export class CandidateScores {
  @Prop({ min: 0, max: 100, default: 0 })
  skillScore: number;

  @Prop({ min: 0, max: 100, default: 0 })
  experienceScore: number;

  @Prop({ min: 0, max: 100, default: 0 })
  educationScore: number;

  @Prop({ min: 0, max: 100, default: 0 })
  projectScore: number;

  @Prop({ min: 0, max: 100, default: 0 })
  overallScore: number;
}

export const CandidateScoresSchema =
  SchemaFactory.createForClass(CandidateScores);

@Schema({ _id: false })
export class RankedCandidate {
  @Prop({ type: Types.ObjectId, ref: 'Candidate', required: true })
  candidateId: Types.ObjectId;

  @Prop({ required: true })
  rank: number;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ required: true })
  explanation: string;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  concerns: string[];

  @Prop({ type: CandidateScoresSchema, default: null })
  scores?: CandidateScores | null;

  @Prop({ enum: ['Selected', 'Consider', 'Reject'], default: 'Consider' })
  decision: 'Selected' | 'Consider' | 'Reject';

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  @Prop({ type: [String], default: [] })
  missingRequirements: string[];

  @Prop({ min: 0, max: 1, default: 0 })
  confidence: number;
}

export const RankedCandidateSchema =
  SchemaFactory.createForClass(RankedCandidate);

@Schema({ timestamps: true, versionKey: false })
export class ScreeningResult {
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true, index: true })
  jobId: Types.ObjectId;

  @Prop({ required: true })
  jobExternalId: string;

  @Prop({ default: 5 })
  topN: number;

  @Prop({ default: '' })
  customPrompt: string;

  @Prop({ type: [RankedCandidateSchema], default: [] })
  rankedCandidates: RankedCandidate[];

  @Prop({ default: false })
  usedGemini: boolean;

  @Prop()
  rawModelOutput?: string;
}

export const ScreeningResultSchema =
  SchemaFactory.createForClass(ScreeningResult);
