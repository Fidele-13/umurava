import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadLogsController } from './upload-logs.controller';
import { UploadLogsService } from './upload-logs.service';
import { UploadLog, UploadLogSchema } from './schemas/upload-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadLog.name, schema: UploadLogSchema },
    ]),
  ],
  controllers: [UploadLogsController],
  providers: [UploadLogsService],
  exports: [UploadLogsService],
})
export class UploadLogsModule {}

