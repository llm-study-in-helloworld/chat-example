import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { RefreshTokenService } from '../refresh-token.service';
import { User } from '../../entities';
import { extractRefreshTokenFromCookieOrHeader } from '../helpers/extractor';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  constructor(private refreshTokenService: RefreshTokenService) {
    super();
  }

  async validate(req: Request): Promise<User> {
    // Extract token from request
    const refreshToken = extractRefreshTokenFromCookieOrHeader(req);
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Validate the token
    const refreshTokenEntity = await this.refreshTokenService.validateRefreshToken(refreshToken);

    if (!refreshTokenEntity) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    
    // Get user from the refresh token
    const user = refreshTokenEntity.user;
    
    if (typeof user === 'string') {
      // If user is stored as a string (JSON), parse it
      try {
        const parsedUser = JSON.parse(user);
        // Store the refresh token in the request for later use
        // @ts-ignore - Add the token to the request for use in the controller
        req.refreshToken = refreshToken;
        return parsedUser;
      } catch (e) {
        throw new UnauthorizedException('Invalid user data in refresh token');
      }
    }
    
    // @ts-ignore - Add the token to the request for use in the controller
    req.refreshToken = refreshToken;
    return user;
  }
} 