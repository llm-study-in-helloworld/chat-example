import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenBlacklistService } from '../../src/auth/token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: JwtService,
          useValue: {
            decode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blacklistToken', () => {
    it('should add a token to the blacklist', async () => {
      // Mock JWT decode to return a valid expiry
      const mockExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      (jwtService.decode as jest.Mock).mockReturnValue({ exp: mockExpiry });

      const token = 'valid.jwt.token';
      await service.blacklistToken(token);

      // Check if token is blacklisted
      expect(service.isBlacklisted(token)).toBe(true);
    });

    it('should handle invalid tokens gracefully', async () => {
      // Mock JWT decode to return null (invalid token)
      (jwtService.decode as jest.Mock).mockReturnValue(null);

      const token = 'invalid.token';
      await service.blacklistToken(token);

      // Token should not be blacklisted
      expect(service.isBlacklisted(token)).toBe(false);
    });
  });

  describe('isBlacklisted', () => {
    it('should return true for blacklisted tokens', async () => {
      // Add a token to the blacklist
      const mockExpiry = Math.floor(Date.now() / 1000) + 3600;
      (jwtService.decode as jest.Mock).mockReturnValue({ exp: mockExpiry });

      const token = 'blacklisted.token';
      await service.blacklistToken(token);

      expect(service.isBlacklisted(token)).toBe(true);
    });

    it('should return false for non-blacklisted tokens', () => {
      expect(service.isBlacklisted('non.blacklisted.token')).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens from the blacklist', async () => {
      // Mock Date.now to return a fixed timestamp
      const originalNow = Date.now;
      const currentTime = new Date('2023-01-01T00:00:00Z').getTime();
      global.Date.now = jest.fn(() => currentTime);

      // Add an expired token (expired 1 hour ago)
      const expiredTimestamp = Math.floor(currentTime / 1000) - 3600;
      (jwtService.decode as jest.Mock).mockReturnValue({ exp: expiredTimestamp });
      const expiredToken = 'expired.token';
      await service.blacklistToken(expiredToken);

      // Add a valid token (expires in 1 hour)
      const validTimestamp = Math.floor(currentTime / 1000) + 3600;
      (jwtService.decode as jest.Mock).mockReturnValue({ exp: validTimestamp });
      const validToken = 'valid.token';
      await service.blacklistToken(validToken);

      // Check both tokens are in the blacklist
      expect(service.isBlacklisted(expiredToken)).toBe(true);
      expect(service.isBlacklisted(validToken)).toBe(true);

      // Fast-forward time by 2 hours
      const newTime = currentTime + (2 * 60 * 60 * 1000);
      global.Date.now = jest.fn(() => newTime);

      // Call private cleanup method
      (service as any).cleanupExpiredTokens();

      // Expired token should be removed, valid token should remain
      expect(service.isBlacklisted(expiredToken)).toBe(false);
      expect(service.isBlacklisted(validToken)).toBe(true);

      // Restore original Date.now
      global.Date.now = originalNow;
    });
  });
}); 