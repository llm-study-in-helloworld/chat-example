import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { RefreshTokenService } from '../../src/auth/refresh-token.service';
import { RefreshToken, User } from '../../src/entities';
import testConfig from '../mikro-orm.config.test';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let orm: MikroORM;
  let em: EntityManager;
  let refreshTokenRepository: EntityRepository<RefreshToken>;
  let userRepository: EntityRepository<User>;

  // Test data
  let testUser: User;
  let testRefreshToken: RefreshToken;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User, RefreshToken]
        }),
      ],
      providers: [RefreshTokenService],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    refreshTokenRepository = em.getRepository(RefreshToken);
    userRepository = em.getRepository(User);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create test user
    testUser = new User();
    testUser.email = 'refresh-test@example.com';
    testUser.nickname = 'RefreshTestUser';
    testUser.passwordHash = await bcrypt.hash('password123', 10);
    
    await em.persistAndFlush(testUser);

    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  describe('createRefreshToken', () => {
    it('should create a valid refresh token for a user', async () => {
      // Arrange
      const mockRequest = {
        headers: {
          'user-agent': 'Test User Agent'
        },
        ip: '127.0.0.1'
      };

      // Act
      const refreshToken = await service.createRefreshToken(testUser, mockRequest as any);

      // Assert
      expect(refreshToken).toBeDefined();
      expect(refreshToken.token).toBeDefined();
      expect(typeof refreshToken.token).toBe('string');
      expect(refreshToken.token.length).toBeGreaterThan(10);
      expect(refreshToken.user.id).toBe(testUser.id);
      expect(refreshToken.isRevoked).toBe(false);
      expect(refreshToken.userAgent).toBe('Test User Agent');
      expect(refreshToken.ipAddress).toBe('127.0.0.1');
      
      // Verify token is saved in the database
      const savedToken = await refreshTokenRepository.findOne({ token: refreshToken.token });
      expect(savedToken).toBeDefined();
      expect(savedToken!.token).toBe(refreshToken.token);

      // Store for later tests
      testRefreshToken = refreshToken;
    });

    it('should create a token with default parameters when request is not provided', async () => {
      // Act
      const refreshToken = await service.createRefreshToken(testUser);

      // Assert
      expect(refreshToken).toBeDefined();
      expect(refreshToken.token).toBeDefined();
      expect(refreshToken.user.id).toBe(testUser.id);
      expect(refreshToken.userAgent).toBeUndefined();
      expect(refreshToken.ipAddress).toBeUndefined();
    });
  });

  describe('findRefreshToken', () => {
    it('should find a token by its value', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();

      // Act
      const foundToken = await service.findRefreshToken(createdToken.token);

      // Assert
      expect(foundToken).toBeDefined();
      expect(foundToken!.token).toBe(createdToken.token);
      expect(foundToken!.user.id).toBe(testUser.id);
    });

    it('should return null for non-existent token', async () => {
      // Act
      const foundToken = await service.findRefreshToken('non-existent-token');

      // Assert
      expect(foundToken).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid token', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();

      // Act
      const validToken = await service.validateRefreshToken(createdToken.token);

      // Assert
      expect(validToken).toBeDefined();
      expect(validToken.token).toBe(createdToken.token);
      expect(validToken.user.id).toBe(testUser.id);
    });

    it('should throw UnauthorizedException for non-existent token', async () => {
      // Act & Assert
      await expect(service.validateRefreshToken('non-existent-token'))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken('non-existent-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      // Arrange - Create and revoke a token
      const createdToken = await service.createRefreshToken(testUser);
      await service.revokeRefreshToken(createdToken.token);
      em.clear();

      // Act & Assert
      await expect(service.validateRefreshToken(createdToken.token))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken(createdToken.token))
        .rejects.toThrow('Refresh token expired or revoked');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      // Arrange - Create token with expiration in the past
      const token = new RefreshToken(
        testUser,
        -1, // Negative days = already expired
        'Test User Agent',
        '127.0.0.1'
      );
      await refreshTokenRepository.create(token);
      await em.flush();
      em.clear();

      // Act & Assert
      await expect(service.validateRefreshToken(token.token))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken(token.token))
        .rejects.toThrow('Refresh token expired or revoked');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke an active token', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();

      // Act
      await service.revokeRefreshToken(createdToken.token);

      // Assert
      const token = await refreshTokenRepository.findOne({ token: createdToken.token });
      expect(token).toBeDefined();
      expect(token!.isRevoked).toBe(true);
      expect(token!.revokedAt).toBeDefined();
    });

    it('should not throw error when revoking non-existent token', async () => {
      // Act & Assert
      await expect(service.revokeRefreshToken('non-existent-token'))
        .resolves.not.toThrow();
    });

    it('should not modify an already revoked token', async () => {
      // Arrange - Create and revoke a token
      const createdToken = await service.createRefreshToken(testUser);
      await service.revokeRefreshToken(createdToken.token);
      
      // Get the revoked time
      const token = await refreshTokenRepository.findOne({ token: createdToken.token });
      const originalRevokedAt = token!.revokedAt;
      
      em.clear();
      
      // Act - Try to revoke again
      await service.revokeRefreshToken(createdToken.token);
      
      // Assert - Revoked time should not have changed
      const updatedToken = await refreshTokenRepository.findOne({ token: createdToken.token });
      expect(updatedToken!.revokedAt).toEqual(originalRevokedAt);
    });
  });

  describe('revokeAllUserRefreshTokens', () => {
    it('should revoke all tokens for a user', async () => {
      // Arrange - Create multiple tokens for the user
      const token1 = await service.createRefreshToken(testUser);
      const token2 = await service.createRefreshToken(testUser);
      const token3 = await service.createRefreshToken(testUser);
      
      em.clear();

      // Act
      await service.revokeAllUserRefreshTokens(testUser.id);

      // Assert
      const tokens = await refreshTokenRepository.find({ user: { id: testUser.id } });
      expect(tokens.length).toBe(3);
      tokens.forEach(token => {
        expect(token.isRevoked).toBe(true);
        expect(token.revokedAt).toBeDefined();
      });
    });

    it('should handle user with no tokens gracefully', async () => {
      // Act & Assert
      await expect(service.revokeAllUserRefreshTokens(999))
        .resolves.not.toThrow();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should revoke the old token and create a new one', async () => {
      // Arrange - Create a token first
      const oldToken = await service.createRefreshToken(testUser);
      const mockRequest = {
        headers: {
          'user-agent': 'New User Agent'
        },
        ip: '192.168.1.1'
      };
      
      em.clear();

      // Act
      const newToken = await service.rotateRefreshToken(oldToken.token, mockRequest as any);

      // Assert - Check new token
      expect(newToken).toBeDefined();
      expect(newToken.token).not.toBe(oldToken.token);
      expect(newToken.user.id).toBe(testUser.id);
      expect(newToken.isRevoked).toBe(false);
      expect(newToken.userAgent).toBe('New User Agent');
      expect(newToken.ipAddress).toBe('192.168.1.1');
      
      // Assert - Check old token is revoked
      const oldTokenEntity = await refreshTokenRepository.findOne({ token: oldToken.token });
      expect(oldTokenEntity!.isRevoked).toBe(true);
      expect(oldTokenEntity!.revokedAt).toBeDefined();
    });

    it('should throw error when rotating invalid token', async () => {
      // Act & Assert
      await expect(service.rotateRefreshToken('invalid-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw error when rotating revoked token', async () => {
      // Arrange - Create and revoke a token
      const token = await service.createRefreshToken(testUser);
      await service.revokeRefreshToken(token.token);
      
      em.clear();

      // Act & Assert
      await expect(service.rotateRefreshToken(token.token))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('removeExpiredTokens', () => {
    it('should mark expired tokens as revoked', async () => {
      // Arrange - Create tokens with different expirations
      const expiredToken1 = new RefreshToken(testUser, -5); // Expired 5 days ago
      const expiredToken2 = new RefreshToken(testUser, -1); // Expired 1 day ago
      const validToken = new RefreshToken(testUser, 30); // Valid for 30 days
      
      await refreshTokenRepository.create(expiredToken1);
      await refreshTokenRepository.create(expiredToken2);
      await refreshTokenRepository.create(validToken);
      await em.flush();
      
      em.clear();

      // Act
      const revokedCount = await service.removeExpiredTokens();

      // Assert
      expect(revokedCount).toBe(2); // Should have revoked 2 tokens
      
      // Verify expired tokens are revoked
      const token1 = await refreshTokenRepository.findOne({ token: expiredToken1.token });
      const token2 = await refreshTokenRepository.findOne({ token: expiredToken2.token });
      const token3 = await refreshTokenRepository.findOne({ token: validToken.token });
      
      expect(token1!.isRevoked).toBe(true);
      expect(token2!.isRevoked).toBe(true);
      expect(token3!.isRevoked).toBe(false);
    });

    it('should not affect already revoked tokens', async () => {
      // Arrange - Create and manually revoke an expired token
      const expiredToken = new RefreshToken(testUser, -2); // Expired 2 days ago
      expiredToken.isRevoked = true;
      expiredToken.revokedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // Revoked 3 days ago
      
      await refreshTokenRepository.create(expiredToken);
      await em.flush();
      
      em.clear();

      // Act
      const revokedCount = await service.removeExpiredTokens();

      // Assert
      expect(revokedCount).toBe(0); // No new tokens should be revoked
      
      // Verify token's revoked time was not updated
      const token = await refreshTokenRepository.findOne({ token: expiredToken.token });
      expect(token!.revokedAt!.getTime()).toBeCloseTo(
        expiredToken.revokedAt!.getTime(),
        -2 // Allow for a small time difference due to database precision
      );
    });

    it('should return 0 when no expired tokens exist', async () => {
      // Arrange - Create only valid tokens
      const validToken1 = new RefreshToken(testUser, 10);
      const validToken2 = new RefreshToken(testUser, 20);
      
      await refreshTokenRepository.create(validToken1);
      await refreshTokenRepository.create(validToken2);
      await em.flush();
      
      em.clear();

      // Act
      const revokedCount = await service.removeExpiredTokens();

      // Assert
      expect(revokedCount).toBe(0);
    });
  });
}); 