import { Options } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { User } from '../src/entities/User.entity';
import { Room } from '../src/entities/Room.entity';
import { RoomUser } from '../src/entities/RoomUser.entity';
import { Message } from '../src/entities/Message.entity';
import { MessageReaction } from '../src/entities/MessageReaction.entity';
import { Mention } from '../src/entities/Mention.entity';
import { RefreshToken } from '../src/entities';
import { format } from 'sql-formatter';

const testConfig: Options = {
  driver: SqliteDriver,
  dbName: ':memory:',
  entities: [User, Room, RoomUser, Message, MessageReaction, Mention, RefreshToken],
  debug: true,
  logger: (message: string) => {
    if (message.includes('[query]')) {
      // 1. [query] 헤더 제거
      const withoutQuery = message.trim().replace(/\[query\]\s*/, '');

      // 2. [took ...] 트레일 제거 및 보관
      const tookMatch = withoutQuery.match(/\s*\[took .+$/);
      const tookPart = tookMatch?.[0] ?? '';
      const sqlOnly = withoutQuery.replace(/\s*\[took .+$/, '').replace(/\u001b\[.*?m/g, '').trim();

      // 3. 포매팅
      const formatted = format(sqlOnly, { language: 'sqlite' });

      // 4. 원래 형식으로 조립해서 출력
      console.log(`[query]\n${formatted}${tookPart}`);
    } else {
      console.log(message);
    }
  },
  allowGlobalContext: true,
  discovery: {
    warnWhenNoEntities: true,
    requireEntitiesArray: false,
    alwaysAnalyseProperties: true,
    disableDynamicFileAccess: false
  },
  // Drop tables when initializing 
  forceUndefined: true,
  // Schema configuration
  schemaGenerator: {
    disableForeignKeys: true,
    createForeignKeyConstraints: false,
  },
  // Automatically generate entities
  migrations: {
    tableName: 'mikro_orm_migrations',
    path: './migrations',
    glob: '!(*.d).{js,ts}',
  },
};

export default testConfig; 