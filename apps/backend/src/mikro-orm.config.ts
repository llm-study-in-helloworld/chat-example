import { Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Mention } from './entities/Mention.entity';
import { Message } from './entities/Message.entity';
import { MessageReaction } from './entities/MessageReaction.entity';
import { Room } from './entities/Room.entity';
import { RoomUser } from './entities/RoomUser.entity';
import { User } from './entities/User.entity';

const config: Options<PostgreSqlDriver> = {
  driver: PostgreSqlDriver,
  dbName: process.env.DB_NAME || 'chat_app',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  entities: [User, Room, RoomUser, Message, MessageReaction, Mention],
  entitiesTs: ['src/**/*.entity.ts'],
  debug: process.env.NODE_ENV !== 'production',
  migrations: {
    tableName: 'mikro_migrations',
    path: 'dist/migrations',
    pathTs: 'src/migrations',
  },
  schemaGenerator: {
    disableForeignKeys: true,
    createForeignKeyConstraints: false,
  },
  seeder: {
    path: 'dist/seeders',
    pathTs: 'src/seeders',
  },
  // TS: false로 설정하면 엔티티 불변성 체크를 하지 않아 ManyToOne에서 타입 오류 줄어듦
  strict: false,
};

export default config; 