import { Migration } from "@mikro-orm/migrations";

export class Migration20250504115035 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table \`user\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`email\` varchar(255) not null, \`password_hash\` varchar(255) not null, \`nickname\` varchar(255) not null, \`image_url\` varchar(255) null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`user\` add unique \`user_email_unique\`(\`email\`);`,
    );
    this.addSql(
      `alter table \`user\` add index \`user_email_index\`(\`email\`);`,
    );

    this.addSql(
      `create table \`room\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`name\` varchar(255) null, \`description\` varchar(255) null, \`image_url\` varchar(255) null, \`is_private\` tinyint(1) not null, \`is_direct\` tinyint(1) not null, \`is_active\` tinyint(1) not null, \`owner_id\` int unsigned not null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`room\` add index \`room_owner_id_index\`(\`owner_id\`);`,
    );

    this.addSql(
      `create table \`room_user\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`room_id\` int unsigned not null, \`user_id\` int unsigned not null, \`role\` varchar(255) not null default 'member', \`joined_at\` datetime not null, \`last_seen_at\` datetime null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`room_user\` add index \`room_user_room_id_index\`(\`room_id\`);`,
    );
    this.addSql(
      `alter table \`room_user\` add index \`room_user_user_id_index\`(\`user_id\`);`,
    );
    this.addSql(
      `alter table \`room_user\` add index \`room_user_room_id_last_seen_at_index\`(\`room_id\`, \`last_seen_at\`);`,
    );
    this.addSql(
      `alter table \`room_user\` add index \`room_user_user_id_room_id_index\`(\`user_id\`, \`room_id\`);`,
    );

    this.addSql(
      `create table \`refresh_token\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`token\` varchar(36) not null, \`user_id\` int unsigned not null, \`issued_at\` datetime not null, \`expires_at\` datetime not null, \`revoked_at\` datetime null, \`is_revoked\` tinyint(1) not null default false, \`user_agent\` text null, \`ip_address\` text null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`refresh_token\` add index \`refresh_token_token_index\`(\`token\`);`,
    );
    this.addSql(
      `alter table \`refresh_token\` add index \`refresh_token_user_id_index\`(\`user_id\`);`,
    );

    this.addSql(
      `create table \`message\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`room_id\` int unsigned not null, \`sender_id\` int unsigned not null, \`parent_id\` int unsigned null, \`content\` varchar(255) not null, \`deleted_at\` datetime null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`message\` add index \`message_room_id_index\`(\`room_id\`);`,
    );
    this.addSql(
      `alter table \`message\` add index \`message_sender_id_index\`(\`sender_id\`);`,
    );
    this.addSql(
      `alter table \`message\` add index \`message_parent_id_index\`(\`parent_id\`);`,
    );
    this.addSql(
      `alter table \`message\` add index \`message_room_id_created_at_index\`(\`room_id\`, \`created_at\`);`,
    );

    this.addSql(
      `create table \`message_reaction\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`message_id\` int unsigned not null, \`user_id\` int unsigned not null, \`emoji\` varchar(255) not null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`message_reaction\` add index \`message_reaction_message_id_index\`(\`message_id\`);`,
    );
    this.addSql(
      `alter table \`message_reaction\` add index \`message_reaction_user_id_index\`(\`user_id\`);`,
    );
    this.addSql(
      `alter table \`message_reaction\` add index \`message_reaction_message_id_user_id_index\`(\`message_id\`, \`user_id\`);`,
    );
    this.addSql(
      `alter table \`message_reaction\` add index \`message_reaction_message_id_emoji_index\`(\`message_id\`, \`emoji\`);`,
    );

    this.addSql(
      `create table \`mention\` (\`id\` int unsigned not null auto_increment primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`message_id\` int unsigned not null, \`mentioned_user_id\` int unsigned not null) default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(
      `alter table \`mention\` add index \`mention_message_id_index\`(\`message_id\`);`,
    );
    this.addSql(
      `alter table \`mention\` add index \`mention_mentioned_user_id_index\`(\`mentioned_user_id\`);`,
    );

    this.addSql(
      `alter table \`room\` add constraint \`room_owner_id_foreign\` foreign key (\`owner_id\`) references \`user\` (\`id\`) on update cascade;`,
    );

    this.addSql(
      `alter table \`room_user\` add constraint \`room_user_room_id_foreign\` foreign key (\`room_id\`) references \`room\` (\`id\`) on update cascade;`,
    );
    this.addSql(
      `alter table \`room_user\` add constraint \`room_user_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    );

    this.addSql(
      `alter table \`refresh_token\` add constraint \`refresh_token_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    );

    this.addSql(
      `alter table \`message\` add constraint \`message_room_id_foreign\` foreign key (\`room_id\`) references \`room\` (\`id\`) on update cascade;`,
    );
    this.addSql(
      `alter table \`message\` add constraint \`message_sender_id_foreign\` foreign key (\`sender_id\`) references \`user\` (\`id\`) on update cascade;`,
    );
    this.addSql(
      `alter table \`message\` add constraint \`message_parent_id_foreign\` foreign key (\`parent_id\`) references \`message\` (\`id\`) on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table \`message_reaction\` add constraint \`message_reaction_message_id_foreign\` foreign key (\`message_id\`) references \`message\` (\`id\`) on update cascade;`,
    );
    this.addSql(
      `alter table \`message_reaction\` add constraint \`message_reaction_user_id_foreign\` foreign key (\`user_id\`) references \`user\` (\`id\`) on update cascade;`,
    );

    this.addSql(
      `alter table \`mention\` add constraint \`mention_message_id_foreign\` foreign key (\`message_id\`) references \`message\` (\`id\`) on update cascade;`,
    );
    this.addSql(
      `alter table \`mention\` add constraint \`mention_mentioned_user_id_foreign\` foreign key (\`mentioned_user_id\`) references \`user\` (\`id\`) on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table \`room\` drop foreign key \`room_owner_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`room_user\` drop foreign key \`room_user_user_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`refresh_token\` drop foreign key \`refresh_token_user_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`message\` drop foreign key \`message_sender_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`message_reaction\` drop foreign key \`message_reaction_user_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`mention\` drop foreign key \`mention_mentioned_user_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`room_user\` drop foreign key \`room_user_room_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`message\` drop foreign key \`message_room_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`message\` drop foreign key \`message_parent_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`message_reaction\` drop foreign key \`message_reaction_message_id_foreign\`;`,
    );

    this.addSql(
      `alter table \`mention\` drop foreign key \`mention_message_id_foreign\`;`,
    );

    this.addSql(`drop table if exists \`user\`;`);

    this.addSql(`drop table if exists \`room\`;`);

    this.addSql(`drop table if exists \`room_user\`;`);

    this.addSql(`drop table if exists \`refresh_token\`;`);

    this.addSql(`drop table if exists \`message\`;`);

    this.addSql(`drop table if exists \`message_reaction\`;`);

    this.addSql(`drop table if exists \`mention\`;`);
  }
}
