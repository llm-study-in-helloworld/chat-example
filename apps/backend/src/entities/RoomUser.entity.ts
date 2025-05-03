import { RoomUser as IRoomUser, RoomRole } from '@chat-example/types';
import {
  Entity,
  Index,
  ManyToOne,
  Property
} from '@mikro-orm/core';
import { CommonEntity } from './CommonEntity';
import { Room } from './Room.entity';
import { User } from './User.entity';

/**
 * 채팅방과 사용자 간의 다대다 관계를 저장하는 엔티티
 * 채팅방 참여 정보와 마지막 읽은 시간을 관리
 */
@Entity()
@Index({ properties: ['user', 'room'] })
@Index({ properties: ['room', 'lastSeenAt'] })
export class RoomUser extends CommonEntity implements Omit<IRoomUser, 'role' | 'joinedAt'> {
  @Property()
  isOwner!: boolean;

  @Property()
  isAdmin!: boolean;

  @ManyToOne({
    entity: () => Room,
    persist: true,
    fieldName: 'room_id'
  })
  room!: Room;

  get roomId(): number {
    return this.room.id;
  }

  @ManyToOne({
    entity: () => User,
    persist: true,
    fieldName: 'user_id'
  })
  user!: User;

  get userId(): number {
    return this.user.id;
  }

  /**
   * Get the role of the user in the room
   */
  get role(): RoomRole {
    if (this.isOwner) return RoomRole.OWNER;
    if (this.isAdmin) return RoomRole.ADMIN;
    return RoomRole.MEMBER;
  }

  @Property()
  joinedAt: Date = new Date();

  /**
   * Get the joined date as ISO string
   */
  get joinedAtString(): string {
    return this.joinedAt.toISOString();
  }

  @Property({ nullable: true })
  lastSeenAt?: Date;

  /**
   * 읽지 않은 메시지 여부를 확인
   * 마지막으로 읽은 시간이 있을 경우만 확인 가능
   */
  hasUnreadMessages(lastMessageDate?: Date): boolean {
    if (!this.lastSeenAt || !lastMessageDate) return true;
    return this.lastSeenAt < lastMessageDate;
  }

  /**
   * 마지막으로 읽은 시간 업데이트
   */
  updateLastSeen(): void {
    this.lastSeenAt = new Date();
  }
} 