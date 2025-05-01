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

      // 만료 시간 설정
      const expiry = new Date(decoded.exp * 1000);
      this.blacklist.set(token, expiry);
    } catch (error) {
      console.error('Failed to blacklist token:', error);
    }
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   */
  isBlacklisted(token: string): boolean {
    return this.blacklist.has(token);
  }

  /**
   * 만료된 토큰 제거
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, expiry] of this.blacklist.entries()) {
      if (expiry <= now) {
        this.blacklist.delete(token);
      }
    }
  }
} 