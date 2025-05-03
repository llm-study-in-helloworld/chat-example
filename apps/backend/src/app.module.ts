import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { MessagesModule } from './messages/messages.module';
import { GatewayModule } from './gateway/gateway.module';
import mikroOrmConfig from './mikro-orm.config';
import * as entities from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature({
      entities: Object.values(entities)
    }),
    UsersModule,
    AuthModule,
    RoomsModule,
    MessagesModule,
    GatewayModule,
  ],
})
export class AppModule {} 