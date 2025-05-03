import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { ReactionDto } from '../messages/dto/reaction.dto';
import { UpdateMessageDto } from '../messages/dto/update-message.dto';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { ReactionResponseDto, ReactionUpdateEventDto, SocketErrorDto, SocketSuccessDto, UserPresenceEventDto } from './dto/socket-response.dto';

/**
 * 실시간 채팅을 위한 웹소켓 게이트웨이
 */
@Injectable()
@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly messagesService: MessagesService,
    private readonly roomsService: RoomsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      
      const user = await this.authService.validateToken(token);
      if (!user) {
        client.disconnect();
        return;
      }
      
      client.data.user = user;
      
      // Join user's personal room for direct notifications
      client.join(`user:${user.id}`);
      
      // 사용자 참여 룸 자동 연결
      const rooms = await this.roomsService.getUserRooms(user.id);
      rooms.forEach(room => {
        client.join(`room:${room.id}`);
      });
      
      // presence 업데이트
      const presenceEvent: UserPresenceEventDto = { 
        userId: user.id, 
        status: 'online' 
      };
      this.server.emit('user_presence', presenceEvent);
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.user) {
      const presenceEvent: UserPresenceEventDto = { 
        userId: client.data.user.id, 
        status: 'offline' 
      };
      this.server.emit('user_presence', presenceEvent);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, payload: { roomId: number }): Promise<SocketSuccessDto | SocketErrorDto> {
    // 권한 확인
    const canJoin = await this.roomsService.canUserJoinRoom(
      client.data.user.id, 
      payload.roomId
    );
    
    if (!canJoin) {
      return { error: '접근 권한이 없습니다' };
    }
    
    client.join(`room:${payload.roomId}`);
    
    // Update last seen timestamp
    await this.roomsService.updateLastSeen(client.data.user.id, payload.roomId);
    
    return { success: true };
  }

  @SubscribeMessage('new_message')
  async handleNewMessage(client: Socket, payload: CreateMessageDto) {
    try {
      // Check user can access the room
      const canJoin = await this.roomsService.canUserJoinRoom(
        client.data.user.id, 
        payload.roomId
      );
      
      if (!canJoin) {
        return { error: '접근 권한이 없습니다' };
      }
      
      // Create the message
      const message = await this.messagesService.createMessage({
        roomId: payload.roomId,
        senderId: client.data.user.id,
        content: payload.content,
        parentId: payload.parentId,
      });
      
      // Broadcast message to room
      this.server.to(`room:${payload.roomId}`).emit('new_message', message);
      
      // Process mentions if any
      if (message.mentions && message.mentions.length > 0) {
        // Extract user IDs from mentions
        const mentionedUserIds = message.mentions.map(mention => mention.mentionedUser.id);
        
        // Notify mentioned users
        for (const userId of mentionedUserIds) {
          this.server.to(`user:${userId}`).emit('mention_alert', {
            messageId: message.id,
            roomId: payload.roomId,
          });
        }
      }
      
      return message;
    } catch (error: any) {
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to create message' };
      return errorResponse;
    }
  }

  @SubscribeMessage('reply_message')
  async handleReplyMessage(client: Socket, payload: {
    roomId: number;
    parentId: number;
    content: string;
  }) {
    try {
      // Check user can access the room
      const canJoin = await this.roomsService.canUserJoinRoom(
        client.data.user.id, 
        payload.roomId
      );
      
      if (!canJoin) {
        return { error: '접근 권한이 없습니다' };
      }
      
      // Check if parent message exists
      const parentMessage = await this.messagesService.getMessage(payload.parentId);
      if (!parentMessage) {
        return { error: '답장할 메시지를 찾을 수 없습니다' };
      }
      
      // Verify parent message belongs to the same room
      if (parentMessage.roomId !== payload.roomId) {
        return { error: '잘못된 요청입니다' };
      }
      
      // Create the reply message
      const message = await this.messagesService.createMessage({
        roomId: payload.roomId,
        senderId: client.data.user.id,
        content: payload.content,
        parentId: payload.parentId,
      });
      
      // Broadcast message to room
      this.server.to(`room:${payload.roomId}`).emit('new_message', message);
      
      // Notify the original message author if they're not the same as reply author
      if (parentMessage.sender.id !== client.data.user.id) {
        this.server.to(`user:${parentMessage.sender.id}`).emit('reply_alert', {
          messageId: message.id,
          parentId: payload.parentId,
          roomId: payload.roomId,
        });
      }
      
      // Process mentions if any
      if (message.mentions && message.mentions.length > 0) {
        // Extract user IDs from mentions
        const mentionedUserIds = message.mentions.map(mention => mention.mentionedUser.id);
        
        // Notify mentioned users
        for (const userId of mentionedUserIds) {
          this.server.to(`user:${userId}`).emit('mention_alert', {
            messageId: message.id,
            roomId: payload.roomId,
          });
        }
      }
      
      return message;
    } catch (error: any) {
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to create reply' };
      return errorResponse;
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(client: Socket, payload: {
    messageId: number;
    content: string;
  }) {
    try {
      // Check permission
      const canEdit = await this.messagesService.canEditMessage(
        client.data.user.id,
        payload.messageId
      );
      
      if (!canEdit) {
        const errorResponse: SocketErrorDto = { error: '메시지를 수정할 권한이 없습니다' };
        return errorResponse;
      }
      
      // Update the message
      const updatedMessageDto = new UpdateMessageDto();
      updatedMessageDto.content = payload.content;
      
      const message = await this.messagesService.updateMessage(
        payload.messageId,
        client.data.user.id,
        updatedMessageDto
      );
      
      // Access roomId directly from the message DTO
      if (message.roomId) {
        // Broadcast update to everyone in the room
        this.server.to(`room:${message.roomId}`).emit('message_updated', message);
      }
      
      return message;
    } catch (error: any) {
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to update message' };
      return errorResponse;
    }
  }

  @SubscribeMessage('react_message')
  async handleReaction(client: Socket, payload: ReactionDto): Promise<ReactionResponseDto | SocketErrorDto> {
    try {
      // Toggle reaction
      const reaction = await this.messagesService.toggleReaction(
        payload.messageId,
        client.data.user.id,
        payload.emoji
      );
      
      // Get the message to find the room
      const message = await this.messagesService.getMessage(payload.messageId);
      
      if (message && message.roomId) {
        // Broadcast reaction update to the room
        const updateEvent: ReactionUpdateEventDto = {
          messageId: payload.messageId,
          reactions: message.reactions
        };
        this.server.to(`room:${message.roomId}`).emit('reaction_updated', updateEvent);
      }
      
      const response: ReactionResponseDto = { 
        success: true, 
        added: !!reaction,
        reaction: reaction,
      };
      
      return response;
    } catch (error: any) {
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to process reaction' };
      return errorResponse;
    }
  }
} 