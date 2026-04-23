import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['hr', 'assistant'] })
  role: 'hr' | 'assistant';

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

@Schema({ timestamps: true, versionKey: false })
export class ChatSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ type: Types.ObjectId, ref: 'Job' })
  jobId?: Types.ObjectId;

  @Prop({ type: String, index: true })
  jobExternalId?: string;

  @Prop({ default: 'HR AI Session' })
  title: string;

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[];
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
