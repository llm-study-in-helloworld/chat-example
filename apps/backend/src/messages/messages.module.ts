import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { Mention, Message, MessageReaction, Room, User } from '../entities';
import { LoggerModule } from '../logger/logger.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    MikroOrmModule.forFeature({ entities: [Message, MessageReaction, Mention, Room, User] }),
    LoggerModule,
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {} 