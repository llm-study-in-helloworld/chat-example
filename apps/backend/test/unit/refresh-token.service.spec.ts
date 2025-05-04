import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from '../../src/auth/refresh-token.service';
import { RefreshToken, User } from '../../src/entities';
import { LoggerService } from '../../src/logger/logger.service';
import testConfig from '../mikro-orm.config.test';
import { createMockLoggerService } from './fixtures/logger.fixtures';
import { createUserFixture, TestUserData } from './fixtures/user.fixtures';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let orm: MikroORM;
  let em: EntityManager;
  let refreshTokenRepository: EntityRepository<RefreshToken>;
  let userRepository: EntityRepository<User>;
  let loggerService: LoggerService;

  // Test data
  let testUser: User;
  let testUserData: TestUserData;
  let testRefreshToken: RefreshToken;

  beforeAll(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User, RefreshToken]
        }),
      ],
      providers: [
        RefreshTokenService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    refreshTokenRepository = em.getRepository(RefreshToken);
    userRepository = em.getRepository(User);
    loggerService = module.get<LoggerService>(LoggerService);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create test user using fixture
    testUserData = await createUserFixture(em, {
      email: 'refresh-test@example.com',
      nickname: 'RefreshTestUser',
      password: 'password123'
    });
    
    // Get the actual user entity for tests that need it
    testUser = await userRepository.findOneOrFail({ id: testUserData.id });

    // Reset mocks
    jest.clearAllMocks();

    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('createRefreshToken', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('createRefreshToken', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Creating refresh token for user'), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Refresh token created successfully'), 'RefreshTokenService');
      expect(loggerService.logDatabase).toHaveBeenCalledWith('create', 'RefreshToken', expect.any(Object), 'RefreshTokenService');
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
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('createRefreshToken', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Creating refresh token for user'), 'RefreshTokenService');
    });
  });

  describe('findRefreshToken', () => {
    it('should find a token by its value', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      const foundToken = await service.findRefreshToken(createdToken.token);

      // Assert
      expect(foundToken).toBeDefined();
      expect(foundToken!.token).toBe(createdToken.token);
      expect(foundToken!.user.id).toBe(testUser.id);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('findRefreshToken', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('findRefreshToken', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Finding refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Found refresh token ID'), 'RefreshTokenService');
    });

    it('should return null for non-existent token', async () => {
      // Act
      const foundToken = await service.findRefreshToken('non-existent-token');

      // Assert
      expect(foundToken).toBeNull();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('findRefreshToken', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Finding refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Refresh token not found', 'RefreshTokenService');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid token', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      const validToken = await service.validateRefreshToken(createdToken.token);

      // Assert
      expect(validToken).toBeDefined();
      expect(validToken.token).toBe(createdToken.token);
      expect(validToken.user.id).toBe(testUser.id);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateRefreshToken', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('validateRefreshToken', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Validating refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Refresh token ID'), 'RefreshTokenService');
    });

    it('should throw UnauthorizedException for non-existent token', async () => {
      // Act & Assert
      await expect(service.validateRefreshToken('non-existent-token'))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken('non-existent-token'))
        .rejects.toThrow('Invalid refresh token');
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateRefreshToken', 'RefreshTokenService');
      expect(loggerService.warn).toHaveBeenCalledWith('Refresh token validation failed: Token not found', 'RefreshTokenService');
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      // Arrange - Create and revoke a token
      const createdToken = await service.createRefreshToken(testUser);
      await service.revokeRefreshToken(createdToken.token);
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act & Assert
      await expect(service.validateRefreshToken(createdToken.token))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken(createdToken.token))
        .rejects.toThrow('Refresh token expired or revoked');
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateRefreshToken', 'RefreshTokenService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Token expired or revoked'), 'RefreshTokenService');
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
      jest.clearAllMocks(); // Clear previous logger calls

      // Act & Assert
      await expect(service.validateRefreshToken(token.token))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.validateRefreshToken(token.token))
        .rejects.toThrow('Refresh token expired or revoked');
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateRefreshToken', 'RefreshTokenService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Token expired or revoked'), 'RefreshTokenService');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke an active token', async () => {
      // Arrange - Create a token first
      const createdToken = await service.createRefreshToken(testUser);
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      await service.revokeRefreshToken(createdToken.token);

      // Assert
      const token = await refreshTokenRepository.findOne({ token: createdToken.token });
      expect(token).toBeDefined();
      expect(token!.isRevoked).toBe(true);
      expect(token!.revokedAt).toBeDefined();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('revokeRefreshToken', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('revokeRefreshToken', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Revoking refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('revoked successfully'), 'RefreshTokenService');
      expect(loggerService.logDatabase).toHaveBeenCalledWith('update', 'RefreshToken', expect.any(Object), 'RefreshTokenService');
    });

    it('should not throw error when revoking non-existent token', async () => {
      // Act & Assert
      await expect(service.revokeRefreshToken('non-existent-token'))
        .resolves.not.toThrow();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('revokeRefreshToken', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Revoking refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Cannot revoke: Refresh token not found', 'RefreshTokenService');
    });

    it('should not modify an already revoked token', async () => {
      // Arrange - Create and revoke a token
      const createdToken = await service.createRefreshToken(testUser);
      await service.revokeRefreshToken(createdToken.token);
      
      // Get the revoked time
      const token = await refreshTokenRepository.findOne({ token: createdToken.token });
      const originalRevokedAt = token!.revokedAt;
      
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls
      
      // Act - Try to revoke again
      await service.revokeRefreshToken(createdToken.token);
      
      // Assert - Revoked time should not have changed
      const updatedToken = await refreshTokenRepository.findOne({ token: createdToken.token });
      expect(updatedToken!.revokedAt).toEqual(originalRevokedAt);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('revokeRefreshToken', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('was already revoked'), 'RefreshTokenService');
    });
  });

  describe('revokeAllUserRefreshTokens', () => {
    it('should revoke all tokens for a user', async () => {
      // Arrange - Create multiple tokens for the user
      const token1 = await service.createRefreshToken(testUser);
      const token2 = await service.createRefreshToken(testUser);
      const token3 = await service.createRefreshToken(testUser);
      
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      await service.revokeAllUserRefreshTokens(testUser.id);

      // Assert
      const tokens = await refreshTokenRepository.find({ user: { id: testUser.id } });
      expect(tokens.length).toBe(3);
      tokens.forEach(token => {
        expect(token.isRevoked).toBe(true);
        expect(token.revokedAt).toBeDefined();
      });
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('revokeAllUserRefreshTokens', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('revokeAllUserRefreshTokens', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Revoking all refresh tokens for user'), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('refresh tokens revoked for user'), 'RefreshTokenService');
      expect(loggerService.logDatabase).toHaveBeenCalledWith('update', 'RefreshToken', expect.any(Object), 'RefreshTokenService');
    });

    it('should handle users with no tokens gracefully', async () => {
      // Act & Assert
      await expect(service.revokeAllUserRefreshTokens(999))
        .resolves.not.toThrow();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('revokeAllUserRefreshTokens', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Revoking all refresh tokens for user 999'), 'RefreshTokenService');
    });
  });

  describe('rotateRefreshToken', () => {
    it('should revoke old token and create new one', async () => {
      // Arrange - Create a token first
      const originalToken = await service.createRefreshToken(testUser);
      em.clear();
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      const newToken = await service.rotateRefreshToken(originalToken.token);

      // Assert
      expect(newToken).toBeDefined();
      expect(newToken.token).not.toBe(originalToken.token);
      expect(newToken.user.id).toBe(testUser.id);
      
      // Check old token is revoked
      const oldToken = await refreshTokenRepository.findOne({ token: originalToken.token });
      expect(oldToken!.isRevoked).toBe(true);
      expect(oldToken!.revokedAt).toBeDefined();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('rotateRefreshToken', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('rotateRefreshToken', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Rotating refresh token', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Existing token ID'), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('New token ID'), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Old token ID'), 'RefreshTokenService');
      expect(loggerService.logDatabase).toHaveBeenCalledWith('update', 'RefreshToken', expect.any(Object), 'RefreshTokenService');
    });

    it('should throw when rotating invalid token', async () => {
      // Act & Assert
      await expect(service.rotateRefreshToken('non-existent-token'))
        .rejects.toThrow(UnauthorizedException);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('rotateRefreshToken', 'RefreshTokenService');
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should include request info in new token when provided', async () => {
      // Arrange
      const originalToken = await service.createRefreshToken(testUser);
      const mockRequest = {
        headers: {
          'user-agent': 'New Browser'
        },
        ip: '192.168.1.1'
      };
      em.clear();
      jest.clearAllMocks();

      // Act
      const newToken = await service.rotateRefreshToken(originalToken.token, mockRequest as any);

      // Assert
      expect(newToken.userAgent).toBe('New Browser');
      expect(newToken.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('removeExpiredTokens', () => {
    it('should revoke expired tokens', async () => {
      // Arrange - Create expired tokens
      const expiredToken1 = new RefreshToken(testUser, -1);
      const expiredToken2 = new RefreshToken(testUser, -2);
      const validToken = new RefreshToken(testUser, 30);
      
      await refreshTokenRepository.create(expiredToken1);
      await refreshTokenRepository.create(expiredToken2);
      await refreshTokenRepository.create(validToken);
      await em.flush();
      
      em.clear();
      jest.clearAllMocks();

      // Act
      const revokedCount = await service.removeExpiredTokens();

      // Assert
      expect(revokedCount).toBe(2);
      
      // Check tokens are revoked
      const tokens = await refreshTokenRepository.find({});
      const expiredTokens = tokens.filter(t => t.expiresAt < new Date());
      expiredTokens.forEach(token => {
        expect(token.isRevoked).toBe(true);
      });
      
      // Valid token should not be revoked
      const stillValidToken = tokens.find(t => t.expiresAt > new Date());
      expect(stillValidToken!.isRevoked).toBe(false);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('removeExpiredTokens', 'RefreshTokenService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('removeExpiredTokens', expect.any(Number), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Removing expired refresh tokens', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Found 2 expired tokens'), 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully revoked 2 expired tokens'), 'RefreshTokenService');
      expect(loggerService.logDatabase).toHaveBeenCalledWith('update', 'RefreshToken', expect.any(Object), 'RefreshTokenService');
    });

    it('should return 0 when no expired tokens exist', async () => {
      // Arrange - Create only valid tokens
      const validToken1 = new RefreshToken(testUser, 30);
      const validToken2 = new RefreshToken(testUser, 60);
      
      await refreshTokenRepository.create(validToken1);
      await refreshTokenRepository.create(validToken2);
      await em.flush();
      
      em.clear();
      jest.clearAllMocks();

      // Act
      const revokedCount = await service.removeExpiredTokens();

      // Assert
      expect(revokedCount).toBe(0);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('removeExpiredTokens', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith('Removing expired refresh tokens', 'RefreshTokenService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Found 0 expired tokens'), 'RefreshTokenService');
    });
  });
}); 