import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../src/auth/auth.module";
import {
  Mention,
  Message,
  MessageReaction,
  RefreshToken,
  Room,
  RoomUser,
  User,
} from "../src/entities";
import { GatewayModule } from "../src/gateway/gateway.module";
import { LoggerModule } from "../src/logger/logger.module";
import { MessagesModule } from "../src/messages/messages.module";
import { RoomsModule } from "../src/rooms/rooms.module";
import { UsersModule } from "../src/users/users.module";
import testConfig from "./mikro-orm.config.test";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    LoggerModule,
    MikroOrmModule.forRoot(testConfig),
    MikroOrmModule.forFeature({
      entities: [
        User,
        Room,
        RoomUser,
        Message,
        MessageReaction,
        Mention,
        RefreshToken,
      ],
    }),
    UsersModule,
    AuthModule,
    RoomsModule,
    MessagesModule,
    GatewayModule,
  ],
})
export class AppTestModule {}
