import { CreateRoomRequest } from '@chat-example/types';
import { OmitType } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * DTO for creating a new chat room request
 */

export class CreateRoomDto implements CreateRoomRequest {
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | undefined;

  @IsBoolean()
  @IsNotEmpty()
  isPrivate!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  participantIds?: number[] | undefined;

  @IsBoolean()
  @IsNotEmpty()
  isDirect!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  userIds!: number[];

  @IsNumber()
  @IsNotEmpty()
  ownerId!: number;
} 
export class CreateRoomRequestDto  extends OmitType(CreateRoomDto, ['ownerId']){
  
}
