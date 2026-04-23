import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateCandidateDto } from './create-candidate.dto';

export class UploadCandidatesJsonDto {
  @IsString()
  @IsOptional()
  jobId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCandidateDto)
  candidates: CreateCandidateDto[];
}
