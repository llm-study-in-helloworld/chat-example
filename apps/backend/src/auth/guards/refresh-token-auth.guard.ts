import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RefreshTokenService } from '../refresh-token.service';

@Injectable()
export class RefreshTokenAuthGuard implements CanActivate {
  constructor(private readonly refreshTokenService: RefreshTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Extract refresh token from cookies or headers
    const refreshToken = this.extractRefreshToken(request);
    if (!refreshToken) {
      return true; // Still allow the request to proceed, the route handler can check for the token
    }
    
    try {
      // Validate the refresh token
      const tokenEntity = await this.refreshTokenService.validateRefreshToken(refreshToken);
      
      // Attach the validated refresh token and user to the request for use in handlers
      request['user'] = tokenEntity.user;
      request.headers['refresh_token'] = refreshToken;
      
      return true;
    } catch (error) {
      // Allow the request to proceed even if token validation fails
      // The route handler should check if the user exists
      return true;
    }
  }

  private extractRefreshToken(request: Request): string | undefined {
    // Extract from cookie first
    const cookieToken = request.cookies?.refresh_token;
    if (cookieToken) {
      return cookieToken;
    }
    
    // Then try to get from authorization header with x-token-type header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && request.headers['x-token-type'] === 'refresh') {
      return authHeader.substring(7);
    }
    
    // Finally try to get from dedicated header
    return request.headers['x-refresh-token'] as string | undefined;
  }
} 