import { Mention } from '../Mention.entity';
import { UserResponseDto } from './user.dto';
import { MessageResponseDto } from './message.dto';

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
 * 응답 시 사용하는 Mention 클래스
 */
export class MentionResponseDto implements Pick<MentionDto, 'id' | 'messageId' | 'mentionedUserId'> {
  id: number = 0;
  messageId: number = 0;
  mentionedUserId: number = 0;
  createdAt: string = '';
  updatedAt: string = '';
  mentionedUser: Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'> = { id: 0, nickname: '' };
  message: Pick<MessageResponseDto, 'id' | 'content'> = { id: 0, content: '' };

  /**
   * Mention 엔티티를 ResponseDto로 변환
   */
  static fromEntity(mention: Mention): MentionResponseDto {
    const dto = new MentionResponseDto();
    dto.id = mention.id;
    dto.messageId = mention.message.id;
    dto.mentionedUserId = mention.mentionedUser.id;
    dto.createdAt = mention.createdAt.toISOString();
    dto.updatedAt = mention.updatedAt.toISOString();
    dto.mentionedUser = {
      id: mention.mentionedUser.id,
      nickname: mention.mentionedUser.nickname,
      imageUrl: mention.mentionedUser.imageUrl
    };
    dto.message = {
      id: mention.message.id,
      content: mention.message.content
    };
    return dto;
  }
} 