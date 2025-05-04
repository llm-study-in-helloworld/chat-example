import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RefreshToken, User } from '../entities';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: EntityRepository<RefreshToken>,
    private readonly em: EntityManager,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Create a new refresh token for a user
   */
  async createRefreshToken(
    user: User,
    req?: Request,
  ): Promise<RefreshToken> {
    this.logger.logMethodEntry('createRefreshToken', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      // Create a new token with user agent and IP information if available
      const userAgent = req?.headers['user-agent'];
      const ipAddress = req?.ip || req?.socket.remoteAddress;
      
      this.logger.debug(`Creating refresh token for user ${user.id} from ${ipAddress || 'unknown IP'} with ${userAgent || 'unknown agent'}`, 'RefreshTokenService');
      
      const refreshToken = new RefreshToken(
        user,
        30, // 30 days expiration
        userAgent,
        ipAddress,
      );
      
      await this.refreshTokenRepository.create(refreshToken);
      await this.em.flush();
      
      this.logger.debug(`Refresh token created successfully for user ${user.id}, expires in 30 days`, 'RefreshTokenService');
      this.logger.logDatabase('create', 'RefreshToken', { userId: user.id, tokenId: refreshToken.id }, 'RefreshTokenService');
      
      return refreshToken;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating refresh token: ${errorMessage}`, errorStack, 'RefreshTokenService');
      throw error;
    } finally {
      this.logger.logMethodExit('createRefreshToken', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Find a refresh token by its token value
   */
  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    this.logger.logMethodEntry('findRefreshToken', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Finding refresh token', 'RefreshTokenService');
      
      const refreshToken = await this.refreshTokenRepository.findOne({ token });
      
      if (refreshToken) {
        this.logger.debug(`Found refresh token ID: ${refreshToken.id} for user ${refreshToken.user.id}`, 'RefreshTokenService');
      } else {
        this.logger.debug('Refresh token not found', 'RefreshTokenService');
      }
      
      return refreshToken;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error finding refresh token: ${errorMessage}`, errorStack, 'RefreshTokenService');
      return null;
    } finally {
      this.logger.logMethodExit('findRefreshToken', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Validate a refresh token
   */
  async validateRefreshToken(token: string): Promise<RefreshToken> {
    this.logger.logMethodEntry('validateRefreshToken', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Validating refresh token', 'RefreshTokenService');
      
      const refreshToken = await this.findRefreshToken(token);
      
      if (!refreshToken) {
        this.logger.warn('Refresh token validation failed: Token not found', 'RefreshTokenService');
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      if (!refreshToken.isValid()) {
        this.logger.warn(`Refresh token validation failed for token ID ${refreshToken.id}: Token expired or revoked`, 'RefreshTokenService');
        throw new UnauthorizedException('Refresh token expired or revoked');
      }
      
      this.logger.debug(`Refresh token ID ${refreshToken.id} validated successfully for user ${refreshToken.user.id}`, 'RefreshTokenService');
      return refreshToken;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error validating refresh token: ${errorMessage}`, errorStack, 'RefreshTokenService');
      throw error;
    } finally {
      this.logger.logMethodExit('validateRefreshToken', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    this.logger.logMethodEntry('revokeRefreshToken', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Revoking refresh token', 'RefreshTokenService');
      
      const refreshToken = await this.findRefreshToken(token);
      
      if (refreshToken && !refreshToken.isRevoked) {
        refreshToken.revoke();
        await this.em.flush();
        this.logger.debug(`Refresh token ID ${refreshToken.id} for user ${refreshToken.user.id} revoked successfully`, 'RefreshTokenService');
        this.logger.logDatabase('update', 'RefreshToken', { id: refreshToken.id, revoked: true }, 'RefreshTokenService');
      } else if (refreshToken) {
        this.logger.debug(`Refresh token ID ${refreshToken.id} was already revoked`, 'RefreshTokenService');
      } else {
        this.logger.debug('Cannot revoke: Refresh token not found', 'RefreshTokenService');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error revoking refresh token: ${errorMessage}`, errorStack, 'RefreshTokenService');
    } finally {
      this.logger.logMethodExit('revokeRefreshToken', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    this.logger.logMethodEntry('revokeAllUserRefreshTokens', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Revoking all refresh tokens for user ${userId}`, 'RefreshTokenService');
      
      // Use nativeUpdate to directly update all tokens in the database with a single query
      const result = await this.refreshTokenRepository.nativeUpdate(
        { user: { id: userId }, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );
      await this.em.flush();
      
      this.logger.debug(`${result} refresh tokens revoked for user ${userId}`, 'RefreshTokenService');
      this.logger.logDatabase('update', 'RefreshToken', { userId, tokensRevoked: result }, 'RefreshTokenService');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error revoking all refresh tokens for user ${userId}: ${errorMessage}`, errorStack, 'RefreshTokenService');
    } finally {
      this.logger.logMethodExit('revokeAllUserRefreshTokens', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Rotate refresh token - revoke the old one and create a new one
   */
  async rotateRefreshToken(
    currentToken: string,
    req?: Request,
  ): Promise<RefreshToken> {
    this.logger.logMethodEntry('rotateRefreshToken', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Rotating refresh token', 'RefreshTokenService');
      
      const existingToken = await this.validateRefreshToken(currentToken);
      this.logger.debug(`Existing token ID ${existingToken.id} validated for user ${existingToken.user.id}`, 'RefreshTokenService');
      
      // Create a new token
      const newToken = await this.createRefreshToken(existingToken.user, req);
      this.logger.debug(`New token ID ${newToken.id} created for user ${existingToken.user.id}`, 'RefreshTokenService');
      
      // Revoke the old token
      existingToken.revoke();
      await this.em.flush();
      this.logger.debug(`Old token ID ${existingToken.id} revoked`, 'RefreshTokenService');
      this.logger.logDatabase('update', 'RefreshToken', { id: existingToken.id, revoked: true }, 'RefreshTokenService');
      
      return newToken;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error rotating refresh token: ${errorMessage}`, errorStack, 'RefreshTokenService');
      throw error;
    } finally {
      this.logger.logMethodExit('rotateRefreshToken', Date.now() - startTime, 'RefreshTokenService');
    }
  }

  /**
   * Remove expired refresh tokens from the database
   * This should be run periodically as a cron job
   */
  async removeExpiredTokens(): Promise<number> {
    this.logger.logMethodEntry('removeExpiredTokens', 'RefreshTokenService');
    const startTime = Date.now();
    
    try {
      this.logger.debug('Removing expired refresh tokens', 'RefreshTokenService');
      
      const now = new Date();
      const expiredTokens = await this.refreshTokenRepository.find({
        expiresAt: { $lt: now },
        isRevoked: false,
      });
      
      this.logger.debug(`Found ${expiredTokens.length} expired tokens to revoke`, 'RefreshTokenService');
      
      expiredTokens.forEach(token => token.revoke());
      await this.em.flush();
      
      this.logger.debug(`Successfully revoked ${expiredTokens.length} expired tokens`, 'RefreshTokenService');
      this.logger.logDatabase('update', 'RefreshToken', { expiredTokensRevoked: expiredTokens.length }, 'RefreshTokenService');
      
      return expiredTokens.length;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error removing expired tokens: ${errorMessage}`, errorStack, 'RefreshTokenService');
      return 0;
    } finally {
      this.logger.logMethodExit('removeExpiredTokens', Date.now() - startTime, 'RefreshTokenService');
    }
  }
} 