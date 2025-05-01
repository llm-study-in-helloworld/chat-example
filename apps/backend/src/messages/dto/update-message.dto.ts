import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for updating a message
 */
export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
} 