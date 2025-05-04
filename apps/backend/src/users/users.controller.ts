import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth';
import { UserResponseDto } from '../dto';
import { User } from '../entities';
import { UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService
  ) {}

  /**
   * 사용자 프로필 업데이트 엔드포인트
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(user, updateUserDto);
  }

  /**
   * 현재 사용자 정보 조회
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@CurrentUser() user: User): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(user);
  }
} 