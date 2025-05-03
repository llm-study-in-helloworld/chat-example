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
import { UsersService } from '../../src/users/users.service';
import testConfig from '../mikro-orm.config.test';
import { createUserFixture, TestUserData } from './fixtures/user.fixtures';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let tokenBlacklistService: TokenBlacklistService;
  let refreshTokenService: RefreshTokenService;
  let orm: MikroORM;
  let em: EntityManager;
  let userRepository: EntityRepository<User>;

  // Test data
  const testPassword = 'TestPassword123';
  let testUser: User;
  let testUserData: TestUserData;

  beforeAll(async () => {
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
        TokenBlacklistService,
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistUserTokens: jest.fn(),
            setLatestUserToken: jest.fn(),
            isBlacklisted: jest.fn().mockImplementation((token) => token === 'blacklisted-token'),
          },
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
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
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

  describe('validateUser', () => {
    it('should return user object without password when credentials are valid', async () => {
      // Act
      const result = await authService.validateUser('test@example.com', testPassword);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.nickname).toBe('TestUser');
      expect(result.passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException when email is invalid', async () => {
      // Act & Assert
      await expect(authService.validateUser('wrong@example.com', testPassword))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Act & Assert
      await expect(authService.validateUser('test@example.com', 'wrongPassword'))
        .rejects.toThrow(UnauthorizedException);
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
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      // Act & Assert
      await expect(authService.refreshTokens(999, 'valid-refresh-token'))
        .rejects.toThrow(UnauthorizedException);
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
    });
  });

  describe('validateToken', () => {
    it('should return user when token is valid', async () => {
      // Arrange
      const token = jwtService.sign({ sub: testUser.id, email: testUser.email });
      
      jest.spyOn(tokenBlacklistService, 'isBlacklisted').mockReturnValue(false);
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(testUser.id);
      expect(result!.email).toBe(testUser.email);
    });

    it('should return null when token is blacklisted', async () => {
      // Arrange
      const token = 'blacklisted-token';
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when token is invalid', async () => {
      // Arrange
      const token = 'invalid-token';
      
      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
    });
  });
}); 