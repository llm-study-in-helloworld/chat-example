import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import * as entities from './entities';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger';
import { MessagesModule } from './messages/messages.module';
import mikroOrmConfig from './mikro-orm.config';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature({
      entities: Object.values(entities)
    }),
    UsersModule,
    AuthModule,
    RoomsModule,
    MessagesModule,
    GatewayModule,
    HealthModule,
  ],
})
export class AppModule {} 