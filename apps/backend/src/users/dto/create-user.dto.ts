import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { User } from '../../entities/User.entity';

/**
 * DTO for user creation (signup)
 */
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
  
  /**
   * Convert this DTO to a User entity
   */
  applyTo(user: User): User {
    user.email = this.email;
    user.nickname = this.nickname;
    user.password = this.password;
    if (this.imageUrl) {
      user.imageUrl = this.imageUrl;
    }
    return user;
  }
} 