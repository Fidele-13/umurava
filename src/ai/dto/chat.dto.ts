import { IsOptional, IsString } from 'class-validator';

export class ChatDto {
  @IsString()
  prompt: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  jobId?: string;
}
