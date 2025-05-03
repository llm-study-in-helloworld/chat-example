import { MessageUser, ReactionResponse } from '@chat-example/types';
import { MessageReaction as MessageReactionEntity } from '../entities';

/**
 * 응답 시 사용하는 MessageReaction 클래스
 */
export class MessageReactionResponseDto implements ReactionResponse {
  id: number = 0;
  emoji: string = '';
  userId: number = 0;
  messageId: number = 0;
  createdAt: string = '';
  user: MessageUser = { id: 0, nickname: '' };

  /**
   * MessageReaction 엔티티를 ResponseDto로 변환
   */
  static fromEntity(reaction: MessageReactionEntity): MessageReactionResponseDto {
    const dto = new MessageReactionResponseDto();
    dto.id = reaction.id;
    dto.emoji = reaction.emoji;
    dto.userId = reaction.user.id;
    dto.messageId = reaction.message;
    dto.createdAt = reaction.createdAt.toISOString();
    dto.user = {
      id: reaction.user.id,
      nickname: reaction.user.nickname,
      imageUrl: reaction.user.imageUrl
    };
    return dto;
  }
} 