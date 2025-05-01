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
 * 응답 시 사용하는 Room 인터페이스
 */
export interface RoomResponseDto extends Omit<RoomDto, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  users: Array<{
    id: number;
    nickname: string;
    imageUrl?: string;
  }>;
  lastMessage?: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  };
} 