import {
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AvailabilityDto,
  CertificationDto,
  EducationDto,
  ExperienceDto,
  LanguageDto,
  ProjectDto,
  SkillDto,
  SocialLinksDto,
} from './create-candidate.dto';

export class UpdateCandidateDto {
  @IsString()
  @IsOptional()
  externalCandidateId?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  headline?: string;

  @IsString()
  @IsOptional()
  bio?: string | null;

  @IsString()
  @IsOptional()
  location?: string;

  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  @IsArray()
  @IsOptional()
  skills?: SkillDto[];

  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  @IsArray()
  @IsOptional()
  languages?: LanguageDto[];

  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  @IsArray()
  @IsOptional()
  experience?: ExperienceDto[];

  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  @IsArray()
  @IsOptional()
  education?: EducationDto[];

  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  @IsArray()
  @IsOptional()
  certifications?: CertificationDto[];

  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  @IsArray()
  @IsOptional()
  projects?: ProjectDto[];

  @ValidateNested()
  @Type(() => AvailabilityDto)
  @IsOptional()
  availability?: AvailabilityDto;

  @ValidateNested()
  @Type(() => SocialLinksDto)
  @IsObject()
  @IsOptional()
  socialLinks?: SocialLinksDto;
}
