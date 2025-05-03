import { Message } from '../entities';
import { MentionResponseDto } from './mention.dto';
import { MessageReactionResponseDto } from './message-reaction.dto';
import { UserResponseDto } from './user.dto';

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
 * 응답 시 사용하는 Message 클래스
 */
export class MessageResponseDto implements Pick<MessageDto, 'id' | 'content'> {
  id: number = 0;
  content: string = '';
  createdAt: string = '';
  updatedAt: string = '';
  deletedAt: string | null = null;
  roomId: number = 0;
  parentId: number | null = null;
  isDeleted: boolean = false;
  sender: Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'> = { id: 0, nickname: '', imageUrl: '' };
  reactions: MessageReactionResponseDto[] = [];
  mentions: MentionResponseDto[] = [];
  replyCount?: number;

  private constructor() {
  }

  /**
   * Message 엔티티를 ResponseDto로 변환
   */
  static fromEntity(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.content = message.displayContent;
    dto.createdAt = message.createdAt.toISOString();
    dto.updatedAt = message.updatedAt.toISOString();
    dto.deletedAt = message.deletedAt ? message.deletedAt.toISOString() : null;
    dto.isDeleted = !!message.deletedAt;
    dto.parentId = message.parent ?? null;
    dto.roomId = message.room ?? null;

    // Add parent message information if available
    dto.sender = {
      id: message.sender.id,
      nickname: message.sender.nickname,
      imageUrl: message.sender.imageUrl
    };
    
    dto.reactions = message.reactions.getItems().map(reaction => 
      MessageReactionResponseDto.fromEntity(reaction)
    );
    
    dto.mentions = message.mentions.getItems().map(mention => 
      MentionResponseDto.fromEntity(mention)
    );
    
    return dto;
  }
} 