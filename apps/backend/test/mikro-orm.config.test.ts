import { Options } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { User } from '../src/entities/User.entity';
import { Room } from '../src/entities/Room.entity';
import { RoomUser } from '../src/entities/RoomUser.entity';
import { Message } from '../src/entities/Message.entity';
import { MessageReaction } from '../src/entities/MessageReaction.entity';
import { Mention } from '../src/entities/Mention.entity';

const testConfig: Options = {
  driver: SqliteDriver,
  dbName: ':memory:',
  entities: [User, Room, RoomUser, Message, MessageReaction, Mention],
  debug: true,
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