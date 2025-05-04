import { Migration } from '@mikro-orm/migrations';

export class Migration20250504044126 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "room" add column "description" varchar(255) null, add column "image_url" varchar(255) null, add column "is_direct" boolean not null, add column "is_active" boolean not null, add column "owner_id" int not null;`);
    this.addSql(`alter table "room" rename column "is_group" to "is_private";`);

    this.addSql(`alter table "room_user" add column "role" varchar(255) not null default 'member';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "room" drop constraint "room_owner_id_foreign";`);

    this.addSql(`alter table "room" drop column "description", drop column "image_url", drop column "is_direct", drop column "is_active", drop column "owner_id";`);

    this.addSql(`alter table "room" rename column "is_private" to "is_group";`);

    this.addSql(`alter table "room_user" drop column "role";`);
  }

}
