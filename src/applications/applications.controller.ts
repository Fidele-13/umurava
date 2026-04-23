import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApplicationsService } from './applications.service';

class LinkApplicationDto {
  @IsString()
  jobId: string;

  @IsString()
  candidateId: string;

  @IsIn(['manual', 'dummy-seed', 'external-api', 'csv-upload', 'resume-upload'])
  @IsOptional()
  source?:
    | 'manual'
    | 'dummy-seed'
    | 'external-api'
    | 'csv-upload'
    | 'resume-upload';
}

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  link(@Body() payload: LinkApplicationDto) {
    return this.applicationsService.linkCandidateToJobByExternalId(
      payload.jobId,
      payload.candidateId,
      payload.source ?? 'manual',
    );
  }

  @Get('job/:jobId')
  findByJob(@Param('jobId') jobId: string) {
    return this.applicationsService.findByJobExternalId(jobId);
  }

  @Get('candidate/:candidateId')
  findByCandidate(@Param('candidateId') candidateId: string) {
    return this.applicationsService.findByCandidateId(candidateId);
  }
}
