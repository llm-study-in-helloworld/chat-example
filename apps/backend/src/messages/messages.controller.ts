import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    @Request() req,
    @Body() createMessageDto: { content: string; roomId: number; parentId?: number },
  ) {
    return this.messagesService.createMessage({
      ...createMessageDto,
      senderId: req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: { content: string },
  ) {
    return this.messagesService.updateMessage(id, req.user.id, updateMessageDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.messagesService.deleteMessage(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reaction')
  toggleReaction(
    @Request() req,
    @Body() reactionDto: { messageId: number; emoji: string },
  ) {
    return this.messagesService.toggleReaction(
      reactionDto.messageId,
      req.user.id,
      reactionDto.emoji,
    );
  }
} 