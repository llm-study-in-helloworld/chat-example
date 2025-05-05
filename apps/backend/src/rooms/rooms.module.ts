import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Room, RoomUser, User } from "../entities";
import { LoggerModule } from "../logger/logger.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [
    MikroOrmModule.forFeature({ entities: [Room, RoomUser, User] }),
    LoggerModule,
  ],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
