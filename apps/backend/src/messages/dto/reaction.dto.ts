import { IsNotEmpty, IsNumber, IsString } from "class-validator";

/**
 * DTO for message reactions
 */
export class ReactionDto {
  @IsNumber()
  @IsNotEmpty()
  messageId!: number;

  @IsString()
  @IsNotEmpty()
  emoji!: string;
}
