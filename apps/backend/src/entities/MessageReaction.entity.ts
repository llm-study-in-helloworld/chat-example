import { BaseReaction } from "@chat-example/types";
import { Entity, Index, ManyToOne, Property } from "@mikro-orm/core";
import { CommonEntity } from "./CommonEntity";
import { Message } from "./Message.entity";
import { User } from "./User.entity";

/**
 * 메시지에 대한 이모티콘 반응 정보를 저장하는 엔티티
 */
@Entity()
@Index({ properties: ["messageId", "emoji"] })
@Index({ properties: ["messageId", "user"] })
export class MessageReaction extends CommonEntity implements BaseReaction {
  @ManyToOne({
    entity: () => Message,
    persist: true,
    mapToPk: true,
    fieldName: "message_id",
  })
  messageId!: number;

  @ManyToOne({
    entity: () => User,
    persist: true,
    fieldName: "user_id",
  })
  user!: User;

  get userId(): number {
    return this.user.id;
  }

  @Property()
  emoji!: string;

  /**
   * 이 리액션이 특정 사용자의 것인지 확인
   */
  isOwnedBy(userId: number): boolean {
    return this.user.id === userId;
  }
}
