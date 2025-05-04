import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
import { MessagesModule } from '../messages/messages.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    AuthModule,
    MessagesModule,
    RoomsModule,
    LoggerModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {} 