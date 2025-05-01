import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

/**
 * DTO for adding a reaction to a message
 */
export class ReactionDto {
  @IsNumber()
  @IsNotEmpty()
  messageId!: number;

  @IsString()
  @IsNotEmpty()
  emoji!: string;
} 