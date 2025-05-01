import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { User } from '../entities';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.getMessage(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('room/:roomId')
  getRoomMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.messagesService.getRoomMessages(roomId, limit, offset);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() createMessageDto: { content: string; roomId: number; parentId?: number },
  ) {
    return this.messagesService.createMessage({
      ...createMessageDto,
      senderId: user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: { content: string },
  ) {
    return this.messagesService.updateMessage(id, user.id, updateMessageDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.messagesService.deleteMessage(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reaction')
  toggleReaction(
    @CurrentUser() user: User,
    @Body() reactionDto: { messageId: number; emoji: string },
  ) {
    return this.messagesService.toggleReaction(
      reactionDto.messageId,
      user.id,
      reactionDto.emoji,
    );
  }
} 