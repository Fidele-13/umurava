/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RankCandidatesDto {
  @IsString()
  jobId: string;

  @IsInt()
  @Min(1 as const)
  @IsOptional()
  topN?: number;

  @IsString()
  @IsOptional()
  customPrompt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  candidateIds?: string[];
}
