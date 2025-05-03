import { UpdateRoomRequest } from '@chat-example/types';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
} 