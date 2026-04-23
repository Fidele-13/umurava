import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CandidateDocument = HydratedDocument<Candidate>;

@Schema({ _id: false })
export class Skill {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  })
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

  @Prop({ required: true, min: 0 })
  yearsOfExperience: number;
}

export const SkillSchema = SchemaFactory.createForClass(Skill);

@Schema({ _id: false })
export class SpokenLanguage {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    enum: ['Basic', 'Conversational', 'Fluent', 'Native'],
  })
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
}

export const SpokenLanguageSchema =
  SchemaFactory.createForClass(SpokenLanguage);

@Schema({ _id: false })
export class Experience {
  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  role: string;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ default: false })
  isCurrent: boolean;
}

export const ExperienceSchema = SchemaFactory.createForClass(Experience);

@Schema({ _id: false })
export class Education {
  @Prop({ required: true })
  institution: string;

  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  fieldOfStudy: string;

  @Prop({ required: true })
  startYear: number;

  @Prop({ required: true })
  endYear: number;
}

export const EducationSchema = SchemaFactory.createForClass(Education);

@Schema({ _id: false })
export class Certification {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  issuer: string;

  @Prop({ required: true })
  issueDate: string;
}

export const CertificationSchema = SchemaFactory.createForClass(Certification);

@Schema({ _id: false })
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 'Project record inferred from the source document.' })
  description: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ required: true, default: 'Contributor' })
  role: string;

  @Prop({ type: String, default: null })
  link: string | null;

  @Prop({ type: String, default: null })
  startDate: string | null;

  @Prop({ type: String, default: null })
  endDate: string | null;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

@Schema({ _id: false })
export class Availability {
  @Prop({
    required: true,
    enum: ['Available', 'Open to Opportunities', 'Not Available'],
  })
  status: 'Available' | 'Open to Opportunities' | 'Not Available';

  @Prop({ required: true, enum: ['Full-time', 'Part-time', 'Contract'] })
  type: 'Full-time' | 'Part-time' | 'Contract';

  @Prop({ type: String, default: null })
  startDate: string | null;
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);

@Schema({ _id: false })
export class SocialLinks {
  @Prop({ type: String, default: null })
  linkedin: string | null;

  @Prop({ type: String, default: null })
  github: string | null;

  @Prop({ type: String, default: null })
  portfolio: string | null;
}

export const SocialLinksSchema = SchemaFactory.createForClass(SocialLinks);

@Schema({ timestamps: true, versionKey: false })
export class Candidate {
  @Prop({ type: String, index: true, unique: true, sparse: true })
  externalCandidateId?: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  headline: string;

  @Prop({ type: String, default: null })
  bio: string | null;

  @Prop({ required: true })
  location: string;

  @Prop({ type: [SkillSchema], default: [], required: true })
  skills: Skill[];

  @Prop({ type: [SpokenLanguageSchema], default: [] })
  languages: SpokenLanguage[];

  @Prop({ type: [ExperienceSchema], default: [], required: true })
  experience: Experience[];

  @Prop({ type: [EducationSchema], default: [], required: true })
  education: Education[];

  @Prop({ type: [CertificationSchema], default: [] })
  certifications: Certification[];

  @Prop({ type: [ProjectSchema], default: [], required: true })
  projects: Project[];

  @Prop({ type: AvailabilitySchema, required: true })
  availability: Availability;

  @Prop({
    type: SocialLinksSchema,
    default: { linkedin: null, github: null, portfolio: null },
  })
  socialLinks: SocialLinks;

  @Prop({
    default: 'manual',
    enum: ['manual', 'resume-pdf', 'csv', 'xlsx', 'external-api'],
  })
  source: 'manual' | 'resume-pdf' | 'csv' | 'xlsx' | 'external-api';
}

export const CandidateSchema = SchemaFactory.createForClass(Candidate);
