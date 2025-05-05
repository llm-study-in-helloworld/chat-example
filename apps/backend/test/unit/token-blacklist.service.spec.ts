import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { TokenBlacklistService } from "../../src/auth/token-blacklist.service";
import { LoggerService } from "../../src/logger/logger.service";
import { createMockLoggerService } from "./fixtures/logger.fixtures";

describe("TokenBlacklistService", () => {
  let service: TokenBlacklistService;
  let jwtService: JwtService;
  let loggerService: LoggerService;
  let intervalRef: NodeJS.Timeout;

  const mockDecodedToken = (userId: number, expiryInSeconds: number) => ({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + expiryInSeconds,
    iat: Math.floor(Date.now() / 1000),
    email: "test@example.com",
  });

  const createToken = (userId: number, expiryInSeconds: number) => {
    return `token-${userId}-${expiryInSeconds}-${Date.now()}`;
  };

  beforeEach(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();

    // Create mocks
    const jwtServiceMock = {
      decode: jest.fn().mockImplementation((token: string) => {
        if (token.startsWith("token-")) {
          const parts = token.split("-");
          const userId = parseInt(parts[1], 10);
          const expiryInSeconds = parseInt(parts[2], 10);
          return mockDecodedToken(userId, expiryInSeconds);
        }
        if (token === "invalid-token") {
          return null;
        }
        if (token === "expired-token") {
          return {
            sub: 1,
            exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
            iat: Math.floor(Date.now() / 1000) - 7200,
          };
        }
        return null;
      }),
      sign: jest.fn().mockImplementation((payload) => {
        return `token-${payload.sub}-${
          payload.exp - Math.floor(Date.now() / 1000)
        }-${Date.now()}`;
      }),
      verify: jest.fn().mockImplementation((token) => {
        if (token.startsWith("token-")) {
          const parts = token.split("-");
          const userId = parseInt(parts[1], 10);
          const expiryInSeconds = parseInt(parts[2], 10);
          return mockDecodedToken(userId, expiryInSeconds);
        }
        throw new Error("Invalid token");
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    jwtService = module.get<JwtService>(JwtService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Mock setInterval to avoid actual timed execution
    jest.spyOn(global, "setInterval").mockImplementation((callback, delay) => {
      intervalRef = { unref: jest.fn() } as unknown as NodeJS.Timeout;
      return intervalRef;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();

    // Clear the interval if it exists
    if (intervalRef) {
      clearInterval(intervalRef as unknown as NodeJS.Timeout);
    }

    // Restore the original setInterval implementation
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("blacklistToken", () => {
    it("should add a token to the blacklist", async () => {
      // Arrange
      const token = createToken(1, 3600); // Valid for 1 hour

      // Act
      await service.blacklistToken(token);

      // Assert
      expect(service.isBlacklisted(token)).toBe(true);
      expect(jwtService.decode).toHaveBeenCalledWith(token);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "blacklistToken",
        "TokenBlacklistService",
      );
      expect(loggerService.logMethodExit).toHaveBeenCalledWith(
        "blacklistToken",
        expect.any(Number),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Token for user 1 added to blacklist"),
        "TokenBlacklistService",
      );
    });

    it("should handle invalid tokens gracefully", async () => {
      // Arrange
      const token = "invalid-token";

      // Act
      await service.blacklistToken(token);

      // Assert
      expect(service.isBlacklisted(token)).toBe(false);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "blacklistToken",
        "TokenBlacklistService",
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        "Failed to blacklist token: Invalid token format",
        "TokenBlacklistService",
      );
    });
  });

  describe("blacklistUserTokens", () => {
    it("should blacklist all tokens for a user", async () => {
      // Arrange
      const userId = 1;
      const token1 = createToken(userId, 3600);
      const token2 = createToken(userId, 7200);

      // Add tokens for the user
      service["userTokens"].set(userId, new Set([token1, token2]));

      // Act
      service.blacklistUserTokens(userId);

      // Assert
      expect(service.isBlacklisted(token1)).toBe(true);
      expect(service.isBlacklisted(token2)).toBe(true);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "blacklistUserTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.logMethodExit).toHaveBeenCalledWith(
        "blacklistUserTokens",
        expect.any(Number),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Blacklisting all tokens for user ${userId}`),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Successfully blacklisted`),
        "TokenBlacklistService",
      );
    });

    it("should handle users with no tokens gracefully", async () => {
      // Act & Assert
      expect(() => service.blacklistUserTokens(999)).not.toThrow();

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "blacklistUserTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Blacklisting all tokens for user 999"),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        "No existing tokens found for user 999",
        "TokenBlacklistService",
      );
    });

    it("should remove the latest token reference when blacklisting all user tokens", async () => {
      // Arrange
      const userId = 1;
      const token = createToken(userId, 3600);

      // Set the token as the latest for the user
      service.setLatestUserToken(userId, token);

      // Act
      service.blacklistUserTokens(userId);

      // Assert
      expect(service["latestUserTokens"].has(userId)).toBe(false);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "blacklistUserTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Removed latest token reference for user"),
        "TokenBlacklistService",
      );
    });
  });

  describe("setLatestUserToken", () => {
    it("should store the latest token for a user", () => {
      // Arrange
      const userId = 1;
      const token = createToken(userId, 3600);

      // Act
      service.setLatestUserToken(userId, token);

      // Assert
      expect(service["latestUserTokens"].get(userId)).toBe(token);
      expect(service["userTokens"].get(userId)?.has(token)).toBe(true);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "setLatestUserToken",
        "TokenBlacklistService",
      );
      expect(loggerService.logMethodExit).toHaveBeenCalledWith(
        "setLatestUserToken",
        expect.any(Number),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Setting latest token for user ${userId}`),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Latest token for user"),
        "TokenBlacklistService",
      );
    });

    it("should initialize user tokens set if it does not exist", () => {
      // Arrange
      const userId = 2;
      const token = createToken(userId, 3600);

      // Act
      service.setLatestUserToken(userId, token);

      // Assert
      expect(service["userTokens"].has(userId)).toBe(true);
      expect(service["userTokens"].get(userId)?.size).toBe(1);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "setLatestUserToken",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Setting latest token for user ${userId}`),
        "TokenBlacklistService",
      );
    });
  });

  describe("isBlacklisted", () => {
    it("should return true when token is in the blacklist", async () => {
      // Arrange
      const token = createToken(1, 3600);
      await service.blacklistToken(token);
      jest.clearAllMocks(); // Clear previous logger calls

      // Act & Assert
      expect(service.isBlacklisted(token)).toBe(true);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "isBlacklisted",
        "TokenBlacklistService",
      );
      expect(loggerService.logMethodExit).toHaveBeenCalledWith(
        "isBlacklisted",
        expect.any(Number),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        "Token is blacklisted",
        "TokenBlacklistService",
      );
    });

    it("should return false when token is not in the blacklist", () => {
      // Arrange
      const token = createToken(1, 3600);

      // Act & Assert
      expect(service.isBlacklisted(token)).toBe(false);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "isBlacklisted",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        "Token is not blacklisted",
        "TokenBlacklistService",
      );
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should remove expired tokens from the blacklist", async () => {
      // Arrange
      const expiredToken = createToken(1, -3600); // Expired 1 hour ago
      const validToken = createToken(2, 3600); // Valid for 1 hour

      await service.blacklistToken(expiredToken);
      await service.blacklistToken(validToken);

      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service["blacklist"].set(expiredToken, expiredDate);
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      service["cleanupExpiredTokens"]();

      // Assert
      expect(service.isBlacklisted(expiredToken)).toBe(false);
      expect(service.isBlacklisted(validToken)).toBe(true);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "cleanupExpiredTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.logMethodExit).toHaveBeenCalledWith(
        "cleanupExpiredTokens",
        expect.any(Number),
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        "Starting cleanup of expired tokens",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Cleanup completed"),
        "TokenBlacklistService",
      );
    });

    it("should remove expired tokens from user token sets", async () => {
      // Arrange
      const userId = 1;
      const expiredToken = createToken(userId, -3600); // Expired 1 hour ago
      const validToken = createToken(userId, 3600); // Valid for 1 hour

      service["userTokens"].set(userId, new Set([expiredToken, validToken]));
      await service.blacklistToken(expiredToken);
      await service.blacklistToken(validToken);

      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service["blacklist"].set(expiredToken, expiredDate);
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      service["cleanupExpiredTokens"]();

      // Assert
      expect(service["userTokens"].get(userId)?.has(expiredToken)).toBe(false);
      expect(service["userTokens"].get(userId)?.has(validToken)).toBe(true);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "cleanupExpiredTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        "Starting cleanup of expired tokens",
        "TokenBlacklistService",
      );
    });

    it("should remove latest token reference if it is expired", async () => {
      // Arrange
      const userId = 1;
      const expiredToken = createToken(userId, -3600); // Expired 1 hour ago

      service.setLatestUserToken(userId, expiredToken);
      await service.blacklistToken(expiredToken);

      // Set expiry in the past for expired token
      const expiredDate = new Date(Date.now() - 3600 * 1000);
      service["blacklist"].set(expiredToken, expiredDate);
      jest.clearAllMocks(); // Clear previous logger calls

      // Act
      service["cleanupExpiredTokens"]();

      // Assert
      expect(service["latestUserTokens"].has(userId)).toBe(false);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "cleanupExpiredTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.debug).toHaveBeenCalledWith(
        expect.stringContaining("Removed expired latest token for user"),
        "TokenBlacklistService",
      );
    });

    it("should handle errors during cleanup gracefully", async () => {
      // Arrange
      const userId = 1;
      const badToken = createToken(userId, -3600);

      // Add token to blacklist but make decode throw an error
      service["userTokens"].set(userId, new Set([badToken]));
      service["blacklist"].set(badToken, new Date(Date.now() - 3600 * 1000));

      // Force an error when trying to decode the token
      jest.spyOn(jwtService, "decode").mockImplementation(() => {
        throw new Error("Test error");
      });
      jest.clearAllMocks(); // Clear previous logger calls

      // Act - Should not throw
      service["cleanupExpiredTokens"]();

      // Assert
      expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
        "cleanupExpiredTokens",
        "TokenBlacklistService",
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining("Error during token cleanup"),
        "TokenBlacklistService",
      );
    });
  });
});
