import { 
  Body, 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
  Patch
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, DeleteUserDto } from './dto';
import { JwtAuthGuard, CurrentUser, AuthService } from '../auth';
import { User } from '../entities';
import { UserResponseDto } from '../entities/dto/user.dto';
import { Response, Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}

  /**
   * 회원 가입 엔드포인트
   */
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.createUser(createUserDto);
  }

  /**
   * 로그아웃 엔드포인트
   * 클라이언트의 쿠키를 강제로 제거하고 토큰을 무효화
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ message: string }> {
    // 토큰 추출 및 블랙리스트에 추가
    const token = request.cookies?.jwt || request.headers.authorization?.split(' ')[1];
    if (token) {
      await this.authService.logout(token);
    }
    
    // 쿠키 제거
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/'
    });
    
    return { message: 'Logged out successfully' };
  }

  /**
   * 회원 탈퇴 엔드포인트
   * 사용자 계정을 완전히 삭제
   */
  @UseGuards(JwtAuthGuard)
  @Delete('signout')
  @HttpCode(HttpStatus.OK)
  async signout(
    @CurrentUser() user: User,
    @Body() deleteUserDto: DeleteUserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ message: string }> {
    // 계정 삭제
    const success = await this.usersService.deleteUser(user.id, deleteUserDto.password);
    if (!success) {
      throw new UnauthorizedException('Failed to delete account');
    }
    
    // 로그아웃 처리 (토큰 무효화 및 쿠키 제거)
    const token = request.cookies?.jwt || request.headers.authorization?.split(' ')[1];
    if (token) {
      await this.authService.logout(token);
    }
    
    // 쿠키 제거
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/'
    });
    
    return { message: 'Account deleted successfully' };
  }

  /**
   * 사용자 프로필 업데이트 엔드포인트
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserProfile(user.id, updateUserDto);
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