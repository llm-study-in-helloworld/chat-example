import { 
  Body, 
  Controller, 
  Get, 
  UseGuards,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard, CurrentUser } from '../auth';
import { User } from '../entities';
import { UserResponseDto } from '../entities/dto/user.dto';

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
   * 비밀번호 변경 엔드포인트
   */
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ success: boolean }> {
    const success = await this.usersService.changePassword(
      user, 
      changePasswordDto
    );
    
    return { success };
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