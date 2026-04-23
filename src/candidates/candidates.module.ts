import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationsModule } from '../applications/applications.module';
import { UploadLogsModule } from '../upload-logs/upload-logs.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { ParserController } from './controllers/parser.controller';
import { CandidateParserService } from './parsers/candidate-parser.service';
import {
  CandidateParsedProfile,
  CandidateParsedProfileSchema,
} from './schemas/candidate-parsed-profile.schema';
import {
  CandidateSourceProfile,
  CandidateSourceProfileSchema,
} from './schemas/candidate-source-profile.schema';
import {
  ResumeParseCache,
  ResumeParseCacheSchema,
} from './schemas/resume-parse-cache.schema';
import { Candidate, CandidateSchema } from './schemas/candidate.schema';

@Module({
  imports: [
    ApplicationsModule,
    UploadLogsModule,
    MongooseModule.forFeature([
      { name: Candidate.name, schema: CandidateSchema },
      {
        name: CandidateParsedProfile.name,
        schema: CandidateParsedProfileSchema,
      },
      {
        name: CandidateSourceProfile.name,
        schema: CandidateSourceProfileSchema,
      },
      {
        name: ResumeParseCache.name,
        schema: ResumeParseCacheSchema,
      },
    ]),
  ],
  controllers: [CandidatesController, ParserController],
  providers: [CandidatesService, CandidateParserService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
