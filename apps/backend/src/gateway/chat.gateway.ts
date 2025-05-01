import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { Injectable } from '@nestjs/common';

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
      
      // 사용자 참여 룸 자동 연결 (RoomService 구현 후 추가 예정)
      // const rooms = await this.roomService.getUserRooms(user.id);
      // rooms.forEach(room => {
      //   client.join(`room:${room.id}`);
      // });
      
      // presence 업데이트
      this.server.emit('user_presence', { userId: user.id, status: 'online' });
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.user) {
      this.server.emit('user_presence', { 
        userId: client.data.user.id, 
        status: 'offline' 
      });
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, payload: { roomId: number }) {
    // 권한 확인 (RoomService 구현 후 추가 예정)
    // const canJoin = await this.roomService.canUserJoinRoom(
    //   client.data.user.id, 
    //   payload.roomId
    // );
    
    // if (!canJoin) {
    //   return { error: '접근 권한이 없습니다' };
    // }
    
    client.join(`room:${payload.roomId}`);
    return { success: true };
  }

  @SubscribeMessage('new_message')
  async handleNewMessage(client: Socket, payload: { 
    roomId: number;
    content: string;
    parentId?: number;
  }) {
    // 메시지 저장 (MessageService 구현 후 추가 예정)
    // const message = await this.messageService.createMessage({
    //   roomId: payload.roomId,
    //   senderId: client.data.user.id,
    //   content: payload.content,
    //   parentId: payload.parentId,
    // });
    
    // 임시 메시지
    const message = {
      id: Math.floor(Math.random() * 1000),
      roomId: payload.roomId,
      senderId: client.data.user.id,
      content: payload.content,
      createdAt: new Date().toISOString(),
      parentId: payload.parentId,
    };
    
    // 메시지 브로드캐스트
    this.server.to(`room:${payload.roomId}`).emit('new_message', message);
    
    // 멘션 처리 (MessageService 구현 후 추가 예정)
    // const mentions = this.messageService.extractMentions(payload.content);
    // if (mentions.length > 0) {
    //   await this.messageService.saveMentions(message.id, mentions);
    //   for (const userId of mentions) {
    //     this.server.to(`user:${userId}`).emit('mention_alert', {
    //       messageId: message.id,
    //       roomId: payload.roomId,
    //     });
    //   }
    // }
    
    return message;
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(client: Socket, payload: {
    messageId: number;
    content: string;
  }) {
    // 권한 확인 및 메시지 업데이트 (MessageService 구현 후 추가 예정)
    // const canEdit = await this.messageService.canEditMessage(
    //   client.data.user.id,
    //   payload.messageId
    // );
    
    // if (!canEdit) {
    //   return { error: '메시지를 수정할 권한이 없습니다' };
    // }
    
    // const message = await this.messageService.updateMessage(
    //   payload.messageId,
    //   payload.content
    // );
    
    // 임시 메시지
    const message = {
      id: payload.messageId,
      content: payload.content,
      updatedAt: new Date().toISOString(),
      room: { id: 1 } // 임시 데이터
    };
    
    // 룸에 변경사항 브로드캐스트
    this.server.to(`room:${message.room.id}`).emit('message_updated', message);
    
    return message;
  }

  @SubscribeMessage('react_message')
  async handleReaction(client: Socket, payload: {
    messageId: number;
    emoji: string;
  }) {
    // 리액션 토글 (MessageService 구현 후 추가 예정)
    // const reaction = await this.messageService.toggleReaction(
    //   payload.messageId,
    //   client.data.user.id,
    //   payload.emoji
    // );
    
    // const message = await this.messageService.getMessage(payload.messageId);
    
    // 임시 데이터
    const reaction = {
      id: Math.floor(Math.random() * 1000),
      emoji: payload.emoji,
      userId: client.data.user.id,
    };
    
    this.server.to(`room:1`).emit('reaction_updated', {
      messageId: payload.messageId,
      reactions: [reaction]
    });
    
    return reaction;
  }
} 