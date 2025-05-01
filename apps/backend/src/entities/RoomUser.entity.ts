import { 
  Entity, 
  ManyToOne, 
  Property,
  Index 
} from '@mikro-orm/core';
import { Room } from './Room.entity';
import { User } from './User.entity';

/**
 * 채팅방과 사용자 간의 다대다 관계를 저장하는 엔티티
 * 채팅방 참여 정보와 마지막 읽은 시간을 관리
 */
@Entity()
@Index({ properties: ['user', 'room'] })
@Index({ properties: ['room', 'lastSeenAt'] })
export class RoomUser {
  @ManyToOne({
    entity: () => Room,
    primary: true,
    persist: false
  })
  room!: Room;

  @ManyToOne({
    entity: () => User,
    primary: true,
    persist: false
  })
  user!: User;

  @Property()
  joinedAt: Date = new Date();

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