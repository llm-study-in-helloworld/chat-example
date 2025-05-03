import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for password changes
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
} 