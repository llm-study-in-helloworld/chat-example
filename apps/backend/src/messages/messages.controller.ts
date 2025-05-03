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
  NotFoundException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { User } from '../entities';
import { MessageResponseDto } from '../entities/dto/message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MessageResponseDto> {
    const message = await this.messagesService.getMessage(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
 
    return message;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/replies')
  async getReplies(@Param('id', ParseIntPipe) id: number): Promise<MessageResponseDto[]> {
    const parentMessage = await this.messagesService.getMessage(id);
    if (!parentMessage) {
      throw new NotFoundException('Parent message not found');
    }

    return this.messagesService.findReplies(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('room/:roomId')
  async getRoomMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.getRoomMessages(roomId, limit, offset);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createMessageDto: { content: string; roomId: number; parentId?: number },
  ): Promise<MessageResponseDto> {
    return this.messagesService.createMessage({
      ...createMessageDto,
      senderId: user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reply')
  async createReply(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) parentId: number,
    @Body() createReplyDto: { content: string; roomId: number },
  ): Promise<MessageResponseDto> {
    // Check if parent message exists
    const parentMessage = await this.messagesService.getMessage(parentId);
    if (!parentMessage) {
      throw new NotFoundException('Parent message not found');
    }
    
    // Create the reply message
    return this.messagesService.createMessage({
      content: createReplyDto.content,
      roomId: createReplyDto.roomId,
      senderId: user.id,
      parentId: parentId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: { content: string },
  ): Promise<MessageResponseDto> {
    return this.messagesService.updateMessage(id, user.id, updateMessageDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const result = await this.messagesService.deleteMessage(id, user.id);
    return { success: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reaction')
  async toggleReaction(
    @CurrentUser() user: User,
    @Body() reactionDto: { messageId: number; emoji: string },
  ) {
    const reaction = await this.messagesService.toggleReaction(
      reactionDto.messageId,
      user.id,
      reactionDto.emoji,
    );
    
    if (!reaction) {
      return { success: true, removed: true };
    }
    
    return { success: true, removed: false, reaction };
  }
} 