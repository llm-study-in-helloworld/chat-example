import { 
  Entity,
  ManyToOne, 
  Property,
  Index 
} from '@mikro-orm/core';
import { CommonEntity } from './CommonEntity';
import { Message } from './Message.entity';
import { User } from './User.entity';

/**
 * 메시지에 대한 이모티콘 반응 정보를 저장하는 엔티티
 */
@Entity()
@Index({ properties: ['message', 'emoji'] })
@Index({ properties: ['message', 'user'] })
export class MessageReaction extends CommonEntity {
  @ManyToOne({
    entity: () => Message,
    persist: true,
    mapToPk: true,
    fieldName: 'message_id'
  })
  message!: Message;

  @ManyToOne({
    entity: () => User,
    persist: true,
    mapToPk: true,
    fieldName: 'user_id'
  })
  user!: User;

  @Property()
  emoji!: string;

  /**
   * 이 리액션이 특정 사용자의 것인지 확인
   */
  isOwnedBy(userId: number): boolean {
    return this.user.id === userId;
  }
} 