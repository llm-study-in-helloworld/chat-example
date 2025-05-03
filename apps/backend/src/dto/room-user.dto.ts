import { MessageUser, RoomRole, RoomUserResponse } from '@chat-example/types';
import { RoomUser } from '../entities';
/**
 * 응답 시 사용하는 RoomUser 클래스
 */
export class RoomUserResponseDto implements RoomUserResponse {
  userId: number = 0;
  roomId: number = 0;
  role: RoomRole = RoomRole.MEMBER;
  joinedAt: string = '';
  user: MessageUser = { id: 0, nickname: '' };
  room?: { id: number; name: string; isPrivate: boolean } = { id: 0, name: '', isPrivate: false };

  /**
   * RoomUser 엔티티를 ResponseDto로 변환
   */
  static fromEntity(roomUser: RoomUser): RoomUserResponseDto {
    const dto = new RoomUserResponseDto();
    dto.roomId = roomUser.room.id;
    dto.userId = roomUser.user.id;
    dto.role = roomUser.role;
    dto.joinedAt = roomUser.joinedAt.toISOString();
    
    dto.user = {
      id: roomUser.user.id,
      nickname: roomUser.user.nickname,
      imageUrl: roomUser.user.imageUrl
    };
    
    dto.room = {
      id: roomUser.room.id,
      name: roomUser.room.name,
      isPrivate: roomUser.room.isPrivate
    };
    
    return dto;
  }
} 