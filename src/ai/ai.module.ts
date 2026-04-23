import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidatesModule } from '../candidates/candidates.module';
import {
  Candidate,
  CandidateSchema,
} from '../candidates/schemas/candidate.schema';
import { ChatModule } from '../chat/chat.module';
import { Job, JobSchema } from '../jobs/schemas/job.schema';
import {
  JobApplication,
  JobApplicationSchema,
} from '../applications/schemas/job-application.schema';
import {
  CandidateParsedProfile,
  CandidateParsedProfileSchema,
} from '../candidates/schemas/candidate-parsed-profile.schema';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import {
  ScreeningResult,
  ScreeningResultSchema,
} from './schemas/screening-result.schema';

@Module({
  imports: [
    ConfigModule,
    ChatModule,
    CandidatesModule,
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Candidate.name, schema: CandidateSchema },
      { name: JobApplication.name, schema: JobApplicationSchema },
      {
        name: CandidateParsedProfile.name,
        schema: CandidateParsedProfileSchema,
      },
      { name: ScreeningResult.name, schema: ScreeningResultSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService, GeminiService],
})
export class AiModule {}
