import { Controller, Post, Body, UnauthorizedException, Res, UseGuards, HttpCode, HttpStatus, Req, Delete, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenAuthGuard } from './refresh-token-auth.guard';
import { CurrentUser } from './user.decorator';
import { User } from '../entities';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { DeleteUserDto } from '../users/dto/delete-user.dto';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../entities/dto/user.dto';

// Define interface for Request with refreshToken
interface RequestWithRefreshToken extends Request {
  user?: {
    user: User;
    refreshToken: string;
  };
}

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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    try {
      // First, clear any existing cookies
      response.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      
      response.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      
      const user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
      );
      const result = await this.authService.login(user, request);
      
      // Set the access token as a cookie
      response.cookie('jwt', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/'
      });
      
      // Set the refresh token as a cookie with longer expiration
      response.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/auth/refresh' // Restrict to the refresh endpoint path
      });
      
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  /**
   * 액세스 토큰 갱신 엔드포인트
   */
  @UseGuards(RefreshTokenAuthGuard)
  @Post('refresh')
  async refreshTokens(
    @Req() request: RequestWithRefreshToken,
    @Res({ passthrough: true }) response: Response
  ) {
    try {
      const userId = request.user?.user?.id;
      const refreshToken = request.user?.refreshToken;
      
      if (!userId || !refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      const result = await this.authService.refreshTokens(userId, refreshToken, request);
      
      // Set the new access token as a cookie
      response.cookie('jwt', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/'
      });
      
      // Set the new refresh token as a cookie
      response.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/auth/refresh' // Restrict to the refresh endpoint path
      });
      
      return result;
    } catch (error) {
      // Clear the cookies if there's an error
      response.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      
      response.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth/refresh'
      });
      
      throw new UnauthorizedException('Failed to refresh token');
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
    const refreshToken = request.cookies?.refresh_token;
    
    if (token || refreshToken) {
      await this.authService.logout(token, refreshToken);
    }
    
    // 쿠키 제거
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh'
    });
    
    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/'
    });
    
    response.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/auth/refresh'
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
    const refreshToken = request.cookies?.refresh_token;
    
    if (token || refreshToken) {
      await this.authService.logout(token, refreshToken);
    }
    
    // 쿠키 제거
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh'
    });
    
    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/'
    });
    
    response.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/auth/refresh'
    });
    
    return { message: 'Account deleted successfully' };
  }
} 