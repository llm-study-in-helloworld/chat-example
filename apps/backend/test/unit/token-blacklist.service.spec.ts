import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenBlacklistService } from '../../src/auth/token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let jwtService: JwtService;

  const mockDecodedToken = (userId: number, expiryInSeconds: number) => ({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + expiryInSeconds,
    iat: Math.floor(Date.now() / 1000),
    email: 'test@example.com'
  });
  
  const createToken = (userId: number, expiryInSeconds: number) => {
    return `token-${userId}-${expiryInSeconds}-${Date.now()}`;
  };

  beforeEach(async () => {
    // Create mocks
    const jwtServiceMock = {
      decode: jest.fn().mockImplementation((token: string) => {
        if (token.startsWith('token-')) {
          const parts = token.split('-');
          const userId = parseInt(parts[1], 10);
          const expiryInSeconds = parseInt(parts[2], 10);
          return mockDecodedToken(userId, expiryInSeconds);
        }
        if (token === 'invalid-token') {
          return null;
        }
        if (token === 'expired-token') {
          return {
            sub: 1,
            exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
            iat: Math.floor(Date.now() / 1000) - 7200
          };
        }
        return null;
      }),
      sign: jest.fn().mockImplementation((payload) => {
        return `token-${payload.sub}-${payload.exp - Math.floor(Date.now() / 1000)}-${Date.now()}`;
      }),
      verify: jest.fn().mockImplementation((token) => {
        if (token.startsWith('token-')) {
          const parts = token.split('-');
          const userId = parseInt(parts[1], 10);
          const expiryInSeconds = parseInt(parts[2], 10);
          return mockDecodedToken(userId, expiryInSeconds);
        }
        throw new Error('Invalid token');
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: JwtService,
          useValue: jwtServiceMock
        }
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    jwtService = module.get<JwtService>(JwtService);

    // Mock setInterval to avoid actual timed execution
    jest.spyOn(global, 'setInterval').mockImplementation(() => {
      return { unref: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('blacklistToken', () => {
    it('should add a token to the blacklist', async () => {
      // Arrange
      const token = createToken(1, 3600); // Valid for 1 hour
      
      // Act
      await service.blacklistToken(token);
      
      // Assert
      expect(service.isBlacklisted(token)).toBe(true);
      expect(jwtService.decode).toHaveBeenCalledWith(token);
    });

    it('should handle invalid tokens gracefully', async () => {
      // Arrange
      const token = 'invalid-token';
      
      // Act
      await service.blacklistToken(token);
      
      // Assert
      expect(service.isBlacklisted(token)).toBe(false);
    });
  });

  describe('blacklistUserTokens', () => {
    it('should blacklist all tokens for a user', async () => {
      // Arrange
      const userId = 1;
      const token1 = createToken(userId, 3600);
      const token2 = createToken(userId, 7200);
      
      // Add tokens for the user
      service['userTokens'].set(userId, new Set([token1, token2]));
      
      // Act
      await service.blacklistUserTokens(userId);
      
      // Assert
      expect(service.isBlacklisted(token1)).toBe(true);
      expect(service.isBlacklisted(token2)).toBe(true);
    });

    it('should handle users with no tokens gracefully', async () => {
      // Act & Assert
      await expect(service.blacklistUserTokens(999)).resolves.not.toThrow();
    });

    it('should remove the latest token reference when blacklisting all user tokens', async () => {
      // Arrange
      const userId = 1;
      const token = createToken(userId, 3600);
      
      // Set the token as the latest for the user
      service.setLatestUserToken(userId, token);
      
      // Act
      await service.blacklistUserTokens(userId);
      
      // Assert
      expect(service['latestUserTokens'].has(userId)).toBe(false);
    });
  });

  describe('setLatestUserToken', () => {
    it('should store the latest token for a user', () => {
      // Arrange
      const userId = 1;
      const token = createToken(userId, 3600);
      
      // Act
      service.setLatestUserToken(userId, token);
      
      // Assert
      expect(service['latestUserTokens'].get(userId)).toBe(token);
      expect(service['userTokens'].get(userId)?.has(token)).toBe(true);
    });

    it('should initialize user tokens set if it does not exist', () => {
      // Arrange
      const userId = 2;
      const token = createToken(userId, 3600);
      
      // Act
      service.setLatestUserToken(userId, token);
      
      // Assert
      expect(service['userTokens'].has(userId)).toBe(true);
      expect(service['userTokens'].get(userId)?.size).toBe(1);
    });
  });

  describe('isBlacklisted', () => {
    it('should return true when token is in the blacklist', async () => {
      // Arrange
      const token = createToken(1, 3600);
      await service.blacklistToken(token);
      
      // Act & Assert
      expect(service.isBlacklisted(token)).toBe(true);
    });

    it('should return false when token is not in the blacklist', () => {
      // Arrange
      const token = createToken(1, 3600);
      
      // Act & Assert
      expect(service.isBlacklisted(token)).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens from the blacklist', async () => {
      // Arrange
      const expiredToken = createToken(1, -3600); // Expired 1 hour ago
      const validToken = createToken(2, 3600); // Valid for 1 hour
      
      await service.blacklistToken(expiredToken);
      await service.blacklistToken(validToken);
      
      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service['blacklist'].set(expiredToken, expiredDate);
      
      // Act
      service['cleanupExpiredTokens']();
      
      // Assert
      expect(service.isBlacklisted(expiredToken)).toBe(false);
      expect(service.isBlacklisted(validToken)).toBe(true);
    });

    it('should remove expired tokens from user token sets', async () => {
      // Arrange
      const userId = 1;
      const expiredToken = createToken(userId, -3600); // Expired 1 hour ago
      const validToken = createToken(userId, 3600); // Valid for 1 hour
      
      service['userTokens'].set(userId, new Set([expiredToken, validToken]));
      await service.blacklistToken(expiredToken);
      await service.blacklistToken(validToken);
      
      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service['blacklist'].set(expiredToken, expiredDate);
      
      // Act
      service['cleanupExpiredTokens']();
      
      // Assert
      expect(service['userTokens'].get(userId)?.has(expiredToken)).toBe(false);
      expect(service['userTokens'].get(userId)?.has(validToken)).toBe(true);
    });

    it('should remove latest token reference if it is expired', async () => {
      // Arrange
      const userId = 1;
      const expiredToken = createToken(userId, -3600); // Expired 1 hour ago
      
      service.setLatestUserToken(userId, expiredToken);
      await service.blacklistToken(expiredToken);
      
      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service['blacklist'].set(expiredToken, expiredDate);
      
      // Act
      service['cleanupExpiredTokens']();
      
      // Assert
      expect(service['latestUserTokens'].has(userId)).toBe(false);
    });

    it('should not remove latest token reference if token is different', async () => {
      // Arrange
      const userId = 1;
      const expiredToken = createToken(userId, -3600); // Expired 1 hour ago
      const latestToken = createToken(userId, 3600); // Valid for 1 hour
      
      service.setLatestUserToken(userId, latestToken);
      await service.blacklistToken(expiredToken);
      
      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service['blacklist'].set(expiredToken, expiredDate);
      
      // Act
      service['cleanupExpiredTokens']();
      
      // Assert
      expect(service['latestUserTokens'].get(userId)).toBe(latestToken);
    });
  });
}); 