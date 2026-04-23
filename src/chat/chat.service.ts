import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  ChatSession,
  ChatSessionDocument,
} from './schemas/chat-session.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatSession.name)
    private readonly chatSessionModel: Model<ChatSessionDocument>,
  ) {}

  async appendMessage(input: {
    sessionId?: string;
    jobId?: string;
    jobExternalId?: string;
    role: 'hr' | 'assistant';
    content: string;
  }) {
    const sessionId = input.sessionId ?? randomUUID();
    const hasMongoJobId =
      typeof input.jobId === 'string' && Types.ObjectId.isValid(input.jobId);

    const update = {
      $setOnInsert: {
        sessionId,
        title: 'HR AI Session',
        ...(hasMongoJobId ? { jobId: new Types.ObjectId(input.jobId) } : {}),
      },
      $set: {
        ...(input.jobExternalId ? { jobExternalId: input.jobExternalId } : {}),
      },
      $push: {
        messages: {
          role: input.role,
          content: input.content,
          createdAt: new Date(),
        },
      },
    };

    const session = await this.chatSessionModel
      .findOneAndUpdate({ sessionId }, update, {
        upsert: true,
        new: true,
      })
      .exec();

    return session;
  }

  async getSession(sessionId: string) {
    const session = await this.chatSessionModel.findOne({ sessionId }).exec();

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }
}
