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
 * 응답 시 사용하는 RoomUser 인터페이스
 */
export interface RoomUserResponseDto extends Omit<RoomUserDto, 'joinedAt' | 'lastSeenAt'> {
  joinedAt: string;
  lastSeenAt?: string;
  user: {
    id: number;
    nickname: string;
    imageUrl?: string;
  };
  room: {
    id: number;
    name?: string;
    isGroup: boolean;
  };
} 