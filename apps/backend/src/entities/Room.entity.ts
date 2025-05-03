import { BaseRoom } from '@chat-example/types';
import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property,
  Reference
} from '@mikro-orm/core';
import { CommonEntity } from './CommonEntity';
import { Message } from './Message.entity';
import { RoomUser } from './RoomUser.entity';
import { User } from './User.entity';

/**
 * 채팅방 정보를 저장하는 엔티티
 * 일대일 대화 또는 그룹 채팅방을 나타냄
 */
@Entity()
export class Room extends CommonEntity implements Omit<BaseRoom, 'name' | 'description' | 'imageUrl'> {
  @Property({ nullable: true })
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  imageUrl?: string;

  @Property()
  isGroup!: boolean;

  @Property()
  isPrivate!: boolean;

  @Property()
  isDirect!: boolean;

  @Property()
  isActive!: boolean;

  @ManyToOne({
    entity: () => User,
    fieldName: 'owner_id',
    eager: true,
    persist: true,
  })
  owner!: User;

  /**
   * Implementation of ownerId from BaseRoom
   */
  get ownerId(): number {
    return this.owner.id;
  }

  @OneToMany({
    entity: () => RoomUser,
    mappedBy: 'room',
    eager: false,
    persist: false,
  })
  roomUsers = new Collection<RoomUser>(this);

  @OneToMany({
    entity: () => Message,
    mappedBy: 'room',
    eager: false,
    persist: false,
  })
  messages = new Collection<Message>(this);

  /**
   * 채팅방에 참여한 모든 사용자의 참조값 배열을 반환
   */
  get users(): Reference<RoomUser>[] {
    return this.roomUsers.getItems().map(roomUser => Reference.create(roomUser));
  }

  /**
   * Return the number of participants in the room
   */
  get participantCount(): number {
    return this.roomUsers.count();
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