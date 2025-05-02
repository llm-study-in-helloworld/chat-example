import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';
import { UsersService } from '../users/users.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RefreshTokenService } from './refresh-token.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private accessTokenExpiresIn: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService
  ) {
    this.accessTokenExpiresIn = this.configService.get('JWT_ACCESS_EXPIRES_IN') ?? 60 * 60;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any, req?: Request) {
    // Calculate exact timestamps
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    
    // Create access token
    const payload = { 
      sub: user.id, 
      email: user.email,
      nickname: user.nickname,
      // Add precise timestamp with milliseconds to make each token unique
      iat: now,
      // Set explicit expiration time
      exp: now + this.accessTokenExpiresIn
    };
    
    const accessToken = this.jwtService.sign(payload); // Override module default
    
    // Set this as the latest token and invalidate previous ones
    await this.tokenBlacklistService.blacklistUserTokens(user.id);
    this.tokenBlacklistService.setLatestUserToken(user.id, accessToken);
    
    // Revoke all previous refresh tokens for this user
    await this.refreshTokenService.revokeAllUserRefreshTokens(user.id);
    
    // Create refresh token
    const refreshToken = await this.refreshTokenService.createRefreshToken(user, req);
    
    return {
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        imageUrl: user.imageUrl,
      },
    };
  }

  async refreshTokens(userId: number, refreshToken: string, req?: Request) {
    // Rotate the refresh token
    const newRefreshToken = await this.refreshTokenService.rotateRefreshToken(refreshToken, req);
    
    // Generate a new access token
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    // Calculate exact timestamps for the new access token
    const now = Math.floor(Date.now() / 1000);
    
    const payload = { 
      sub: user.id, 
      email: user.email,
      nickname: user.nickname,
      iat: now,
      exp: now + this.accessTokenExpiresIn
    };
    
    const accessToken = this.jwtService.sign(payload);
    
    // Update the latest token
    this.tokenBlacklistService.setLatestUserToken(user.id, accessToken);
    
    return {
      accessToken,
      refreshToken: newRefreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        imageUrl: user.imageUrl,
      },
    };
  }

  async logout(user: User): Promise<boolean> {
    try {
      await this.refreshTokenService.revokeAllUserRefreshTokens(user.id);
      await this.tokenBlacklistService.blacklistUserTokens(user.id);
    } catch (error) {
      return false;
    }
    
    return true;
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      // 블랙리스트 확인
      if (this.tokenBlacklistService.isBlacklisted(token)) {
        return null;
      }
      
      const payload = this.jwtService.verify(token);
      return await this.usersService.findById(payload.sub);
    } catch (e) {
      return null;
    }
  }
} 