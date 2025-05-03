import { MessageReaction } from '../entities';
import { UserResponseDto } from './user.dto';

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
 * 응답 시 사용하는 MessageReaction 클래스
 */
export class MessageReactionResponseDto implements Pick<MessageReactionDto, 'id' | 'emoji' | 'userId' | 'messageId'> {
  id: number = 0;
  emoji: string = '';
  userId: number = 0;
  messageId: number = 0;
  createdAt: string = '';
  updatedAt: string = '';
  user: Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'> = { id: 0, nickname: '' };

  /**
   * MessageReaction 엔티티를 ResponseDto로 변환
   */
  static fromEntity(reaction: MessageReaction): MessageReactionResponseDto {
    const dto = new MessageReactionResponseDto();
    dto.id = reaction.id;
    dto.emoji = reaction.emoji;
    dto.userId = reaction.user.id;
    dto.messageId = reaction.message;
    dto.createdAt = reaction.createdAt.toISOString();
    dto.updatedAt = reaction.updatedAt.toISOString();
    dto.user = {
      id: reaction.user.id,
      nickname: reaction.user.nickname,
      imageUrl: reaction.user.imageUrl
    };
    return dto;
  }
} 