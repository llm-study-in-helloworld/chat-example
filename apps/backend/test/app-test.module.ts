import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { RoomsModule } from '../src/rooms/rooms.module';
import { MessagesModule } from '../src/messages/messages.module';
import { ChatGateway } from '../src/gateway/chat.gateway';
import { User, Room, RoomUser, Message, MessageReaction, Mention, RefreshToken } from '../src/entities';
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
    RoomsModule,
    MessagesModule,
  ],
  providers: [ChatGateway],
})
export class AppTestModule {} 