import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { User } from '../../entities/User.entity';

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

  /**
   * Apply the password change to a User entity
   * Returns true if password was successfully updated
   */
  async applyTo(user: User): Promise<boolean> {
    // Verify current password
    const isValid = await user.verifyPassword(this.currentPassword);
    if (!isValid) {
      return false;
    }
    
    // Set new password (will be hashed via entity lifecycle hook)
    user.password = this.newPassword;
    return true;
  }
} 