import { Migration } from '@mikro-orm/migrations';

export class Migration20250503053419 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "room" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) null, "is_group" boolean not null);`);

    this.addSql(`create table "user" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "email" varchar(255) not null, "password_hash" varchar(255) not null, "nickname" varchar(255) not null, "image_url" varchar(255) null);`);
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);
    this.addSql(`create index "user_email_index" on "user" ("email");`);

    this.addSql(`create table "room_user" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "room_id" int not null, "user_id" int not null, "joined_at" timestamptz not null, "last_seen_at" timestamptz null);`);
    this.addSql(`create index "room_user_room_id_last_seen_at_index" on "room_user" ("room_id", "last_seen_at");`);
    this.addSql(`create index "room_user_user_id_room_id_index" on "room_user" ("user_id", "room_id");`);

    this.addSql(`create table "refresh_token" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "token" uuid not null, "user_id" int not null, "issued_at" timestamptz not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "is_revoked" boolean not null default false, "user_agent" text null, "ip_address" text null);`);
    this.addSql(`create index "refresh_token_token_index" on "refresh_token" ("token");`);

    this.addSql(`create table "message" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "room_id" int not null, "sender_id" int not null, "parent_id" int null, "content" varchar(255) not null, "deleted_at" timestamptz null);`);
    this.addSql(`create index "message_sender_id_index" on "message" ("sender_id");`);
    this.addSql(`create index "message_parent_id_index" on "message" ("parent_id");`);
    this.addSql(`create index "message_room_id_created_at_index" on "message" ("room_id", "created_at");`);

    this.addSql(`create table "message_reaction" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "message_id" int not null, "user_id" int not null, "emoji" varchar(255) not null);`);
    this.addSql(`create index "message_reaction_message_id_user_id_index" on "message_reaction" ("message_id", "user_id");`);
    this.addSql(`create index "message_reaction_message_id_emoji_index" on "message_reaction" ("message_id", "emoji");`);

    this.addSql(`create table "mention" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "message_id" int not null, "mentioned_user_id" int not null);`);
    this.addSql(`create index "mention_mentioned_user_id_index" on "mention" ("mentioned_user_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "room" cascade;`);

    this.addSql(`drop table if exists "user" cascade;`);

    this.addSql(`drop table if exists "room_user" cascade;`);

    this.addSql(`drop table if exists "refresh_token" cascade;`);

    this.addSql(`drop table if exists "message" cascade;`);

    this.addSql(`drop table if exists "message_reaction" cascade;`);

    this.addSql(`drop table if exists "mention" cascade;`);
  }

}
