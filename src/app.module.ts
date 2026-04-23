import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ApplicationsModule } from './applications/applications.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ChatModule } from './chat/chat.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { JobsModule } from './jobs/jobs.module';
import { SeedModule } from './seed/seed.module';
import { UploadLogsModule } from './upload-logs/upload-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/umurava-hr-ai',
    ),
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    AiModule,
    ChatModule,
    SeedModule,
    IntegrationsModule,
    UploadLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
