import { RoomUser } from '../RoomUser.entity';
import { RoomResponseDto } from './room.dto';
import { UserResponseDto } from './user.dto';

/**
 * RoomUser 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface RoomUserDto {
  roomId: number;
  userId: number;
  joinedAt: Date;
  lastSeenAt?: Date;
}

/**
 * 응답 시 사용하는 RoomUser 클래스
 */
export class RoomUserResponseDto implements Pick<RoomUserDto, 'roomId' | 'userId'> {
  roomId: number = 0;
  userId: number = 0;
  joinedAt: string = '';
  lastSeenAt?: string;
  user: Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'> = { id: 0, nickname: '' };
  room: Pick<RoomResponseDto, 'id' | 'name' | 'isGroup'> = { id: 0, isGroup: false };

  /**
   * RoomUser 엔티티를 ResponseDto로 변환
   */
  static fromEntity(roomUser: RoomUser): RoomUserResponseDto {
    const dto = new RoomUserResponseDto();
    dto.roomId = roomUser.room.id;
    dto.userId = roomUser.user.id;
    dto.joinedAt = roomUser.joinedAt.toISOString();
    dto.lastSeenAt = roomUser.lastSeenAt ? roomUser.lastSeenAt.toISOString() : undefined;
    
    dto.user = {
      id: roomUser.user.id,
      nickname: roomUser.user.nickname,
      imageUrl: roomUser.user.imageUrl
    };
    
    dto.room = {
      id: roomUser.room.id,
      name: roomUser.room.name,
      isGroup: roomUser.room.isGroup
    };
    
    return dto;
  }
} 