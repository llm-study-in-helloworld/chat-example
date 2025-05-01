import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { RefreshToken, User } from '../entities';
import { Request } from 'express';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: EntityRepository<RefreshToken>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Create a new refresh token for a user
   */
  async createRefreshToken(
    user: User,
    req?: Request,
  ): Promise<RefreshToken> {
    // Create a new token with user agent and IP information if available
    const userAgent = req?.headers['user-agent'];
    const ipAddress = req?.ip || req?.socket.remoteAddress;
    
    const refreshToken = new RefreshToken(
      user,
      30, // 30 days expiration
      userAgent,
      ipAddress,
    );
    
    await this.em.persistAndFlush(refreshToken);

    return refreshToken;
  }

  /**
   * Find a refresh token by its token value
   */
  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({ token });
  }

  /**
   * Validate a refresh token
   */
  async validateRefreshToken(token: string): Promise<RefreshToken> {
    const refreshToken = await this.findRefreshToken(token);
    
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    
    if (!refreshToken.isValid()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    
    return refreshToken;
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    const refreshToken = await this.findRefreshToken(token);
    
    if (refreshToken && !refreshToken.isRevoked) {
      refreshToken.revoke();
      await this.em.persistAndFlush(refreshToken);
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    const refreshTokens = await this.refreshTokenRepository.find({
      user: { id: userId },
      isRevoked: false,
    });
    
    refreshTokens.forEach(token => token.revoke());
    await this.em.flush();
  }

  /**
   * Rotate refresh token - revoke the old one and create a new one
   */
  async rotateRefreshToken(
    currentToken: string,
    req?: Request,
  ): Promise<RefreshToken> {
    const existingToken = await this.validateRefreshToken(currentToken);
    
    // Create a new token
    const newToken = await this.createRefreshToken(existingToken.user, req);
    
    // Revoke the old token
    existingToken.revoke();
    await this.em.persistAndFlush(existingToken);
    
    return newToken;
  }

  /**
   * Remove expired refresh tokens from the database
   * This should be run periodically as a cron job
   */
  async removeExpiredTokens(): Promise<number> {
    const now = new Date();
    const expiredTokens = await this.refreshTokenRepository.find({
      expiresAt: { $lt: now },
      isRevoked: false,
    });
    
    expiredTokens.forEach(token => token.revoke());
    await this.em.flush();
    
    return expiredTokens.length;
  }
} 