import { MentionResponse, MessageUser } from '@chat-example/types';
import { Mention as MentionEntity } from '../entities';

/**
 * 응답 시 사용하는 Mention 클래스
 */
export class MentionResponseDto implements MentionResponse {
  id: number = 0;
  messageId: number = 0;
  userId: number = 0;
  createdAt: string = '';
  mentionedUser: MessageUser = { id: 0, nickname: '' };

  /**
   * Mention 엔티티를 ResponseDto로 변환
   */
  static fromEntity(mention: MentionEntity): MentionResponseDto {
    const dto = new MentionResponseDto();
    dto.id = mention.id;
    dto.messageId = mention.message;
    dto.userId = mention.mentionedUser.id;
    dto.createdAt = mention.createdAt.toISOString();
    dto.mentionedUser = {
      id: mention.mentionedUser.id,
      nickname: mention.mentionedUser.nickname,
      imageUrl: mention.mentionedUser.imageUrl
    };
    return dto;
  }
} 