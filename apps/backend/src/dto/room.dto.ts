import { MessageUser, RoomResponse } from "@chat-example/types";
import { Room as RoomEntity } from "../entities";

/**
 * 응답 시 사용하는 Room 클래스
 */
export class RoomResponseDto implements RoomResponse {
  id: number = 0;
  name: string = "";
  ownerId: number = 0;
  description?: string = "";
  imageUrl?: string = "";
  isPrivate: boolean = false;
  isDirect?: boolean;
  isActive?: boolean;
  createdAt: string = "";
  updatedAt: string = "";
  unreadCount?: number;
  otherUser?: MessageUser;

  /**
   * Room 엔티티를 ResponseDto로 변환
   * Safely extracts properties to avoid circular references
   */
  static fromEntity(room: RoomEntity): RoomResponseDto {
    const dto = new RoomResponseDto();

    // Extract primitive properties safely
    dto.id = room.id;
    dto.name = room.name || "";
    dto.description = room.description || "";
    dto.imageUrl = room.imageUrl || "";
    dto.isPrivate = room.isPrivate || false;
    dto.ownerId = room.ownerId;

    dto.updatedAt = room.updatedAt.toISOString();
    dto.createdAt = room.createdAt.toISOString();

    // Add additional properties
    dto.isDirect = !!room.isDirect;
    dto.isActive = room.isActive !== undefined ? room.isActive : true;

    return dto;
  }
}
