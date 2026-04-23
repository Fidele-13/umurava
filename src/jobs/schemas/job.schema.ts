import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

@Schema({ _id: false })
export class JobRole {
  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], default: [] })
  responsibilities: string[];

  @Prop({ type: [String], default: [] })
  education: string[];
}

export const JobRoleSchema = SchemaFactory.createForClass(JobRole);

@Schema({ _id: false })
export class JobRequirements {
  @Prop({ type: [String], default: [] })
  requiredSkills: string[];

  @Prop({ type: [String], default: [] })
  preferredSkills: string[];

  @Prop({ default: 0, min: 0 })
  minYearsExperience: number;
}

export const JobRequirementsSchema =
  SchemaFactory.createForClass(JobRequirements);

@Schema({ _id: false })
export class JobExperience {
  @Prop({ type: [String], default: [] })
  years: string[];

  @Prop({ type: [String], default: [] })
  level: string[];
}

export const JobExperienceSchema = SchemaFactory.createForClass(JobExperience);

@Schema({ _id: false })
export class JobSkill {
  @Prop({ type: [String], default: [] })
  core: string[];

  @Prop({ type: [String], default: [] })
  niceToHave: string[];
}

export const JobSkillSchema = SchemaFactory.createForClass(JobSkill);

@Schema({ timestamps: true, versionKey: false })
export class Job {
  @Prop({ required: true, unique: true, index: true })
  jobId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  department: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: JobRoleSchema, default: undefined })
  role?: JobRole;

  @Prop({ type: JobRequirementsSchema, default: undefined })
  requirements?: JobRequirements;

  @Prop({ type: JobExperienceSchema, default: undefined })
  experience?: JobExperience;

  @Prop({ type: JobSkillSchema, default: undefined })
  skills?: JobSkill;

  @Prop({ type: [String], default: [] })
  requiredSkills: string[];

  @Prop({ type: [String], default: [] })
  preferredSkills: string[];

  @Prop({ default: 0 })
  minYearsExperience: number;

  @Prop({ default: true })
  isOpen: boolean;
}

export const JobSchema = SchemaFactory.createForClass(Job);
