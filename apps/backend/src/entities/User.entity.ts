import { BaseUser } from "@chat-example/types";
import {
  Collection,
  Entity,
  Index,
  OneToMany,
  Property,
  Reference,
} from "@mikro-orm/core";
import * as bcrypt from "bcrypt";
import { CommonEntity } from "./CommonEntity";
import { Message } from "./Message.entity";
import { RoomUser } from "./RoomUser.entity";

/**
 * 채팅 애플리케이션의 사용자 엔티티
 * 사용자 인증 정보 및 기본 프로필 정보를 저장
 */
@Entity()
@Index({ properties: ["email"] })
export class User extends CommonEntity implements BaseUser {
  @Property({ unique: true })
  email!: string;

  @Property()
  passwordHash!: string;

  @Property()
  nickname!: string;

  @Property({ nullable: true })
  imageUrl?: string;

  @OneToMany({
    entity: () => RoomUser,
    mappedBy: "user",
    eager: false,
    persist: false,
  })
  roomUsers = new Collection<RoomUser>(this);

  @OneToMany({
    entity: () => Message,
    mappedBy: "sender",
    eager: false,
    persist: false,
  })
  messages = new Collection<Message>(this);

  /**
   * 사용자가 참여한 모든 채팅방의 참조값 배열을 반환
   */
  get rooms(): Reference<RoomUser>[] {
    return this.roomUsers
      .getItems()
      .map((roomUser) => Reference.create(roomUser));
  }

  /**
   * 사용자가 작성한 모든 메시지의 참조값 배열을 반환
   */
  get sentMessages(): Reference<Message>[] {
    return this.messages.getItems().map((message) => Reference.create(message));
  }

  /**
   * Returns user as MessageUser for use in responses
   */
  get asMessageUser(): { id: number; nickname: string; imageUrl?: string } {
    return {
      id: this.id,
      nickname: this.nickname,
      imageUrl: this.imageUrl,
    };
  }

  /**
   * Verify if provided password matches the stored hash
   */
  async verifyPassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.passwordHash);
  }
}
