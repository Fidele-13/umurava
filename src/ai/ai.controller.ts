import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { RankCandidatesDto } from './dto/rank-candidates.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('rank')
  rankCandidates(@Body() payload: RankCandidatesDto) {
    return this.aiService.rankCandidates(payload);
  }

  @Post('chat')
  chat(@Body() payload: ChatDto) {
    return this.aiService.chat(payload);
  }

  @Get('chat/:sessionId')
  getChatHistory(@Param('sessionId') sessionId: string) {
    return this.aiService.getChatHistory(sessionId);
  }

  @Get('screenings')
  getScreenings() {
    return this.aiService.getScreenings();
  }
}
