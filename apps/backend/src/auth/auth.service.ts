import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';
import { UsersService } from '../users/users.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    // Calculate exact timestamps
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const expiresIn = 24 * 60 * 60; // 24 hours in seconds
    
    // Create a new token with precise timestamps
    const payload = { 
      sub: user.id, 
      email: user.email,
      nickname: user.nickname,
      // Add precise timestamp with milliseconds to make each token unique
      iat: now,
      // Set explicit expiration time
      exp: now + expiresIn
    };
    
    const token = this.jwtService.sign(payload, { expiresIn: undefined }); // Override module default
    
    // Set this as the latest token and invalidate previous ones
    this.tokenBlacklistService.setLatestUserToken(user.id, token);
    await this.tokenBlacklistService.blacklistUserTokens(user.id);
    
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        imageUrl: user.imageUrl,
      },
    };
  }

  async logout(token: string): Promise<boolean> {
    if (token) {
      await this.tokenBlacklistService.blacklistToken(token);
      
      return true;
    }
    return false;
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