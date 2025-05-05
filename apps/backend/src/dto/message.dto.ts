import { MessageResponse, MessageUser } from "@chat-example/types";
import { Message as MessageEntity } from "../entities";
import { MentionResponseDto } from "./mention.dto";
import { MessageReactionResponseDto } from "./message-reaction.dto";

/**
 * 응답 시 사용하는 Message 클래스
 */
export class MessageResponseDto implements MessageResponse {
  id: number = 0;
  content: string = "";
  createdAt: string = "";
  updatedAt: string = "";
  deletedAt: string | null = null;
  roomId: number = 0;
  senderId: number = 0;
  parentId: number | null = null;
  isDeleted: boolean = false;
  sender: MessageUser = { id: 0, nickname: "" };
  reactions: MessageReactionResponseDto[] = [];
  mentions: MentionResponseDto[] = [];
  replyCount?: number;

  private constructor() {}

  /**
   * Message 엔티티를 ResponseDto로 변환
   */
  static fromEntity(message: MessageEntity): MessageResponseDto {
    const dto = new MessageResponseDto();

    // Basic properties
    dto.id = message.id;
    dto.content = message.displayContent;

    // Date handling
    dto.createdAt = message.createdAt.toISOString();
    dto.updatedAt = message.updatedAt.toISOString();

    dto.deletedAt = message.deletedAt ? message.deletedAt.toISOString() : null;

    // Relationship properties
    dto.isDeleted = !!message.deletedAt;
    dto.parentId = message.parent ?? null;
    dto.roomId = message.room;

    // Sender handling
    dto.senderId = message.sender.id;
    dto.sender = {
      id: message.sender.id,
      nickname: message.sender.nickname,
      imageUrl: message.sender.imageUrl,
    };

    // Collections
    dto.reactions = message.reactions
      .getItems()
      .map((reaction) => MessageReactionResponseDto.fromEntity(reaction));

    dto.mentions = message.mentions
      .getItems()
      .map((mention) => MentionResponseDto.fromEntity(mention));

    return dto;
  }
}
