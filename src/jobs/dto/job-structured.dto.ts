import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class JobRoleDto {
  @IsString()
  title: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  responsibilities?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  education?: string[];
}

export class JobRequirementsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredSkills?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  minYearsExperience?: number;
}

export class JobExperienceDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  years?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  level?: string[];
}

export class JobSkillDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  core?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  niceToHave?: string[];
}

export class JobStructuredDto {
  @ValidateNested()
  @Type(() => JobRoleDto)
  @IsOptional()
  role?: JobRoleDto;

  @ValidateNested()
  @Type(() => JobRequirementsDto)
  @IsOptional()
  requirements?: JobRequirementsDto;

  @ValidateNested()
  @Type(() => JobExperienceDto)
  @IsOptional()
  experience?: JobExperienceDto;

  @ValidateNested()
  @Type(() => JobSkillDto)
  @IsOptional()
  skills?: JobSkillDto;
}
