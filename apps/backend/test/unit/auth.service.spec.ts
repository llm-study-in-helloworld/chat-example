import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { RefreshTokenService } from '../../src/auth/refresh-token.service';
import { TokenBlacklistService } from '../../src/auth/token-blacklist.service';
import { User } from '../../src/entities';
import { LoggerService } from '../../src/logger/logger.service';
import { UsersService } from '../../src/users/users.service';
import testConfig from '../mikro-orm.config.test';
import { createMockLoggerService } from './fixtures/logger.fixtures';
import { createUserFixture, TestUserData } from './fixtures/user.fixtures';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let tokenBlacklistService: TokenBlacklistService;
  let refreshTokenService: RefreshTokenService;
  let loggerService: LoggerService;
  let orm: MikroORM;
  let em: EntityManager;
  let userRepository: EntityRepository<User>;

  // Test data
  const testPassword = 'TestPassword123';
  let testUser: User;
  let testUserData: TestUserData;

  beforeAll(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();

    // Create a proper TokenBlacklistService mock that tracks blacklisted tokens
    const tokenBlacklistMock = {
      blacklistUserTokens: jest.fn(),
      setLatestUserToken: jest.fn(),
      isBlacklisted: jest.fn().mockImplementation((token: string) => {
        return token === 'blacklisted-token';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User]
        }),
        JwtModule.register({
          secret: 'test-secret',
          // Do not set expiresIn here as the service adds it in the payload
          signOptions: { 
            algorithm: 'HS256'
          },
        }),
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        AuthService,
        UsersService,
        {
          provide: TokenBlacklistService,
          useValue: tokenBlacklistMock,
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn().mockImplementation(async (user) => ({
              token: 'refresh-token',
              user: user,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              isRevoked: false,
              isValid: () => true,
            })),
            rotateRefreshToken: jest.fn().mockImplementation(async () => ({
              token: 'new-refresh-token',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              isRevoked: false,
              isValid: () => true,
            })),
            revokeAllUserRefreshTokens: jest.fn(),
            validateRefreshToken: jest.fn().mockImplementation(async (token) => {
              if (token === 'valid-refresh-token') {
                return {
                  token,
                  user: testUser,
                  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  isRevoked: false,
                  isValid: () => true,
                  revoke: jest.fn(),
                };
              }
              throw new UnauthorizedException('Invalid refresh token');
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_ACCESS_EXPIRES_IN') return 3600; // 1 hour
              return null;
            }),
          },
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
    loggerService = module.get<LoggerService>(LoggerService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    userRepository = em.getRepository(User);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create a test user using fixture
    testUserData = await createUserFixture(em, {
      email: 'test@example.com',
      nickname: 'TestUser',
      password: testPassword,
      imageUrl: 'http://example.com/avatar.jpg'
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
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user object without password when credentials are valid', async () => {
      // Act
      const result = await authService.validateUser('test@example.com', testPassword);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.nickname).toBe('TestUser');
      expect(result.passwordHash).toBeUndefined();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateUser', 'AuthService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('validateUser', expect.any(Number), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Validating user credentials'), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('successfully authenticated'), 'AuthService');
    });

    it('should throw UnauthorizedException when email is invalid', async () => {
      // Act & Assert
      await expect(authService.validateUser('wrong@example.com', testPassword))
        .rejects.toThrow(UnauthorizedException);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateUser', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'), 'AuthService');
      expect(loggerService.error).toHaveBeenCalledWith(expect.stringContaining('Error validating user credentials'), expect.any(String), 'AuthService');
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Act & Assert
      await expect(authService.validateUser('test@example.com', 'wrongPassword'))
        .rejects.toThrow(UnauthorizedException);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateUser', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Authentication failed: Invalid password'), 'AuthService');
    });
  });

  describe('login', () => {
    it('should return access token, refresh token and user data', async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({ email: 'test@example.com' });
      
      // Act
      const result = await authService.login(user);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.nickname).toBe('TestUser');
      expect(result.user.imageUrl).toBe('http://example.com/avatar.jpg');
      
      // Verify service interactions
      expect(refreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id }), 
        undefined
      );
      expect(refreshTokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(user.id);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('login', 'AuthService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('login', expect.any(Number), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('User test@example.com'), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Access token created'), 'AuthService');
      expect(loggerService.log).toHaveBeenCalledWith(expect.stringContaining('successfully logged in'), 'AuthService');
    });

    it('should include request info when provided', async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({ email: 'test@example.com' });
      const mockRequest = {
        headers: {
          'user-agent': 'Test Browser'
        },
        ip: '192.168.1.1'
      };
      
      // Act
      await authService.login(user, mockRequest as any);
      
      // Assert
      expect(refreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id }), 
        mockRequest
      );
      
      // Verify logger was called with request info
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('from 192.168.1.1 with Test Browser'), 'AuthService');
    });
  });

  describe('refreshTokens', () => {
    it('should generate new access and refresh tokens when refresh token is valid', async () => {
      // Arrange
      const userId = testUser.id;
      
      // Act
      const result = await authService.refreshTokens(userId, 'valid-refresh-token');

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(userId);
      
      // Verify service interactions
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'valid-refresh-token', 
        undefined
      );
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('refreshTokens', 'AuthService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('refreshTokens', expect.any(Number), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining(`Refreshing tokens for user ID: ${userId}`), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('New refresh token created'), 'AuthService');
      expect(loggerService.log).toHaveBeenCalledWith(expect.stringContaining('Tokens refreshed successfully'), 'AuthService');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      // Act & Assert
      await expect(authService.refreshTokens(999, 'valid-refresh-token'))
        .rejects.toThrow(UnauthorizedException);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('refreshTokens', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Token refresh failed: User 999 not found'), 'AuthService');
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens and blacklist user tokens', async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({ email: 'test@example.com' });
      
      jest.spyOn(refreshTokenService, 'revokeAllUserRefreshTokens').mockResolvedValue();
      jest.spyOn(tokenBlacklistService, 'blacklistUserTokens').mockResolvedValue();
      
      // Act
      const result = await authService.logout(user);

      // Assert
      expect(result).toBe(true);
      expect(refreshTokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(user.id);
      expect(tokenBlacklistService.blacklistUserTokens).toHaveBeenCalledWith(user.id);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('logout', 'AuthService');
      expect(loggerService.logMethodExit).toHaveBeenCalledWith('logout', expect.any(Number), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining(`Logging out user ID: ${user.id}`), 'AuthService');
      expect(loggerService.log).toHaveBeenCalledWith(expect.stringContaining('successfully logged out'), 'AuthService');
    });

    it('should return false when an error occurs', async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({ email: 'test@example.com' });
      
      jest.spyOn(refreshTokenService, 'revokeAllUserRefreshTokens').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = await authService.logout(user);

      // Assert
      expect(result).toBe(false);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('logout', 'AuthService');
      expect(loggerService.error).toHaveBeenCalledWith(expect.stringContaining('Error logging out user'), expect.any(String), 'AuthService');
    });
  });

  describe('validateToken', () => {
    it('should return user when token is valid', async () => {
      // Arrange
      const token = 'valid-token';
      
      // Mock the JwtService.verify to return a payload
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: testUser.id });
      
      // Mock the TokenBlacklistService.isBlacklisted to return false for this test
      jest.spyOn(tokenBlacklistService, 'isBlacklisted').mockReturnValue(false);
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(testUser.id);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateToken', 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Token verified for user ID'), 'AuthService');
      expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Token successfully validated'), 'AuthService');
    });

    it('should return null when token is blacklisted', async () => {
      // Arrange
      const token = 'blacklisted-token';
      
      // Make sure jwt.verify returns valid test user payload
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: testUser.id });
      
      // Explicitly mock the isBlacklisted method for this test
      jest.spyOn(tokenBlacklistService, 'isBlacklisted').mockReturnValue(true);
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateToken', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Token validation failed: Token is blacklisted'), 'AuthService');
    });

    it('should return null when token verification fails', async () => {
      // Arrange
      const token = 'invalid-token';
      
      // Mock the JwtService.verify to throw an error
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Mock the TokenBlacklistService.isBlacklisted
      jest.spyOn(tokenBlacklistService, 'isBlacklisted').mockReturnValue(false);
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateToken', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Token verification failed'), 'AuthService');
    });

    it('should return null when user is not found', async () => {
      // Arrange
      const token = 'valid-token-unknown-user';
      
      // Mock the JwtService.verify to return a payload with an unknown user ID
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 999 });
      
      // Mock the TokenBlacklistService.isBlacklisted
      jest.spyOn(tokenBlacklistService, 'isBlacklisted').mockReturnValue(false);
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith('validateToken', 'AuthService');
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('User with ID 999 not found'), 'AuthService');
    });
  });
}); 