import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import { SendMessageDto, ThreadQuery } from './messages.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations')
  conversations(@CurrentUser() me: SelfUser) {
    return this.messages.conversations(me);
  }

  @Get('unread-count')
  unread(@CurrentUser() me: SelfUser) {
    return this.messages.unreadCount(me);
  }

  @Get('with/:userId')
  thread(
    @CurrentUser() me: SelfUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ThreadQuery,
  ) {
    return this.messages.thread(me, userId, query.cursor);
  }

  @Post()
  send(@CurrentUser() me: SelfUser, @Body() dto: SendMessageDto) {
    return this.messages.send(me, dto.recipientId, dto.body);
  }

  @Post('with/:userId/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() me: SelfUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.messages.markRead(me, userId);
  }
}
