import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';
import { UserResponseDto } from '../entities/dto/user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  /**
   * 사용자 생성 (회원가입)
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if user with this email already exists
    const existingUser = await this.userRepository.findOne({ email: createUserDto.email });
    if (existingUser) {
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
    
    return UserResponseDto.fromEntity(user);
  }

  /**
   * 이메일로 사용자 찾기
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ email });
  }

  /**
   * ID로 사용자 찾기
   */
  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ id });
  }

  /**
   * 사용자 프로필 업데이트 (DTO를 사용)
   */
  async updateUser(user: User, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Verify current password
    const isPasswordValid = await user.verifyPassword(updateUserDto.currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Apply profile updates
    updateUserDto.applyTo(user);

    await this.em.flush();
    return UserResponseDto.fromEntity(user);
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(user: User, passwordChangeDto: ChangePasswordDto): Promise<boolean> {
    // Verify current password
    const isPasswordValid = await user.verifyPassword(passwordChangeDto.currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Hash and set the new password
    user.passwordHash = await this.hashPassword(passwordChangeDto.newPassword);

    await this.em.flush();
    return true;
  }

  /**
   * 사용자 계정 삭제
   */
  async deleteUser(user: User, password: string): Promise<boolean> {
    // 비밀번호 검증
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // 사용자 계정 삭제
    await this.em.removeAndFlush(user);
    return true;
  }

  /**
   * 비밀번호 해싱 (서비스 내부용)
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }
} 