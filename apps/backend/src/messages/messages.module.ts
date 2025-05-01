import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Message, MessageReaction, Mention, Room, User } from '../entities';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    MikroOrmModule.forFeature({ entities: [Message, MessageReaction, Mention, Room, User] }),
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {} 