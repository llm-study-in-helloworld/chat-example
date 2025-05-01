import { Injectable, ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../entities';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from '../entities/dto/user.dto';
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

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    // Create new user
    const user = new User();
    user.email = createUserDto.email;
    user.nickname = createUserDto.nickname;
    user.passwordHash = passwordHash;
    user.imageUrl = createUserDto.imageUrl;

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
   * 사용자 정보 업데이트
   */
  async updateUser(userId: number, updateData: Partial<User>): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow updating email or passwordHash directly
    delete updateData.email;
    delete updateData.passwordHash;

    // Update user properties
    Object.assign(user, updateData);
    await this.em.flush();

    return UserResponseDto.fromEntity(user);
  }

  /**
   * 사용자 프로필 업데이트 (DTO를 사용)
   */
  async updateUserProfile(userId: number, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 비밀번호 변경 처리
    if (updateUserDto.currentPassword && updateUserDto.newPassword) {
      const isPasswordValid = await bcrypt.compare(updateUserDto.currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      const saltRounds = 10;
      user.passwordHash = await bcrypt.hash(updateUserDto.newPassword, saltRounds);
    } else if ((updateUserDto.currentPassword && !updateUserDto.newPassword) || 
               (!updateUserDto.currentPassword && updateUserDto.newPassword)) {
      throw new BadRequestException('Both current and new password must be provided to change password');
    }

    // 닉네임과 이미지 URL 업데이트
    user.nickname = updateUserDto.nickname;
    if (updateUserDto.imageUrl !== undefined) {
      user.imageUrl = updateUserDto.imageUrl;
    }

    await this.em.flush();
    return UserResponseDto.fromEntity(user);
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return false;
    }

    // Hash and set new password
    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.em.flush();

    return true;
  }

  /**
   * 사용자 계정 삭제
   */
  async deleteUser(userId: number, password: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // 사용자 계정 삭제
    await this.em.removeAndFlush(user);
    return true;
  }
} 