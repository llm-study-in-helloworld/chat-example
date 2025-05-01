import { 
  Entity,
  Property, 
  OneToMany, 
  Collection,
  Reference
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { RoomUser } from './RoomUser.entity';
import { Message } from './Message.entity';

/**
 * 채팅방 정보를 저장하는 엔티티
 * 일대일 대화 또는 그룹 채팅방을 나타냄
 */
@Entity()
export class Room extends BaseEntity {
  @Property({ nullable: true })
  name?: string;

  @Property()
  isGroup!: boolean;

  @OneToMany({
    entity: () => RoomUser,
    mappedBy: 'room',
    eager: false,
    persist: false
  })
  roomUsers = new Collection<RoomUser>(this);

  @OneToMany({
    entity: () => Message,
    mappedBy: 'room',
    eager: false,
    persist: false
  })
  messages = new Collection<Message>(this);

  /**
   * 채팅방에 참여한 모든 사용자의 참조값 배열을 반환
   */
  get users(): Reference<RoomUser>[] {
    return this.roomUsers.getItems().map(roomUser => Reference.create(roomUser));
  }

  /**
   * 채팅방의 모든 메시지 참조값 배열을 반환
   */
  get allMessages(): Reference<Message>[] {
    return this.messages.getItems().map(message => Reference.create(message));
  }

  /**
   * 채팅방의 최신 메시지를 반환
   */
  get lastMessage(): Message | null {
    const messages = this.messages.getItems();
    if (messages.length === 0) return null;
    
    return messages.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0];
  }
} 