import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Extract refresh token from cookie or authorization header
 */
const extractRefreshTokenFromCookieOrHeader = (req: Request): string | null => {
  if (req.cookies && req.cookies.refresh_token) {
    return req.cookies.refresh_token;
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'refresh-token') {
  constructor(
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // We'll handle expiration ourselves
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // The JWT is already validated by Passport, but we need to check if 
    // there's a valid refresh token in the request
    const refreshToken = extractRefreshTokenFromCookieOrHeader(req);
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    
    // Validate the refresh token
    try {
      const tokenEntity = await this.refreshTokenService.validateRefreshToken(refreshToken);
      
      // Check if the user ID in the JWT matches the user ID in the refresh token
      if (payload.sub !== tokenEntity.user.id) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      // Pass both the user and the refresh token to the controller
      return { 
        user: tokenEntity.user,
        refreshToken
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
} 