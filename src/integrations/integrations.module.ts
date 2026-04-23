import { Module } from '@nestjs/common';
import { TalentSourceService } from './talent-source.service';

@Module({
  providers: [TalentSourceService],
  exports: [TalentSourceService],
})
export class IntegrationsModule {}
