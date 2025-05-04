import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/auth/auth.module';
import { Mention, Message, MessageReaction, RefreshToken, Room, RoomUser, User } from '../src/entities';
import { ChatGateway } from '../src/gateway/chat.gateway';
import { LoggerModule } from '../src/logger';
import { MessagesModule } from '../src/messages/messages.module';
import { RoomsModule } from '../src/rooms/rooms.module';
import { UsersModule } from '../src/users/users.module';
import testConfig from './mikro-orm.config.test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MikroOrmModule.forRoot(testConfig),
    MikroOrmModule.forFeature({
      entities: [User, Room, RoomUser, Message, MessageReaction, Mention, RefreshToken]
    }),
    UsersModule,
    AuthModule,
    LoggerModule,
    RoomsModule,
    MessagesModule,
  ],
  providers: [ChatGateway],
})
export class AppTestModule {} 