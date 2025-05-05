import { BaseRoom } from "@chat-example/types";
import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from "@mikro-orm/core";
import { CommonEntity } from "./CommonEntity";
import { Message } from "./Message.entity";
import { RoomUser } from "./RoomUser.entity";
import { User } from "./User.entity";

/**
 * 채팅방 정보를 저장하는 엔티티
 * 일대일 대화 또는 그룹 채팅방을 나타냄
 */
@Entity()
export class Room extends CommonEntity implements BaseRoom {
  @Property({ nullable: true })
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  imageUrl?: string;

  @Property()
  isPrivate!: boolean;

  @Property()
  isDirect!: boolean;

  @Property()
  isActive!: boolean;

  @ManyToOne({
    entity: () => User,
    fieldName: "owner_id",
    mapToPk: true,
    persist: true,
  })
  ownerId!: number;

  @OneToMany({
    entity: () => RoomUser,
    mappedBy: "room",
    eager: false,
    persist: false,
  })
  roomUsers = new Collection<RoomUser>(this);

  @OneToMany({
    entity: () => Message,
    mappedBy: "room",
    eager: false,
    persist: false,
  })
  messages = new Collection<Message>(this);
}
