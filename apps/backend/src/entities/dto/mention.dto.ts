/**
 * Mention 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface MentionDto {
  id: number;
  messageId: number;
  mentionedUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 응답 시 사용하는 Mention 인터페이스
 */
export interface MentionResponseDto extends Omit<MentionDto, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  mentionedUser: {
    id: number;
    nickname: string;
    imageUrl?: string;
  };
  message: {
    id: number;
    content: string;
  };
} 