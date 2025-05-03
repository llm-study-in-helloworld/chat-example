import { RoomResponse } from '@chat-example/types';
import { Room as RoomEntity } from '../entities';

/**
 * 응답 시 사용하는 Room 클래스
 */
export class RoomResponseDto implements RoomResponse {
  id: number = 0;
  name: string = '';
  description?: string = '';
  imageUrl?: string = '';
  isPrivate: boolean = false;
  ownerId: number = 0;
  createdAt: string = '';
  updatedAt: string = '';
  participantCount: number = 0;
  unreadCount?: number;

  /**
   * Room 엔티티를 ResponseDto로 변환
   */
  static fromEntity(room: RoomEntity): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = room.id;
    dto.name = room.name || '';
    // Custom fields not in entity but in the response type
    dto.description = room.description || '';
    dto.imageUrl = room.imageUrl || '';
    dto.isPrivate = room.isPrivate || false;
    
    dto.ownerId = room.ownerId;
    
    dto.createdAt = room.createdAt.toISOString();
    dto.updatedAt = room.updatedAt.toISOString();
    
    // Set participant count
    dto.participantCount = room.participantCount;
    
    return dto;
  }
} 