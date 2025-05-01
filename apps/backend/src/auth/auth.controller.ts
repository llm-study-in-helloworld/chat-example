import { Controller, Post, Body, UnauthorizedException, Res, UseGuards, HttpCode, HttpStatus, Req, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './user.decorator';
import { User } from '../entities';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { DeleteUserDto } from '../users/dto/delete-user.dto';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../entities/dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  /**
   * 회원 가입 엔드포인트
   */
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.createUser(createUserDto);
  }

  @Post('login')
  async login(
    @Body() loginDto: { email: string; password: string },
    @Res({ passthrough: true }) response: Response
  ) {
    try {
      const user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
      );
      const result = await this.authService.login(user);
      
      // Set the JWT token as a cookie
      response.cookie('jwt', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/'
      });
      
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
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
} 