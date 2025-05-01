/**
 * MessageReaction 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface MessageReactionDto {
  id: number;
  emoji: string;
  userId: number;
  messageId: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 응답 시 사용하는 MessageReaction 인터페이스
 */
export interface MessageReactionResponseDto extends Omit<MessageReactionDto, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    nickname: string;
    imageUrl?: string;
  };
} 