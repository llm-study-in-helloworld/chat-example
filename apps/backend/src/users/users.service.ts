import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserResponseDto } from '../dto';
import { User } from '../entities';
import { LoggerService } from '../logger';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly logger: LoggerService
  ) {}

  /**
   * 사용자 생성 (회원가입)
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.logMethodEntry('createUser', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Creating user with email: ${createUserDto.email}, nickname: ${createUserDto.nickname}`, 'UsersService');
      
      // Check if user with this email already exists
      const existingUser = await this.userRepository.findOne({ email: createUserDto.email });
      if (existingUser) {
        this.logger.warn(`User creation failed: email ${createUserDto.email} already exists`, 'UsersService');
        throw new ConflictException('User with this email already exists');
      }

      // Create new user and apply DTO
      const user = new User();
      user.email = createUserDto.email;
      user.nickname = createUserDto.nickname;
      if (createUserDto.imageUrl) {
        user.imageUrl = createUserDto.imageUrl;
      }
      
      // Hash password
      user.passwordHash = await this.hashPassword(createUserDto.password);

      await this.em.persistAndFlush(user);
      this.logger.logDatabase('persist', 'User', { id: user.id, email: user.email }, 'UsersService');
      
      this.logger.log(`User created successfully: ID ${user.id}, email: ${user.email}`, 'UsersService');
      return UserResponseDto.fromEntity(user);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating user: ${errorMessage}`, errorStack, 'UsersService');
      throw error;
    } finally {
      this.logger.logMethodExit('createUser', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * 이메일로 사용자 찾기
   */
  async findByEmail(email: string): Promise<User | null> {
    this.logger.logMethodEntry('findByEmail', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Finding user by email: ${email}`, 'UsersService');
      
      const user = await this.userRepository.findOne({ email });
      
      if (user) {
        this.logger.debug(`User found: ID ${user.id}, email: ${user.email}`, 'UsersService');
      } else {
        this.logger.debug(`No user found with email: ${email}`, 'UsersService');
      }
      
      return user;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error finding user by email '${email}': ${errorMessage}`, errorStack, 'UsersService');
      return null;
    } finally {
      this.logger.logMethodExit('findByEmail', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * ID로 사용자 찾기
   */
  async findById(id: number): Promise<User | null> {
    this.logger.logMethodEntry('findById', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Finding user by ID: ${id}`, 'UsersService');
      
      // Use raw query option for better compatibility with global context
      const user = await this.userRepository.findOne({ id }, { disableIdentityMap: true });
      
      if (user) {
        this.logger.debug(`User found: ID ${user.id}, email: ${user.email}`, 'UsersService');
      } else {
        this.logger.debug(`No user found with ID: ${id}`, 'UsersService');
      }
      
      return user;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error finding user by ID ${id}: ${errorMessage}`, errorStack, 'UsersService');
      return null;
    } finally {
      this.logger.logMethodExit('findById', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * 사용자 프로필 업데이트 (DTO를 사용)
   */
  async updateUser(user: User, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    this.logger.logMethodEntry('updateUser', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Updating user profile for user ID: ${user.id}`, 'UsersService');
      
      // Verify current password
      const isPasswordValid = await user.verifyPassword(updateUserDto.currentPassword);
      if (!isPasswordValid) {
        this.logger.warn(`Profile update failed for user ${user.id}: Invalid password`, 'UsersService');
        throw new UnauthorizedException('Invalid password');
      }

      // Apply profile updates
      updateUserDto.applyTo(user);

      await this.em.flush();
      this.logger.logDatabase('update', 'User', { id: user.id }, 'UsersService');
      
      this.logger.log(`User ${user.id} profile updated successfully`, 'UsersService');
      return UserResponseDto.fromEntity(user);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error updating user ${user.id}: ${errorMessage}`, errorStack, 'UsersService');
      throw error;
    } finally {
      this.logger.logMethodExit('updateUser', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(user: User, passwordChangeDto: ChangePasswordDto): Promise<boolean> {
    this.logger.logMethodEntry('changePassword', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Changing password for user ID: ${user.id}`, 'UsersService');
      
      // Verify current password
      const isPasswordValid = await user.verifyPassword(passwordChangeDto.currentPassword);
      if (!isPasswordValid) {
        this.logger.warn(`Password change failed for user ${user.id}: Invalid current password`, 'UsersService');
        return false;
      }

      // Hash and set the new password
      this.userRepository.merge(user).passwordHash = await this.hashPassword(passwordChangeDto.newPassword);

      await this.em.flush();
      this.logger.logDatabase('update', 'User', { id: user.id, passwordChanged: true }, 'UsersService');
      
      this.logger.log(`Password changed successfully for user ${user.id}`, 'UsersService');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error changing password for user ${user.id}: ${errorMessage}`, errorStack, 'UsersService');
      throw error;
    } finally {
      this.logger.logMethodExit('changePassword', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * 사용자 계정 삭제
   */
  async deleteUser(user: User, password: string): Promise<boolean> {
    this.logger.logMethodEntry('deleteUser', 'UsersService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Deleting user account for user ID: ${user.id}`, 'UsersService');
      
      // 비밀번호 검증
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        this.logger.warn(`User deletion failed for user ${user.id}: Invalid password`, 'UsersService');
        throw new UnauthorizedException('Invalid password');
      }

      // 사용자 계정 삭제
      await this.em.removeAndFlush(user);
      this.logger.logDatabase('remove', 'User', { id: user.id }, 'UsersService');
      
      this.logger.log(`User ${user.id} deleted successfully`, 'UsersService');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error deleting user ${user.id}: ${errorMessage}`, errorStack, 'UsersService');
      throw error;
    } finally {
      this.logger.logMethodExit('deleteUser', Date.now() - startTime, 'UsersService');
    }
  }

  /**
   * 비밀번호 해싱 (서비스 내부용)
   */
  private async hashPassword(password: string): Promise<string> {
    this.logger.logMethodEntry('hashPassword', 'UsersService');
    const startTime = Date.now();
    
    try {
      const saltRounds = 10;
      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error hashing password: ${errorMessage}`, errorStack, 'UsersService');
      throw error;
    } finally {
      this.logger.logMethodExit('hashPassword', Date.now() - startTime, 'UsersService');
    }
  }
} 