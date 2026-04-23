// controllers/parser.controller.ts
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CandidateParserService } from '../parsers/candidate-parser.service';

type ParsedUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

@Controller('parse')
export class ParserController {
  constructor(private readonly parserService: CandidateParserService) {}

  @Post('resume')
  @UseInterceptors(FileInterceptor('file'))
  async parseResume(@UploadedFile() file?: ParsedUploadFile) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.parserService.parseDocument(
      file.buffer,
      file.originalname,
      file.mimetype
    );
    
    return {
      success: true,
      data: result
    };
  }

  @Post('batch')
  @UseInterceptors(FilesInterceptor('files'))
  async parseMultiple(@UploadedFiles() files?: ParsedUploadFile[]) {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required');
    }

    const results = await this.parserService.parseMultipleDocuments(
      files.map(f => ({
        buffer: f.buffer,
        filename: f.originalname,
        mimeType: f.mimetype,
      }))
    );

    return {
      success: true,
      count: results.length,
      data: results
    };
  }
}
