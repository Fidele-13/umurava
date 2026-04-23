import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JobApplicationDocument = HydratedDocument<JobApplication>;

@Schema({ timestamps: true, versionKey: false })
export class JobApplication {
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true, index: true })
  jobId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Candidate', required: true, index: true })
  candidateId: Types.ObjectId;

  @Prop({
    default: 'applied',
    enum: ['applied', 'screened', 'shortlisted', 'rejected'],
  })
  status: 'applied' | 'screened' | 'shortlisted' | 'rejected';

  @Prop({
    default: 'manual',
    enum: [
      'manual',
      'dummy-seed',
      'external-api',
      'csv-upload',
      'resume-upload',
    ],
  })
  source:
    | 'manual'
    | 'dummy-seed'
    | 'external-api'
    | 'csv-upload'
    | 'resume-upload';
}

export const JobApplicationSchema =
  SchemaFactory.createForClass(JobApplication);

JobApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
