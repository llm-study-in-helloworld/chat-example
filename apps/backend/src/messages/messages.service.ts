import { EntityManager, FilterQuery, QueryOrder } from "@mikro-orm/core";
import { EntityRepository } from "@mikro-orm/mysql";
import { InjectRepository } from "@mikro-orm/nestjs";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UseInterceptors,
} from "@nestjs/common";
import { MessageReactionResponseDto, MessageResponseDto } from "../dto";
import { Mention, Message, MessageReaction, Room, User } from "../entities";
import { LoggerService, LogInterceptor } from "../logger";

interface CreateMessageDto {
  roomId: number;
  senderId: number;
  content: string;
  parentId?: number;
}

interface UpdateMessageDto {
  content: string;
}

/**
 * 메시지 관련 비즈니스 로직을 처리하는 서비스
 *
 * Note: This service uses both the LogInterceptor for automatic method logging and manual
 * logMethodEntry/logMethodExit calls to maintain compatibility with existing tests.
 * The LogInterceptor will primarily handle HTTP and WebSocket requests, while the manual
 * logging ensures all direct method calls are properly logged.
 */
@Injectable()
@UseInterceptors(LogInterceptor)
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: EntityRepository<Message>,
    @InjectRepository(MessageReaction)
    private readonly messageReactionRepository: EntityRepository<MessageReaction>,
    @InjectRepository(Mention)
    private readonly mentionRepository: EntityRepository<Mention>,
    @InjectRepository(Room)
    private readonly roomRepository: EntityRepository<Room>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 채팅방의 메시지 목록 조회
   */
  async getRoomMessages(
    roomId: number,
    limit = 20,
    offset = 0,
  ): Promise<MessageResponseDto[]> {
    this.logger.logMethodEntry("getRoomMessages", "MessagesService");
    this.logger.debug(
      `Fetching messages for room ${roomId} with limit ${limit} and offset ${offset}`,
      "MessagesService",
    );

    const messages = await this.em.find(
      Message,
      { room: roomId, parent: null },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset,
        populate: ["sender", "reactions", "reactions.user", "mentions"],
      },
    );

    this.logger.debug(
      `Found ${messages.length} messages in room ${roomId}`,
      "MessagesService",
    );

    const result = await this.formatMessagesResponse(messages);
    this.logger.logMethodExit("getRoomMessages", undefined, "MessagesService");
    return result;
  }

  /**
   * 단일 메시지 조회
   */
  async getMessage(messageId: number): Promise<MessageResponseDto | null> {
    this.logger.debug(
      `Fetching message with ID ${messageId}`,
      "MessagesService",
    );

    const message = await this.messageRepository.findOne(
      { id: messageId },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );

    if (!message) {
      this.logger.debug(
        `Message with ID ${messageId} not found`,
        "MessagesService",
      );
      return null;
    }

    // 단일 메시지의 답글 수 처리를 최적화된 방식으로 조회
    if (!message.parent) {
      const replyCounts = await this.countRepliesForMessages([message.id]);
      const dto = MessageResponseDto.fromEntity(message);
      dto.replyCount = replyCounts[message.id] || 0;
      return dto;
    }

    return MessageResponseDto.fromEntity(message);
  }

  /**
   * 새 메시지 생성
   */
  async createMessage(data: CreateMessageDto): Promise<MessageResponseDto> {
    this.logger.debug(
      `Creating message in room ${data.roomId} by user ${data.senderId}`,
      "MessagesService",
    );

    // Check if this is a reply to a reply
    if (data.parentId) {
      this.logger.debug(
        `Checking parent message with ID ${data.parentId}`,
        "MessagesService",
      );

      const parentMessage = await this.messageRepository.findOne({
        id: data.parentId,
      });
      if (!parentMessage) {
        this.logger.warn(
          `Parent message with ID ${data.parentId} not found`,
          "MessagesService",
        );
        throw new NotFoundException("Parent message not found");
      }

      // Check if parent message is already a reply
      if (parentMessage.parent) {
        this.logger.warn(
          `Attempted to reply to a reply (message ID: ${data.parentId})`,
          "MessagesService",
        );
        throw new BadRequestException(
          "Cannot reply to a reply message. Please reply to the original message instead.",
        );
      }
    }

    const message = await this.em.transactional(async (em) => {
      this.logger.logDatabase(
        "transaction",
        "Message",
        { operation: "create" },
        "MessagesService",
      );

      const sender = await em.findOneOrFail(User, { id: data.senderId });

      let parent = undefined;
      if (data.parentId) {
        parent = await em.findOne(Message, { id: data.parentId });
      }

      const message = new Message();
      message.room = data.roomId;
      message.sender = sender;
      if (parent) {
        message.parent = parent.id;
      }
      message.content = data.content;

      await em.persistAndFlush(message);
      this.logger.logDatabase(
        "persist",
        "Message",
        { id: message.id },
        "MessagesService",
      );

      // 멘션 처리
      const mentions = this.extractMentions(data.content);
      if (mentions.length > 0) {
        this.logger.debug(
          `Processing ${mentions.length} mentions in message`,
          "MessagesService",
        );
        await this.saveMentions(message.id, mentions);
      }

      return message;
    });

    // Reload the message with all relations
    this.logger.debug(
      `Reloading message with ID ${message.id} with all relations`,
      "MessagesService",
    );
    const loadedMessage = await this.messageRepository.findOneOrFail(
      { id: message.id },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );

    // 단일 메시지의 답글 수를 조회할 필요가 없음 (새로 생성된 메시지는 답글이 없음)
    const dto = MessageResponseDto.fromEntity(loadedMessage);

    // 만약 부모 메시지를 업데이트하는 경우 (답글을 추가한 경우), 부모 메시지의 답글 수를 업데이트할 필요가 있음
    // 그러나 이 시점에서는 클라이언트가 새로운 메시지만 요청하므로 replyCount는 0으로 설정
    if (!loadedMessage.parent) {
      dto.replyCount = 0;
    }

    this.logger.log(
      `Message created: ID ${message.id} in room ${data.roomId} by user ${data.senderId}`,
      "MessagesService",
    );
    return dto;
  }

  /**
   * 메시지 업데이트
   */
  async updateMessage(
    messageId: number,
    userId: number,
    data: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    this.logger.debug(
      `Updating message ${messageId} by user ${userId}`,
      "MessagesService",
    );

    const message = await this.messageRepository.findOne(
      { id: messageId },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );
    if (!message) {
      this.logger.warn(
        `Message with ID ${messageId} not found during update attempt`,
        "MessagesService",
      );
      throw new NotFoundException("메시지를 찾을 수 없습니다");
    }

    if (message.sender.id !== userId) {
      this.logger.warn(
        `Unauthorized message update attempt: user ${userId} tried to update message ${messageId} owned by user ${message.sender.id}`,
        "MessagesService",
      );
      throw new ForbiddenException("메시지를 수정할 권한이 없습니다");
    }

    // 이미 삭제된 메시지인지 확인
    if (message.isDeleted) {
      this.logger.warn(
        `Attempted to update deleted message with ID ${messageId}`,
        "MessagesService",
      );
      throw new ForbiddenException("삭제된 메시지는 수정할 수 없습니다");
    }

    // 메시지 업데이트
    message.content = data.content;

    await this.em.persistAndFlush(message);
    this.logger.logDatabase(
      "update",
      "Message",
      { id: messageId },
      "MessagesService",
    );

    // 기존 멘션 제거 및 새 멘션 추가
    await this.em.nativeDelete(Mention, { messageId: messageId });
    this.logger.logDatabase(
      "delete",
      "Mention",
      { messageId },
      "MessagesService",
    );

    const mentions = this.extractMentions(data.content);
    if (mentions.length > 0) {
      this.logger.debug(
        `Processing ${mentions.length} mentions in updated message`,
        "MessagesService",
      );
      await this.saveMentions(messageId, mentions);
    }

    // Reload message to get updated relations
    const updatedMessage = await this.messageRepository.findOneOrFail(
      { id: messageId },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );

    // 업데이트된 메시지에 대한 DTO 생성
    const dto = MessageResponseDto.fromEntity(updatedMessage);

    // 부모 메시지인 경우에만 답글 수 조회
    if (!updatedMessage.parent) {
      const replyCounts = await this.countRepliesForMessages([messageId]);
      dto.replyCount = replyCounts[messageId] || 0;
    }

    this.logger.log(
      `Message updated: ID ${messageId} by user ${userId}`,
      "MessagesService",
    );
    return dto;
  }

  /**
   * 메시지 삭제 (소프트 삭제)
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    this.logger.debug(
      `Deleting message ${messageId} by user ${userId}`,
      "MessagesService",
    );

    const message = await this.messageRepository.findOne(
      { id: messageId },
      {
        populate: ["sender"],
      },
    );
    if (!message) {
      this.logger.warn(
        `Message with ID ${messageId} not found during delete attempt`,
        "MessagesService",
      );
      throw new NotFoundException("메시지를 찾을 수 없습니다");
    }

    if (message.sender.id !== userId) {
      this.logger.warn(
        `Unauthorized message delete attempt: user ${userId} tried to delete message ${messageId} owned by user ${message.sender.id}`,
        "MessagesService",
      );
      throw new ForbiddenException("메시지를 삭제할 권한이 없습니다");
    }

    // 소프트 삭제 처리
    message.deletedAt = new Date();

    await this.em.persistAndFlush(message);
    this.logger.logDatabase(
      "softDelete",
      "Message",
      { id: messageId },
      "MessagesService",
    );

    this.logger.log(
      `Message soft-deleted: ID ${messageId} by user ${userId}`,
      "MessagesService",
    );
    return true;
  }

  /**
   * 메시지 리액션 토글
   */
  async toggleReaction(
    messageId: number,
    userId: number,
    emoji: string,
  ): Promise<MessageReactionResponseDto | null> {
    this.logger.debug(
      `Toggling reaction for message ${messageId}, user ${userId}, emoji "${emoji}"`,
      "MessagesService",
    );

    return this.em.transactional(async (em) => {
      this.logger.logDatabase(
        "transaction",
        "MessageReaction",
        { operation: "toggle" },
        "MessagesService",
      );

      const user = await em.findOneOrFail(User, { id: userId });

      // 기존 리액션 확인
      const existingReaction = await em.findOne(MessageReaction, {
        messageId: messageId,
        user: user,
        emoji: emoji,
      });

      // 있으면 제거, 없으면 추가
      if (existingReaction) {
        this.logger.debug(
          `Removing existing reaction ${existingReaction.id}`,
          "MessagesService",
        );
        await em.removeAndFlush(existingReaction);
        return null;
      } else {
        const reaction = new MessageReaction();
        reaction.messageId = messageId;
        reaction.user = user;
        reaction.emoji = emoji;

        await em.persistAndFlush(reaction);
        this.logger.logDatabase(
          "persist",
          "MessageReaction",
          { id: reaction.id },
          "MessagesService",
        );

        this.logger.debug(
          `Added new reaction to message ${messageId}`,
          "MessagesService",
        );
        return MessageReactionResponseDto.fromEntity(reaction);
      }
    });
  }

  /**
   * 메시지 내용에서 멘션 추출
   * @example "@username 안녕하세요" => ["username"]
   */
  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex) || [];
    return matches.map((match) => match.substring(1));
  }

  /**
   * 멘션 저장
   */
  async saveMentions(messageId: number, usernames: string[]): Promise<void> {
    // usernames를 유저 ID로 변환하여 멘션 저장
    for (const username of usernames) {
      const user = await this.em.findOne(User, { nickname: username });
      if (user) {
        const mention = new Mention();
        mention.messageId = messageId;
        mention.mentionedUser = user;

        await this.em.persist(mention);
        this.logger.logDatabase(
          "persist",
          "Mention",
          { messageId, userId: user.id },
          "MessagesService",
        );
      } else {
        this.logger.debug(
          `Mention for username "${username}" skipped - user not found`,
          "MessagesService",
        );
      }
    }

    await this.em.flush();
  }

  /**
   * 메시지 수정 권한 확인
   */
  async canEditMessage(userId: number, messageId: number): Promise<boolean> {
    const message = await this.messageRepository.findOne(
      { id: messageId },
      {
        populate: ["sender"],
      },
    );
    if (!message) {
      this.logger.debug(
        `Cannot edit message ${messageId}: message not found`,
        "MessagesService",
      );
      return false;
    }

    const canEdit = message.sender.id === userId && !message.isDeleted;
    this.logger.debug(
      `User ${userId} ${canEdit ? "can" : "cannot"} edit message ${messageId}`,
      "MessagesService",
    );
    return canEdit;
  }

  /**
   * 메시지 삭제 권한 확인
   */
  async canDeleteMessage(userId: number, messageId: number): Promise<boolean> {
    const message = await this.messageRepository.findOne(
      { id: messageId },
      {
        populate: ["sender"],
      },
    );
    if (!message) {
      this.logger.debug(
        `Cannot delete message ${messageId}: message not found`,
        "MessagesService",
      );
      return false;
    }

    const canDelete = message.sender.id === userId && !message.isDeleted;
    this.logger.debug(
      `User ${userId} ${
        canDelete ? "can" : "cannot"
      } delete message ${messageId}`,
      "MessagesService",
    );
    return canDelete;
  }

  /**
   * 여러 메시지의 답글 수를 한 번에 조회 (N+1 쿼리 문제 해결)
   */
  private async countRepliesForMessages(
    messageIds: number[],
  ): Promise<Record<number, number>> {
    if (messageIds.length === 0) {
      return {};
    }

    this.logger.debug(
      `Counting replies for ${messageIds.length} messages`,
      "MessagesService",
    );

    const results = await this.em.getConnection().execute(`
        SELECT parent_id, COUNT(*) as reply_count 
        FROM message 
        WHERE parent_id IN (${messageIds.join(",")}) 
        AND deleted_at IS NULL 
        GROUP BY parent_id
      `);

    this.logger.logDatabase(
      "query",
      "Message",
      { operation: "countReplies", messageIds },
      "MessagesService",
    );

    // 결과를 parentId를 키로 하는 객체로 변환
    const counts: Record<number, number> = {};
    for (const result of results) {
      counts[result.parent_id] = parseInt(result.reply_count);
    }

    // 결과가 없는 메시지는 0으로 설정
    for (const id of messageIds) {
      if (counts[id] === undefined) {
        counts[id] = 0;
      }
    }

    return counts;
  }

  /**
   * 여러 메시지를 DTO로 변환하고 답글 수 정보 포함
   */
  private async formatMessagesResponse(
    messages: Message[],
  ): Promise<MessageResponseDto[]> {
    if (messages.length === 0) {
      return [];
    }

    this.logger.debug(
      `Formatting response for ${messages.length} messages`,
      "MessagesService",
    );

    // 부모 메시지만 필터링 (답글은 제외)
    const parentMessageIds = messages
      .filter((message) => !message.parent)
      .map((message) => message.id);

    // 답글 수를 한 번에 조회
    const replyCounts = await this.countRepliesForMessages(parentMessageIds);

    // 각 메시지를 DTO로 변환하고 답글 수 추가
    return messages.map((message) => {
      const dto = MessageResponseDto.fromEntity(message);

      // 부모 메시지인 경우에만 답글 수 추가
      if (!message.parent) {
        dto.replyCount = replyCounts[message.id] || 0;
      }

      return dto;
    });
  }

  /**
   * 메시지 목록 조회
   */
  async findAll(
    filter: FilterQuery<Message> = {},
  ): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find(filter, {
      populate: [
        "sender",
        "reactions",
        "reactions.user",
        "mentions",
        "mentions.mentionedUser",
      ],
      orderBy: { createdAt: "ASC" },
    });

    return this.formatMessagesResponse(messages);
  }

  /**
   * 룸에 있는 메시지 조회
   */
  async findByRoom(roomId: number): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.find(
      { room: roomId, deletedAt: null },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
        orderBy: { createdAt: "ASC" },
      },
    );

    return this.formatMessagesResponse(messages);
  }

  /**
   * 답글 메시지 조회
   */
  async findReplies(parentId: number): Promise<MessageResponseDto[]> {
    const replies = await this.messageRepository.find(
      { parent: parentId, deletedAt: null },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
        orderBy: { createdAt: "ASC" },
      },
    );

    return this.formatMessagesResponse(replies);
  }

  /**
   * 메시지 생성
   */
  async create(data: {
    content: string;
    roomId: number;
    senderId: number;
    parentId?: number;
  }): Promise<MessageResponseDto> {
    const { content, roomId, senderId, parentId } = data;

    const sender = await this.userRepository.findOneOrFail({ id: senderId });

    const message = new Message();
    message.content = content;
    message.room = roomId;
    message.sender = sender;

    if (parentId) {
      const parent = await this.messageRepository.findOneOrFail({
        id: parentId,
      });
      message.parent = parent.id;
    }

    await this.em.persistAndFlush(message);

    // Reload the message with all relations
    const loadedMessage = await this.messageRepository.findOneOrFail(
      { id: message.id },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );

    // 새로 생성된 메시지에 대한 DTO 생성
    const dto = MessageResponseDto.fromEntity(loadedMessage);

    // 새 메시지는 답글이 없음 (부모 메시지인 경우)
    if (!loadedMessage.parent) {
      dto.replyCount = 0;
    }

    return dto;
  }

  /**
   * 메시지 업데이트
   */
  async update(id: number, content: string): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOneOrFail({ id });
    message.content = content;
    await this.em.flush();

    // Reload the message with all relations
    const updatedMessage = await this.messageRepository.findOneOrFail(
      { id },
      {
        populate: [
          "sender",
          "reactions",
          "reactions.user",
          "mentions",
          "mentions.mentionedUser",
        ],
      },
    );

    // 업데이트된 메시지에 대한 DTO 생성
    const dto = MessageResponseDto.fromEntity(updatedMessage);

    // 답글 수 처리
    if (!updatedMessage.parent) {
      const replyCounts = await this.countRepliesForMessages([id]);
      dto.replyCount = replyCounts[id] || 0;
    }

    return dto;
  }

  /**
   * 메시지 삭제
   */
  async delete(id: number): Promise<void> {
    const message = await this.messageRepository.findOneOrFail({ id });
    message.deletedAt = new Date();
    await this.em.flush();
  }

  /**
   * 메시지 리액션 추가
   */
  async addReaction(data: {
    messageId: number;
    userId: number;
    emoji: string;
  }): Promise<MessageReaction> {
    const { messageId, userId, emoji } = data;

    const user = await this.userRepository.findOneOrFail({ id: userId });

    // Check if reaction already exists
    const existingReaction = await this.messageReactionRepository.findOne({
      messageId: messageId,
      user: user,
      emoji: emoji,
    });

    if (existingReaction) {
      return existingReaction;
    }

    const reaction = new MessageReaction();
    reaction.messageId = messageId;
    reaction.user = user;
    reaction.emoji = emoji;

    await this.em.persistAndFlush(reaction);
    return reaction;
  }

  /**
   * 메시지 리액션 제거
   */
  async removeReaction(
    messageId: number,
    userId: number,
    emoji: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ id: userId });

    if (user) {
      const reaction = await this.messageReactionRepository.findOne({
        messageId: messageId,
        user: user,
        emoji: emoji,
      });

      if (reaction) {
        await this.em.removeAndFlush(reaction);
      }
    }
  }

  /**
   * 멘션 추가
   */
  async addMention(data: {
    messageId: number;
    mentionedUserId: number;
  }): Promise<Mention> {
    const { messageId, mentionedUserId } = data;

    const mentionedUser = await this.userRepository.findOneOrFail({
      id: mentionedUserId,
    });

    const mention = new Mention();
    mention.messageId = messageId;
    mention.mentionedUser = mentionedUser;

    await this.em.persistAndFlush(mention);
    return mention;
  }

  /**
   * 메시지의 답글 수 조회
   */
  async countReplies(messageId: number): Promise<number> {
    return this.messageRepository.count({
      parent: messageId,
      deletedAt: null,
    });
  }
}
