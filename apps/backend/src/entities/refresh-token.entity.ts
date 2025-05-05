import { Entity, Index, ManyToOne, Property } from "@mikro-orm/core";
import { v4 as uuidv4 } from "uuid";
import { CommonEntity } from "./CommonEntity";
import { User } from "./User.entity";

@Entity()
export class RefreshToken extends CommonEntity {
  @Property({ type: "uuid" })
  @Index()
  token: string = uuidv4();

  @ManyToOne(() => User, {
    persist: true,
    fieldName: "user_id",
    eager: true,
  })
  user: User;

  @Property()
  issuedAt: Date = new Date();

  @Property()
  expiresAt: Date;

  @Property({ nullable: true })
  revokedAt?: Date;

  @Property({ default: false })
  isRevoked: boolean = false;

  @Property({ type: "text", nullable: true })
  userAgent?: string;

  @Property({ type: "text", nullable: true })
  ipAddress?: string;

  constructor(
    user: User,
    expiresInDays: number = 30,
    userAgent?: string,
    ipAddress?: string,
  ) {
    super();
    this.user = user;
    this.expiresAt = new Date();
    this.expiresAt.setDate(this.expiresAt.getDate() + expiresInDays);
    this.userAgent = userAgent;
    this.ipAddress = ipAddress;
  }

  revoke(): void {
    this.isRevoked = true;
    this.revokedAt = new Date();
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isValid(): boolean {
    return !this.isRevoked && !this.isExpired();
  }
}
