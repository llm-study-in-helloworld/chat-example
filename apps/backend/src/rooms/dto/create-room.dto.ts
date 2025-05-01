import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * DTO for creating a new chat room
 */
export class CreateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsNotEmpty()
  isGroup!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  userIds!: number[];
} 