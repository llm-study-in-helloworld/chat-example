import { MessageUser, RoomRole, RoomUserResponse } from "@chat-example/types";
import { RoomUser } from "../entities";
/**
 * 응답 시 사용하는 RoomUser 클래스
 */
export class RoomUserResponseDto implements RoomUserResponse {
  userId: number = 0;
  roomId: number = 0;
  role: RoomRole = RoomRole.MEMBER;
  joinedAt: string = "";
  user: MessageUser = { id: 0, nickname: "" };

  /**
   * RoomUser 엔티티를 ResponseDto로 변환
   * Safely extracts properties to avoid circular references
   */
  static fromEntity(roomUser: RoomUser): RoomUserResponseDto {
    const dto = new RoomUserResponseDto();

    // Extract primitive values safely
    dto.roomId = roomUser.roomId;
    dto.userId = roomUser.userId; // Use getter instead of direct reference
    dto.role = roomUser.role;

    // Handle date carefully
    dto.joinedAt = roomUser.joinedAt.toISOString();

    // Extract only needed user properties to avoid circular references
    dto.user = {
      id: roomUser.user.id,
      nickname: roomUser.user.nickname,
      imageUrl: roomUser.user.imageUrl,
    };

    return dto;
  }
}
