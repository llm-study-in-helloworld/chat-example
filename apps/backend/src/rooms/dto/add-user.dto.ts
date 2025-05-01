import { IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO for adding a user to a room
 */
export class AddUserDto {
  @IsNumber()
  @IsNotEmpty()
  userId!: number;
} 