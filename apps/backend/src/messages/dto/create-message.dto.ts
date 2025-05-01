import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * DTO for creating a new message
 */
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsNumber()
  @IsNotEmpty()
  roomId!: number;

  @IsNumber()
  @IsOptional()
  parentId?: number;
} 