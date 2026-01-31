import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async handleMessage(@Body() body: { message: string }) {
    return this.chatService.processMessage(body.message);
  }
}
