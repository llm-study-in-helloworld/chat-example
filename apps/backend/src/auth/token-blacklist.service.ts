import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from '../logger/logger.service';

interface BlacklistedToken {
  token: string;
  expiry: Date;
}

/**
 * 로그아웃 시 JWT 토큰을 블랙리스트에 추가하는 서비스
 * 실제 프로덕션에서는 Redis 등을 사용하여 구현하는 것이 좋음
 */
@Injectable()
export class TokenBlacklistService {
  private readonly blacklist: Map<string, Date> = new Map();
  // Store tokens by userId for easy lookup and invalidation
  private readonly userTokens: Map<number, Set<string>> = new Map();
  // Store the latest token for each user
  private readonly latestUserTokens: Map<number, string> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService
  ) {
    // 만료된 토큰 정리를 위한 주기적 작업
    const intervalRef = setInterval(() => this.cleanupExpiredTokens(), 1000 * 60 * 60); // 1시간마다 실행
    intervalRef.unref(); // Don't keep the process alive just for this interval
    this.logger.debug('Token blacklist service initialized with hourly cleanup', 'TokenBlacklistService');
  }

  /**
   * 토큰을 블랙리스트에 추가
   */
  async blacklistToken(token: string): Promise<void> {
    this.logger.logMethodEntry('blacklistToken', 'TokenBlacklistService');
    const startTime = Date.now();
    
    try {
      // 토큰 디코딩하여 만료 시간 확인
      const decoded = this.jwtService.decode(token);
      if (!decoded || typeof decoded !== 'object' || !decoded.exp) {
        this.logger.warn('Failed to blacklist token: Invalid token format', 'TokenBlacklistService');
        return;
      }

      // 만료 시간 설정 (use exact exp value from token)
      const expiry = new Date(decoded.exp * 1000);
      this.blacklist.set(token, expiry);
      
      // If token has a user ID, add to user's token list
      if (decoded.sub) {
        const userId = Number(decoded.sub);
        if (!this.userTokens.has(userId)) {
          this.userTokens.set(userId, new Set());
        }
        this.userTokens.get(userId)?.add(token);
        this.logger.debug(`Token for user ${userId} added to blacklist, expires at ${expiry.toISOString()}`, 'TokenBlacklistService');
      } else {
        this.logger.debug(`Anonymous token added to blacklist, expires at ${expiry.toISOString()}`, 'TokenBlacklistService');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to blacklist token: ${errorMessage}`, errorStack, 'TokenBlacklistService');
    } finally {
      this.logger.logMethodExit('blacklistToken', Date.now() - startTime, 'TokenBlacklistService');
    }
  }

  /**
   * 사용자의 이전 토큰을 블랙리스트에 추가하고 새 토큰을 저장
   */
  blacklistUserTokens(userId: number): void {
    this.logger.logMethodEntry('blacklistUserTokens', 'TokenBlacklistService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Blacklisting all tokens for user ${userId}`, 'TokenBlacklistService');
      
      // Initialize user's token set if it doesn't exist
      if (!this.userTokens.has(userId)) {
        this.userTokens.set(userId, new Set());
        this.logger.debug(`No existing tokens found for user ${userId}`, 'TokenBlacklistService');
        return;
      }
      
      // Get all tokens for this user
      const userTokens = this.userTokens.get(userId);
      if (!userTokens || userTokens.size === 0) {
        this.logger.debug(`No tokens to blacklist for user ${userId}`, 'TokenBlacklistService');
        return;
      }

      let blacklistedCount = 0;
      // When logging out, we want to blacklist ALL tokens including the latest one
      for (const token of userTokens) {
        try {
          if (!this.blacklist.has(token)) {
            const decoded = this.jwtService.decode(token);
            if (decoded && typeof decoded === 'object' && decoded.exp) {
              const expiry = new Date(decoded.exp * 1000);
              this.blacklist.set(token, expiry);
              blacklistedCount++;
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to blacklist a token for user ${userId}: ${errorMessage}`, 'TokenBlacklistService');
        }
      }
      
      this.logger.debug(`Successfully blacklisted ${blacklistedCount} tokens for user ${userId}`, 'TokenBlacklistService');
      
      // When logging out completely, remove the latest token reference
      if (this.latestUserTokens.has(userId)) {
        this.latestUserTokens.delete(userId);
        this.logger.debug(`Removed latest token reference for user ${userId}`, 'TokenBlacklistService');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error blacklisting tokens for user ${userId}: ${errorMessage}`, errorStack, 'TokenBlacklistService');
    } finally {
      this.logger.logMethodExit('blacklistUserTokens', Date.now() - startTime, 'TokenBlacklistService');
    }
  }
  
  /**
   * Save the latest token for a user
   */
  setLatestUserToken(userId: number, token: string): void {
    this.logger.logMethodEntry('setLatestUserToken', 'TokenBlacklistService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Setting latest token for user ${userId}`, 'TokenBlacklistService');
      
      this.latestUserTokens.set(userId, token);
      
      // Initialize user's token set if it doesn't exist
      if (!this.userTokens.has(userId)) {
        this.userTokens.set(userId, new Set());
      }
      
      // Add token to user's tokens
      this.userTokens.get(userId)?.add(token);
      
      const decoded = this.jwtService.decode(token);
      if (decoded && typeof decoded === 'object' && decoded.exp) {
        const expiry = new Date(decoded.exp * 1000);
        this.logger.debug(`Latest token for user ${userId} set, expires at ${expiry.toISOString()}`, 'TokenBlacklistService');
      } else {
        this.logger.debug(`Latest token for user ${userId} set with unknown expiry`, 'TokenBlacklistService');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error setting latest token for user ${userId}: ${errorMessage}`, errorStack, 'TokenBlacklistService');
    } finally {
      this.logger.logMethodExit('setLatestUserToken', Date.now() - startTime, 'TokenBlacklistService');
    }
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   */
  isBlacklisted(token: string): boolean {
    this.logger.logMethodEntry('isBlacklisted', 'TokenBlacklistService');
    const startTime = Date.now();
    
    try {
      // Only check direct blacklist
      const result = this.blacklist.has(token);
      
      if (result) {
        this.logger.debug('Token is blacklisted', 'TokenBlacklistService');
      } else {
        this.logger.debug('Token is not blacklisted', 'TokenBlacklistService');
      }
      
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error checking token blacklist: ${errorMessage}`, errorStack, 'TokenBlacklistService');
      return false;
    } finally {
      this.logger.logMethodExit('isBlacklisted', Date.now() - startTime, 'TokenBlacklistService');
    }
  }

  /**
   * 만료된 토큰 제거
   */
  private cleanupExpiredTokens(): void {
    this.logger.logMethodEntry('cleanupExpiredTokens', 'TokenBlacklistService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Starting cleanup of expired tokens', 'TokenBlacklistService');
      
      const now = new Date();
      let removedCount = 0;
      
      for (const [token, expiry] of this.blacklist.entries()) {
        if (expiry <= now) {
          // Also remove from user tokens
          try {
            const decoded = this.jwtService.decode(token);
            if (decoded && typeof decoded === 'object' && decoded.sub) {
              const userId = Number(decoded.sub);
              this.userTokens.get(userId)?.delete(token);
              
              // If this was the latest token, remove it from latest tokens too
              if (this.latestUserTokens.get(userId) === token) {
                this.latestUserTokens.delete(userId);
                this.logger.debug(`Removed expired latest token for user ${userId}`, 'TokenBlacklistService');
              }
            }
          } catch (error: unknown) {
            // Continue with cleanup even if there's an error
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Error during token cleanup: ${errorMessage}`, 'TokenBlacklistService');
          }
          
          this.blacklist.delete(token);
          removedCount++;
        }
      }
      
      this.logger.debug(`Cleanup completed: removed ${removedCount} expired tokens`, 'TokenBlacklistService');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error during token cleanup: ${errorMessage}`, errorStack, 'TokenBlacklistService');
    } finally {
      this.logger.logMethodExit('cleanupExpiredTokens', Date.now() - startTime, 'TokenBlacklistService');
    }
  }
} 