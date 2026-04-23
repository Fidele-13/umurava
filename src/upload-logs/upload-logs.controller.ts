import { Controller, Get } from '@nestjs/common';
import { UploadLogsService } from './upload-logs.service';

@Controller()
export class UploadLogsController {
  constructor(private readonly uploadLogsService: UploadLogsService) {}

  @Get('upload-history')
  getHistory() {
    return this.uploadLogsService.getHistory();
  }

  @Get('upload-stats')
  getStats() {
    return this.uploadLogsService.getStats();
  }
}

