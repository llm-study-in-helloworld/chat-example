import { 
  Entity,
  ManyToOne, 
  Property, 
  OneToMany, 
  Collection,
  Index,
  Reference
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { Room } from './Room.entity';
import { User } from './User.entity';
import { MessageReaction } from './MessageReaction.entity';
import { Mention } from './Mention.entity';

/**
 * 채팅 메시지 정보를 저장하는 엔티티
 */
@Entity()
@Index({ properties: ['room', 'createdAt'] })
@Index({ properties: ['parent'] })
@Index({ properties: ['sender'] })
export class Message extends BaseEntity {
  @ManyToOne({
    entity: () => Room,
    persist: true,
    fieldName: 'room_id'
  })
  room!: Room;

  @ManyToOne({
    entity: () => User,
    persist: true,
    fieldName: 'sender_id'
  })
  sender!: User;

  @ManyToOne({
    entity: () => Message,
    nullable: true,
    persist: true,
    fieldName: 'parent_id'
  })
  parent?: Message;

  @Property()
  content!: string;

  @Property({ nullable: true })
  deletedAt?: Date;

  @OneToMany({
    entity: () => MessageReaction,
    mappedBy: 'message',
    eager: false,
    persist: false,
  })
  reactions = new Collection<MessageReaction>(this);

  @OneToMany({
    entity: () => Mention,
    mappedBy: 'message',
    eager: false,
    persist: false,
  })
  mentions = new Collection<Mention>(this);

  /**
   * 메시지의 모든 반응 참조값 배열을 반환
   */
  get allReactions(): Reference<MessageReaction>[] {
    return this.reactions.getItems().map(reaction => Reference.create(reaction));
  }

  /**
   * 메시지의 모든 멘션 참조값 배열을 반환
   */
  get allMentions(): Reference<Mention>[] {
    return this.mentions.getItems().map(mention => Reference.create(mention));
  }

  /**
   * 메시지가 삭제되었는지 확인
   */
  get isDeleted(): boolean {
    return this.deletedAt !== undefined && this.deletedAt !== null;
  }

  /**
   * 메시지 내용 (삭제된 경우 '삭제된 메시지' 반환)
   */
  get displayContent(): string {
    if (this.isDeleted) {
      return '삭제된 메시지';
    }
    return this.content;
  }
} 