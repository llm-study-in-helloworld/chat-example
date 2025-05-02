import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { User } from '../../entities/User.entity';

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
  @IsNotEmpty()
  currentPassword!: string;
  
  /**
   * Apply profile updates to a User entity (excluding password)
   */
  applyTo(user: User): User {
    user.nickname = this.nickname;
    if (this.imageUrl !== undefined) {
      user.imageUrl = this.imageUrl;
    }
    return user;
  }
} 