import { Injectable, ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../entities';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from '../entities/dto/user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
    createUserDto.applyTo(user);

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
    // Apply profile updates
    updateUserDto.applyTo(user);

    await this.em.flush();
    return UserResponseDto.fromEntity(user);
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(user: User, passwordChangeDto: ChangePasswordDto): Promise<boolean> {
    // Apply the password change directly from the DTO
    const passwordChanged = await passwordChangeDto.applyTo(user);
    if (!passwordChanged) {
      throw new UnauthorizedException('Invalid password');
    }
    
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
} 