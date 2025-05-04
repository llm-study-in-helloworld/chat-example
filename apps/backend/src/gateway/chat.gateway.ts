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
import { LoggerService } from '../logger/logger.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { ReactionDto } from '../messages/dto/reaction.dto';
import { UpdateMessageDto } from '../messages/dto/update-message.dto';
import { MessagesService } from '../messages/messages.service';
import { RoomsService } from '../rooms/rooms.service';
import { ReactionResponseDto, ReactionUpdateEventDto, SocketErrorDto, SocketSuccessDto, UserPresenceEventDto } from './dto/socket-response.dto';

/**
 * 실시간 채팅을 위한 웹소켓 게이트웨이
 * 
 * Note: NestJS automatically handles EntityManager within the services.
 * Each service method has its own transaction context through dependency injection.
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
    private readonly logger: LoggerService,
  ) {}

  async handleConnection(client: Socket) {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleConnection', 'ChatGateway');
    
    try {
      this.logger.debug('WebSocket connection attempt...', 'ChatGateway');
      
      // Try to get token from different sources
      let token: string | undefined;
      
      // Check headers (traditional way)
      const authHeader = client.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        this.logger.debug('Token found in Authorization header', 'ChatGateway');
      }
      
      // Check socket.io auth object (alternative way)
      if (!token && client.handshake.auth && client.handshake.auth.token) {
        token = client.handshake.auth.token;
        this.logger.debug('Token found in auth object', 'ChatGateway');
      }
      
      if (!token) {
        this.logger.warn('No token found, disconnecting client', 'ChatGateway');
        client.disconnect();
        return;
      }
      
      // Handle tokens that might already include 'Bearer ' prefix
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
        this.logger.debug('Removed Bearer prefix from token', 'ChatGateway');
      }
      
      this.logger.debug(`Validating token (${token.substring(0, 10)}...)`, 'ChatGateway');
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        this.logger.warn('Invalid token, disconnecting client', 'ChatGateway');
        client.disconnect();
        return;
      }
      
      this.logger.debug(`User authenticated: ${user.id}`, 'ChatGateway');
      client.data.user = user;
      
      // Join user's personal room for direct notifications
      client.join(`user:${user.id}`);
      this.logger.debug(`Joined user room: user:${user.id}`, 'ChatGateway');
      
      // 사용자 참여 룸 자동 연결
      const rooms = await this.roomsService.getUserRooms(user.id);
      this.logger.debug(`User is in ${rooms.length} rooms`, 'ChatGateway');
      
      rooms.forEach(room => {
        client.join(`room:${room.id}`);
        this.logger.debug(`Joined room: room:${room.id}`, 'ChatGateway');
      });
      
      // presence 업데이트
      const presenceEvent: UserPresenceEventDto = { 
        userId: user.id, 
        status: 'online' 
      };
      this.server.emit('user_presence', presenceEvent);
      this.logger.debug(`Emitted presence update for user ${user.id}: online`, 'ChatGateway');
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error in handleConnection: ${error.message}`, error.stack, 'ChatGateway');
      client.disconnect();
    } finally {
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleConnection', elapsedTime, 'ChatGateway');
    }
  }

  async handleDisconnect(client: Socket) {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleDisconnect', 'ChatGateway');
    
    try {
      if (client.data.user) {
        const presenceEvent: UserPresenceEventDto = { 
          userId: client.data.user.id, 
          status: 'offline' 
        };
        this.server.emit('user_presence', presenceEvent);
        this.logger.debug(`User ${client.data.user.id} disconnected, updated presence to offline`, 'ChatGateway');
      } else {
        this.logger.debug('Unauthenticated client disconnected', 'ChatGateway');
      }
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error in handleDisconnect: ${error.message}`, error.stack, 'ChatGateway');
    } finally {
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleDisconnect', elapsedTime, 'ChatGateway');
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, payload: { roomId: number }): Promise<SocketSuccessDto | SocketErrorDto> {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleJoinRoom', 'ChatGateway');
    this.logger.debug(`User ${client.data.user.id} attempting to join room ${payload.roomId}`, 'ChatGateway');
    
    try {
      // 권한 확인
      const canJoin = await this.roomsService.canUserJoinRoom({
        userId: client.data.user.id, 
        roomId: payload.roomId
      });
      
      if (!canJoin) {
        this.logger.warn(`Access denied: User ${client.data.user.id} not allowed to join room ${payload.roomId}`, 'ChatGateway');
        return { error: '접근 권한이 없습니다' };
      }
      
      client.join(`room:${payload.roomId}`);
      this.logger.debug(`User ${client.data.user.id} joined room ${payload.roomId}`, 'ChatGateway');
      
      // Update last seen timestamp
      await this.roomsService.updateLastSeen(client.data.user.id, payload.roomId);
      this.logger.debug(`Updated last seen timestamp for user ${client.data.user.id} in room ${payload.roomId}`, 'ChatGateway');
      
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleJoinRoom', elapsedTime, 'ChatGateway');
      return { success: true };
    } catch (e) {
      const error = e as Error;
      this.logger.error(`Error in handleJoinRoom: ${error.message}`, error.stack, 'ChatGateway');
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleJoinRoom', elapsedTime, 'ChatGateway');
      return { error: 'Failed to join room' };
    }
  }

  @SubscribeMessage('new_message')
  async handleNewMessage(client: Socket, payload: CreateMessageDto) {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleNewMessage', 'ChatGateway');
    this.logger.debug(`User ${client.data.user.id} sending message to room ${payload.roomId}`, 'ChatGateway');
    
    try {
      // Check user can access the room
      const canJoin = await this.roomsService.canUserJoinRoom({
        userId: client.data.user.id, 
        roomId: payload.roomId
      });
      
      if (!canJoin) {
        this.logger.warn(`Access denied: User ${client.data.user.id} not allowed to send message to room ${payload.roomId}`, 'ChatGateway');
        return { error: '접근 권한이 없습니다' };
      }
      
      // Create the message
      const message = await this.messagesService.createMessage({
        roomId: payload.roomId,
        senderId: client.data.user.id,
        content: payload.content,
        parentId: payload.parentId,
      });
      
      this.logger.debug(`Message ${message.id} created in room ${payload.roomId}`, 'ChatGateway');
      
      // Broadcast message to room
      this.server.to(`room:${payload.roomId}`).emit('new_message', message);
      this.logger.debug(`Message ${message.id} broadcasted to room ${payload.roomId}`, 'ChatGateway');
      
      // Process mentions if any
      if (message.mentions && message.mentions.length > 0) {
        // Extract user IDs from mentions
        const mentionedUserIds = message.mentions.map(mention => mention.mentionedUser.id);
        this.logger.debug(`Message ${message.id} mentions users: ${mentionedUserIds.join(', ')}`, 'ChatGateway');
        
        // Notify mentioned users
        for (const userId of mentionedUserIds) {
          this.server.to(`user:${userId}`).emit('mention_alert', {
            messageId: message.id,
            roomId: payload.roomId,
          });
          this.logger.debug(`Mention alert sent to user ${userId}`, 'ChatGateway');
        }
      }
      
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleNewMessage', elapsedTime, 'ChatGateway');
      return message;
    } catch (error: any) {
      this.logger.error(`Error in handleNewMessage: ${error.message}`, error.stack, 'ChatGateway');
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to create message' };
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleNewMessage', elapsedTime, 'ChatGateway');
      return errorResponse;
    }
  }

  @SubscribeMessage('reply_message')
  async handleReplyMessage(client: Socket, payload: {
    roomId: number;
    parentId: number;
    content: string;
  }) {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleReplyMessage', 'ChatGateway');
    this.logger.debug(`User ${client.data.user.id} replying to message ${payload.parentId} in room ${payload.roomId}`, 'ChatGateway');
    
    try {
      // Check user can access the room
      const canJoin = await this.roomsService.canUserJoinRoom({
        userId: client.data.user.id, 
        roomId: payload.roomId
      });
      
      if (!canJoin) {
        this.logger.warn(`Access denied: User ${client.data.user.id} not allowed to send reply to room ${payload.roomId}`, 'ChatGateway');
        return { error: '접근 권한이 없습니다' };
      }
      
      // Check if parent message exists
      const parentMessage = await this.messagesService.getMessage(payload.parentId);
      if (!parentMessage) {
        this.logger.warn(`Reply failed: Parent message ${payload.parentId} not found`, 'ChatGateway');
        return { error: '답장할 메시지를 찾을 수 없습니다' };
      }
      
      // Verify parent message belongs to the same room
      if (parentMessage.roomId !== payload.roomId) {
        this.logger.warn(`Reply failed: Parent message ${payload.parentId} not in room ${payload.roomId}`, 'ChatGateway');
        return { error: '잘못된 요청입니다' };
      }
      
      // Create the reply message
      const message = await this.messagesService.createMessage({
        roomId: payload.roomId,
        senderId: client.data.user.id,
        content: payload.content,
        parentId: payload.parentId,
      });
      
      this.logger.debug(`Reply message ${message.id} created in room ${payload.roomId}`, 'ChatGateway');
      
      // Broadcast message to room
      this.server.to(`room:${payload.roomId}`).emit('new_message', message);
      this.logger.debug(`Reply message ${message.id} broadcasted to room ${payload.roomId}`, 'ChatGateway');
      
      // Notify the original message author if they're not the same as reply author
      if (parentMessage.sender.id !== client.data.user.id) {
        this.server.to(`user:${parentMessage.sender.id}`).emit('reply_alert', {
          messageId: message.id,
          parentId: payload.parentId,
          roomId: payload.roomId,
        });
        this.logger.debug(`Reply alert sent to message author ${parentMessage.sender.id}`, 'ChatGateway');
      }
      
      // Process mentions if any
      if (message.mentions && message.mentions.length > 0) {
        // Extract user IDs from mentions
        const mentionedUserIds = message.mentions.map(mention => mention.mentionedUser.id);
        this.logger.debug(`Reply message ${message.id} mentions users: ${mentionedUserIds.join(', ')}`, 'ChatGateway');
        
        // Notify mentioned users
        for (const userId of mentionedUserIds) {
          this.server.to(`user:${userId}`).emit('mention_alert', {
            messageId: message.id,
            roomId: payload.roomId,
          });
          this.logger.debug(`Mention alert sent to user ${userId}`, 'ChatGateway');
        }
      }
      
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleReplyMessage', elapsedTime, 'ChatGateway');
      return message;
    } catch (error: any) {
      this.logger.error(`Error in handleReplyMessage: ${error.message}`, error.stack, 'ChatGateway');
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to create reply' };
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleReplyMessage', elapsedTime, 'ChatGateway');
      return errorResponse;
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(client: Socket, payload: {
    messageId: number;
    content: string;
  }) {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleEditMessage', 'ChatGateway');
    this.logger.debug(`User ${client.data.user.id} editing message ${payload.messageId}`, 'ChatGateway');
    
    try {
      // Check permission
      const canEdit = await this.messagesService.canEditMessage(
        client.data.user.id,
        payload.messageId
      );
      
      if (!canEdit) {
        this.logger.warn(`Edit denied: User ${client.data.user.id} not allowed to edit message ${payload.messageId}`, 'ChatGateway');
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
      
      this.logger.debug(`Message ${payload.messageId} updated successfully`, 'ChatGateway');
      
      // Access roomId directly from the message DTO
      if (message.roomId) {
        // Broadcast update to everyone in the room
        this.server.to(`room:${message.roomId}`).emit('message_updated', message);
        this.logger.debug(`Update for message ${payload.messageId} broadcasted to room ${message.roomId}`, 'ChatGateway');
      }
      
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleEditMessage', elapsedTime, 'ChatGateway');
      return message;
    } catch (error: any) {
      this.logger.error(`Error in handleEditMessage: ${error.message}`, error.stack, 'ChatGateway');
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to update message' };
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleEditMessage', elapsedTime, 'ChatGateway');
      return errorResponse;
    }
  }

  @SubscribeMessage('react_message')
  async handleReaction(client: Socket, payload: ReactionDto): Promise<ReactionResponseDto | SocketErrorDto> {
    const startTime = Date.now();
    this.logger.logMethodEntry('handleReaction', 'ChatGateway');
    this.logger.debug(`User ${client.data.user.id} reacting to message ${payload.messageId} with emoji ${payload.emoji}`, 'ChatGateway');
    
    try {
      // Toggle reaction
      const reaction = await this.messagesService.toggleReaction(
        payload.messageId,
        client.data.user.id,
        payload.emoji
      );
      
      this.logger.debug(`Reaction ${reaction ? 'added' : 'removed'} for message ${payload.messageId}`, 'ChatGateway');
      
      // Get the message to find the room
      const message = await this.messagesService.getMessage(payload.messageId);
      
      if (message && message.roomId) {
        // Broadcast reaction update to the room
        const updateEvent: ReactionUpdateEventDto = {
          messageId: payload.messageId,
          reactions: message.reactions
        };
        this.server.to(`room:${message.roomId}`).emit('reaction_updated', updateEvent);
        this.logger.debug(`Reaction update for message ${payload.messageId} broadcasted to room ${message.roomId}`, 'ChatGateway');
      }
      
      const response: ReactionResponseDto = { 
        success: true, 
        added: !!reaction,
        reaction: reaction,
      };
      
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleReaction', elapsedTime, 'ChatGateway');
      return response;
    } catch (error: any) {
      this.logger.error(`Error in handleReaction: ${error.message}`, error.stack, 'ChatGateway');
      const errorResponse: SocketErrorDto = { error: error.message || 'Failed to process reaction' };
      const elapsedTime = Date.now() - startTime;
      this.logger.logMethodExit('handleReaction', elapsedTime, 'ChatGateway');
      return errorResponse;
    }
  }
} 