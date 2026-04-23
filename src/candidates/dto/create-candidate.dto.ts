import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AVAILABILITY_STATUSES,
  AVAILABILITY_TYPES,
  LANGUAGE_PROFICIENCIES,
  SKILL_LEVELS,
} from './talent-profile.dto';

export class SkillDto {
  @IsString()
  name: string;

  @IsIn(SKILL_LEVELS)
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

  @IsNumber()
  yearsOfExperience: number;
}

export class LanguageDto {
  @IsString()
  name: string;

  @IsIn(LANGUAGE_PROFICIENCIES)
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
}

export class ExperienceDto {
  @IsString()
  company: string;

  @IsString()
  role: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  technologies: string[];

  isCurrent: boolean;
}

export class EducationDto {
  @IsString()
  institution: string;

  @IsString()
  degree: string;

  @IsString()
  fieldOfStudy: string;

  @IsNumber()
  startYear: number;

  @IsNumber()
  endYear: number;
}

export class CertificationDto {
  @IsString()
  name: string;

  @IsString()
  issuer: string;

  @IsString()
  issueDate: string;
}

export class ProjectDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  technologies: string[];

  @IsString()
  role: string;

  @IsString()
  @IsOptional()
  link?: string | null;

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  endDate?: string | null;
}

export class AvailabilityDto {
  @IsIn(AVAILABILITY_STATUSES)
  status: 'Available' | 'Open to Opportunities' | 'Not Available';

  @IsIn(AVAILABILITY_TYPES)
  type: 'Full-time' | 'Part-time' | 'Contract';

  @IsString()
  @IsOptional()
  startDate?: string | null;
}

export class SocialLinksDto {
  @IsString()
  @IsOptional()
  linkedin?: string | null;

  @IsString()
  @IsOptional()
  github?: string | null;

  @IsString()
  @IsOptional()
  portfolio?: string | null;
}

export class CreateCandidateDto {
  @IsString()
  @IsOptional()
  externalCandidateId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  headline: string;

  @IsString()
  @IsOptional()
  bio?: string | null;

  @IsString()
  location: string;

  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  @IsArray()
  skills: SkillDto[];

  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  @IsArray()
  @IsOptional()
  languages?: LanguageDto[];

  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  @IsArray()
  experience: ExperienceDto[];

  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  @IsArray()
  education: EducationDto[];

  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  @IsArray()
  @IsOptional()
  certifications?: CertificationDto[];

  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  @IsArray()
  projects: ProjectDto[];

  @ValidateNested()
  @Type(() => AvailabilityDto)
  availability: AvailabilityDto;

  @ValidateNested()
  @Type(() => SocialLinksDto)
  @IsObject()
  @IsOptional()
  socialLinks?: SocialLinksDto;

  @IsString()
  @IsOptional()
  jobId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  appliedJobIds?: string[];
}
