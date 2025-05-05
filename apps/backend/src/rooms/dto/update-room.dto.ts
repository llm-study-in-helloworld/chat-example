import { UpdateRoomRequest } from "@chat-example/types";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Room } from "../../entities";

/**
 * DTO for updating a chat room
 */
export class UpdateRoomRequestDto implements UpdateRoomRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /**
   * Applies the update values to a Room entity
   * @param room The room entity to update
   * @returns The updated room entity
   */
  applyTo(room: Room): Room {
    if (this.name !== undefined) {
      room.name = this.name;
    }

    if (this.description !== undefined) {
      room.description = this.description;
    }

    if (this.imageUrl !== undefined) {
      room.imageUrl = this.imageUrl;
    }

    if (this.isPrivate !== undefined) {
      room.isPrivate = this.isPrivate;
    }

    if (this.isActive !== undefined) {
      room.isActive = this.isActive;
    }

    return room;
  }
}
