import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO for updating user profile
 */
export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  currentPassword?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  newPassword?: string;
} 