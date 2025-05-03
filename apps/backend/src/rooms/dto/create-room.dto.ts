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
  @IsOptional()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  participantIds?: number[] | undefined;

  @IsBoolean()
  @IsNotEmpty()
  isDirect!: boolean;

  @IsArray()
  @IsNumber({}, { each: true })
  userIds!: number[];

  @IsNumber()
  @IsNotEmpty()
  ownerId!: number;
} 

export class CreateRoomRequestDto extends OmitType(CreateRoomDto, ['ownerId']) {
  // Test compatibility: make sure userIds exists even if it's empty
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[] = [];

  // Default values for required properties if not provided
  @IsBoolean()
  isActive: boolean = true;

  @IsString()
  name: string = '';

  @IsBoolean()
  isPrivate: boolean = false;

  @IsBoolean()
  isDirect: boolean = false;

  // Custom validation method
  validate() {
    // For group chats (non-direct), name should be provided
    if (!this.isDirect && (!this.name || this.name.trim() === '')) {
      throw new Error('Name is required for group chats');
    }
    return true;
  }
}
