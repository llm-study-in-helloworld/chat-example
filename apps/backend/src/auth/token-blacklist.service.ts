import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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

  constructor(private readonly jwtService: JwtService) {
    // 만료된 토큰 정리를 위한 주기적 작업
    setInterval(() => this.cleanupExpiredTokens(), 1000 * 60 * 60); // 1시간마다 실행
  }

  /**
   * 토큰을 블랙리스트에 추가
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      // 토큰 디코딩하여 만료 시간 확인
      const decoded = this.jwtService.decode(token);
      if (!decoded || typeof decoded !== 'object' || !decoded.exp) {
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
      }
    } catch (error) {
      console.error('Failed to blacklist token:', error);
    }
  }

  /**
   * 사용자의 이전 토큰을 블랙리스트에 추가하고 새 토큰을 저장
   */
  async blacklistUserTokens(userId: number): Promise<void> {
    // Initialize user's token set if it doesn't exist
    if (!this.userTokens.has(userId)) {
      this.userTokens.set(userId, new Set());
      return;
    }
    
    // Get all tokens for this user
    const userTokens = this.userTokens.get(userId);
    if (!userTokens || userTokens.size === 0) {
      return;
    }

    // When logging out, we want to blacklist ALL tokens including the latest one
    for (const token of userTokens) {
      try {
        if (!this.blacklist.has(token)) {
          const decoded = this.jwtService.decode(token);
          if (decoded && typeof decoded === 'object' && decoded.exp) {
            const expiry = new Date(decoded.exp * 1000);
            this.blacklist.set(token, expiry);
          }
        }
      } catch (error) {
        console.error('Failed to blacklist user token:', error);
      }
    }
    
    // When logging out completely, remove the latest token reference
    this.latestUserTokens.delete(userId);
  }
  
  /**
   * Save the latest token for a user
   */
  setLatestUserToken(userId: number, token: string): void {
    this.latestUserTokens.set(userId, token);
    
    // Initialize user's token set if it doesn't exist
    if (!this.userTokens.has(userId)) {
      this.userTokens.set(userId, new Set());
    }
    
    // Add token to user's tokens
    this.userTokens.get(userId)?.add(token);
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   */
  isBlacklisted(token: string): boolean {
    // Only check direct blacklist
    return this.blacklist.has(token);
  }

  /**
   * 만료된 토큰 제거
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
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
            }
          }
        } catch (error) {
          // Continue with cleanup even if there's an error
        }
        
        this.blacklist.delete(token);
      }
    }
  }
} 