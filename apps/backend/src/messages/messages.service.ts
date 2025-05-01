import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EntityManager, QueryOrder, FilterQuery } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { 
  Message, 
  User, 
  Room, 
  Mention, 
  MessageReaction
} from '../entities';
import { MessageResponseDto } from '../entities/dto/message.dto';

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
 */
@Injectable()
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
  ) {}

  /**
   * 채팅방의 메시지 목록 조회
   */
  async getRoomMessages(roomId: number, limit = 20, offset = 0): Promise<Message[]> {
    return this.em.find(Message, { room: { id: roomId } }, {
      orderBy: { createdAt: QueryOrder.DESC },
      limit,
      offset,
      populate: ['sender', 'parent', 'reactions', 'reactions.user', 'mentions', 'mentions.mentionedUser']
    });
  }

  /**
   * 단일 메시지 조회
   */
  async getMessage(messageId: number): Promise<Message | null> {
    return this.messageRepository.findOne({ id: messageId }, {
      populate: ['sender', 'parent', 'reactions', 'reactions.user', 'mentions', 'mentions.mentionedUser']
    });
  }

  /**
   * 새 메시지 생성
   */
  async createMessage(data: CreateMessageDto): Promise<Message> {
    return this.em.transactional(async (em) => {
      const room = await em.findOneOrFail(Room, { id: data.roomId });
      const sender = await em.findOneOrFail(User, { id: data.senderId });
      
      let parent = undefined;
      if (data.parentId) {
        parent = await em.findOne(Message, { id: data.parentId });
      }
      
      const message = new Message();
      message.room = room;
      message.sender = sender;
      if (parent) {
        message.parent = parent;
      }
      message.content = data.content;
      
      await em.persistAndFlush(message);
      
      // 멘션 처리
      const mentions = this.extractMentions(data.content);
      if (mentions.length > 0) {
        await this.saveMentions(message.id, mentions);
      }
      
      return message;
    });
  }

  /**
   * 메시지 업데이트
   */
  async updateMessage(messageId: number, userId: number, data: UpdateMessageDto): Promise<Message> {
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new NotFoundException('메시지를 찾을 수 없습니다');
    }
    
    if (message.sender.id !== userId) {
      throw new ForbiddenException('메시지를 수정할 권한이 없습니다');
    }
    
    // 이미 삭제된 메시지인지 확인
    if (message.isDeleted) {
      throw new ForbiddenException('삭제된 메시지는 수정할 수 없습니다');
    }
    
    // 메시지 업데이트
    message.content = data.content;
    
    await this.em.persistAndFlush(message);
    
    // 기존 멘션 제거 및 새 멘션 추가
    await this.em.nativeDelete(Mention, { message: { id: messageId } });
    
    const mentions = this.extractMentions(data.content);
    if (mentions.length > 0) {
      await this.saveMentions(messageId, mentions);
    }
    
    return message;
  }

  /**
   * 메시지 삭제 (소프트 삭제)
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new NotFoundException('메시지를 찾을 수 없습니다');
    }
    
    if (message.sender.id !== userId) {
      throw new ForbiddenException('메시지를 삭제할 권한이 없습니다');
    }
    
    // 소프트 삭제 처리
    message.deletedAt = new Date();
    
    await this.em.persistAndFlush(message);
    return true;
  }

  /**
   * 메시지 리액션 토글
   */
  async toggleReaction(messageId: number, userId: number, emoji: string): Promise<MessageReaction | null> {
    return this.em.transactional(async (em) => {
      const message = await em.findOneOrFail(Message, { id: messageId });
      const user = await em.findOneOrFail(User, { id: userId });
      
      // 기존 리액션 확인
      const existingReaction = await em.findOne(MessageReaction, {
        message: { id: messageId },
        user: { id: userId },
        emoji
      });
      
      // 있으면 제거, 없으면 추가
      if (existingReaction) {
        await em.removeAndFlush(existingReaction);
        return null;
      } else {
        const reaction = new MessageReaction();
        reaction.message = message;
        reaction.user = user;
        reaction.emoji = emoji;
        
        await em.persistAndFlush(reaction);
        return reaction;
      }
    });
  }

  /**
   * 메시지 내용에서 멘션 추출
   * @example "@username 안녕하세요" => ["username"]
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex) || [];
    return matches.map(match => match.substring(1));
  }

  /**
   * 멘션 저장
   */
  async saveMentions(messageId: number, usernames: string[]): Promise<void> {
    // usernames를 유저 ID로 변환하여 멘션 저장
    for (const username of usernames) {
      const user = await this.em.findOne(User, { nickname: username });
      if (user) {
        const message = await this.em.findOneOrFail(Message, { id: messageId });
        const mention = new Mention();
        mention.message = message;
        mention.mentionedUser = user;
        
        await this.em.persist(mention);
      }
    }
    
    await this.em.flush();
  }

  /**
   * 메시지 수정 권한 확인
   */
  async canEditMessage(userId: number, messageId: number): Promise<boolean> {
    const message = await this.getMessage(messageId);
    if (!message) return false;
    
    return message.sender.id === userId && !message.isDeleted;
  }

  /**
   * 메시지 삭제 권한 확인
   */
  async canDeleteMessage(userId: number, messageId: number): Promise<boolean> {
    const message = await this.getMessage(messageId);
    if (!message) return false;
    
    return message.sender.id === userId && !message.isDeleted;
  }

  /**
   * 메시지를 DTO로 변환
   */
  formatMessageResponse(message: Message): MessageResponseDto {
    return MessageResponseDto.fromEntity(message);
  }

  /**
   * 메시지 목록 조회
   */
  async findAll(filter: FilterQuery<Message> = {}): Promise<Message[]> {
    return this.messageRepository.find(filter, { 
      populate: ['sender', 'reactions', 'reactions.user', 'mentions', 'mentions.mentionedUser'],
      orderBy: { createdAt: 'ASC' }
    });
  }

  /**
   * 룸에 있는 메시지 조회
   */
  async findByRoom(roomId: number): Promise<Message[]> {
    return this.messageRepository.find(
      { room: { id: roomId }, deletedAt: null },
      { 
        populate: ['sender', 'reactions', 'reactions.user', 'mentions', 'mentions.mentionedUser'],
        orderBy: { createdAt: 'ASC' }
      }
    );
  }

  /**
   * 답글 메시지 조회
   */
  async findReplies(parentId: number): Promise<Message[]> {
    return this.messageRepository.find(
      { parent: { id: parentId }, deletedAt: null },
      { 
        populate: ['sender', 'reactions', 'reactions.user', 'mentions', 'mentions.mentionedUser'],
        orderBy: { createdAt: 'ASC' } 
      }
    );
  }

  /**
   * 메시지 생성
   */
  async create(data: {
    content: string;
    roomId: number;
    senderId: number;
    parentId?: number;
  }): Promise<Message> {
    const { content, roomId, senderId, parentId } = data;
    
    const room = await this.roomRepository.findOneOrFail({ id: roomId });
    const sender = await this.userRepository.findOneOrFail({ id: senderId });
    
    const message = new Message();
    message.content = content;
    message.room = room;
    message.sender = sender;
    
    if (parentId) {
      const parent = await this.messageRepository.findOneOrFail({ id: parentId });
      message.parent = parent;
    }

    await this.em.persistAndFlush(message);
    return message;
  }

  /**
   * 메시지 업데이트
   */
  async update(id: number, content: string): Promise<Message> {
    const message = await this.messageRepository.findOneOrFail({ id });
    message.content = content;
    await this.em.flush();
    return message;
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
    
    const message = await this.messageRepository.findOneOrFail({ id: messageId });
    const user = await this.userRepository.findOneOrFail({ id: userId });
    
    // Check if reaction already exists
    const existingReaction = await this.messageReactionRepository.findOne({
      message: { id: messageId },
      user: { id: userId },
      emoji
    });
    
    if (existingReaction) {
      return existingReaction;
    }
    
    const reaction = new MessageReaction();
    reaction.message = message;
    reaction.user = user;
    reaction.emoji = emoji;
    
    await this.em.persistAndFlush(reaction);
    return reaction;
  }

  /**
   * 메시지 리액션 제거
   */
  async removeReaction(messageId: number, userId: number, emoji: string): Promise<void> {
    const reaction = await this.messageReactionRepository.findOne({
      message: { id: messageId },
      user: { id: userId },
      emoji
    });
    
    if (reaction) {
      await this.em.removeAndFlush(reaction);
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
    
    const message = await this.messageRepository.findOneOrFail({ id: messageId });
    const mentionedUser = await this.userRepository.findOneOrFail({ id: mentionedUserId });
    
    const mention = new Mention();
    mention.message = message;
    mention.mentionedUser = mentionedUser;
    
    await this.em.persistAndFlush(mention);
    return mention;
  }
} 