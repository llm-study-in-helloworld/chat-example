import { Room } from '../Room.entity';
import { UserResponseDto } from './user.dto';
import { MessageResponseDto } from './message.dto';

/**
 * Room 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface RoomDto {
  id: number;
  name?: string;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 응답 시 사용하는 Room 클래스
 */
export class RoomResponseDto implements Pick<RoomDto, 'id' | 'name' | 'isGroup'> {
  id: number = 0;
  name?: string;
  isGroup: boolean = false;
  createdAt: string = '';
  updatedAt: string = '';
  users: Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'>[] = [];
  lastMessage?: Pick<MessageResponseDto, 'id' | 'content' | 'createdAt'> & { senderId: number };

  /**
   * Room 엔티티를 ResponseDto로 변환
   */
  static fromEntity(room: Room): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = room.id;
    dto.name = room.name;
    dto.isGroup = room.isGroup;
    dto.createdAt = room.createdAt.toISOString();
    dto.updatedAt = room.updatedAt.toISOString();
    
    dto.users = room.roomUsers.getItems().map(roomUser => ({
      id: roomUser.user.id,
      nickname: roomUser.user.nickname,
      imageUrl: roomUser.user.imageUrl
    }));
    
    if (room.messages?.getItems().length > 0) {
      const lastMessage = room.messages.getItems().sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      )[0];
      
      dto.lastMessage = {
        id: lastMessage.id,
        content: lastMessage.displayContent,
        senderId: lastMessage.sender.id,
        createdAt: lastMessage.createdAt.toISOString()
      };
    }
    
    return dto;
  }
} 