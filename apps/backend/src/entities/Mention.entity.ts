import { 
  Entity,
  ManyToOne,
  Index 
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { Message } from './Message.entity';
import { User } from './User.entity';

/**
 * 메시지 내 사용자 멘션 정보를 저장하는 엔티티
 */
@Entity()
@Index({ properties: ['mentionedUser'] })
export class Mention extends BaseEntity {
  @ManyToOne({
    entity: () => Message,
    persist: false
  })
  message!: Message;

  @ManyToOne({
    entity: () => User,
    persist: false
  })
  mentionedUser!: User;

  /**
   * 특정 사용자가 멘션된 대상인지 확인
   */
  isMentionedUser(userId: number): boolean {
    return this.mentionedUser.id === userId;
  }
} 