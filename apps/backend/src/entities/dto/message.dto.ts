import { MessageReactionDto } from './message-reaction.dto';

/**
 * Message 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface MessageDto {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  roomId: number;
  senderId: number;
  parentId?: number;
}

/**
 * 응답 시 사용하는 Message 인터페이스
 */
export interface MessageResponseDto extends Omit<MessageDto, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  sender: {
    id: number;
    nickname: string;
    imageUrl?: string;
  };
  reactions: MessageReactionDto[];
  replyCount?: number;
} 