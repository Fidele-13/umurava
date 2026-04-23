import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  JobExperienceDto,
  JobRequirementsDto,
  JobRoleDto,
  JobSkillDto,
} from './job-structured.dto';

export class CreateJobDto {
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobRoleDto)
  role?: JobRoleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobRequirementsDto)
  requirements?: JobRequirementsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobExperienceDto)
  experience?: JobExperienceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobSkillDto)
  skills?: JobSkillDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minYearsExperience?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobRoleDto)
  role?: JobRoleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobRequirementsDto)
  requirements?: JobRequirementsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobExperienceDto)
  experience?: JobExperienceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobSkillDto)
  skills?: JobSkillDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minYearsExperience?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}

export class UploadJobsJsonDto {
  @IsOptional()
  @IsArray()
  jobs?: CreateJobDto[];

  @IsOptional()
  @IsArray()
  jobProfiles?: CreateJobDto[];

  @IsOptional()
  @IsArray()
  items?: CreateJobDto[];
}
