import {
  Injectable,
  UnauthorizedException,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { User } from "../entities";
import { LoggerService, LogInterceptor } from "../logger";
import { UsersService } from "../users/users.service";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenBlacklistService } from "./token-blacklist.service";

@UseInterceptors(LogInterceptor)
@Injectable()
export class AuthService {
  private accessTokenExpiresIn: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.accessTokenExpiresIn =
      this.configService.get("JWT_ACCESS_EXPIRES_IN") ?? 60 * 60;
    this.logger.debug(
      `Access token expires in: ${this.accessTokenExpiresIn} seconds`,
      "AuthService",
    );
  }

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.debug(
      `Validating user credentials for: ${email}`,
      "AuthService",
    );

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(
        `Authentication failed: User with email ${email} not found`,
        "AuthService",
      );
      throw new UnauthorizedException("User not found");
    }

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      this.logger.warn(
        `Authentication failed: Invalid password for user ${email}`,
        "AuthService",
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    this.logger.debug(
      `User ${email} successfully authenticated`,
      "AuthService",
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any, req?: Request) {
    this.logger.debug(
      `User ${user.email} (ID: ${user.id}) initiating login`,
      "AuthService",
    );

    // Calculate exact timestamps
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    // Create access token
    const payload = {
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
      // Add precise timestamp with milliseconds to make each token unique
      iat: now,
      // Set explicit expiration time
      exp: now + this.accessTokenExpiresIn,
    };

    const accessToken = this.jwtService.sign(payload); // Override module default
    this.logger.debug(
      `Access token created for user ${user.id}`,
      "AuthService",
    );

    // Set this as the latest token and invalidate previous ones
    this.tokenBlacklistService.blacklistUserTokens(user.id);
    this.tokenBlacklistService.setLatestUserToken(user.id, accessToken);
    this.logger.debug(
      `Previous tokens blacklisted for user ${user.id}`,
      "AuthService",
    );

    // Revoke all previous refresh tokens for this user
    await this.refreshTokenService.revokeAllUserRefreshTokens(user.id);
    this.logger.debug(
      `Previous refresh tokens revoked for user ${user.id}`,
      "AuthService",
    );

    // Create refresh token
    const userAgent = req?.headers["user-agent"] || "unknown";
    const ipAddress = req?.ip || req?.socket.remoteAddress || "unknown";
    this.logger.debug(
      `Creating refresh token for user ${user.id} from ${ipAddress} with ${userAgent}`,
      "AuthService",
    );

    const refreshToken = await this.refreshTokenService.createRefreshToken(
      user,
      req,
    );
    this.logger.log(
      `User ${user.email} (ID: ${user.id}) successfully logged in`,
      "AuthService",
    );

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        imageUrl: user.imageUrl,
      },
    };
  }

  async refreshTokens(userId: number, refreshToken: string, req?: Request) {
    this.logger.debug(
      `Refreshing tokens for user ID: ${userId}`,
      "AuthService",
    );

    // Rotate the refresh token
    const userAgent = req?.headers["user-agent"] || "unknown";
    const ipAddress = req?.ip || req?.socket.remoteAddress || "unknown";
    this.logger.debug(
      `Rotating refresh token for user ${userId} from ${ipAddress} with ${userAgent}`,
      "AuthService",
    );

    const newRefreshToken = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      req,
    );
    this.logger.debug(
      `New refresh token created for user ${userId}`,
      "AuthService",
    );

    // Generate a new access token
    const user = await this.usersService.findById(userId);

    if (!user) {
      this.logger.warn(
        `Token refresh failed: User ${userId} not found`,
        "AuthService",
      );
      throw new UnauthorizedException("User not found");
    }

    // Calculate exact timestamps for the new access token
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
      iat: now,
      exp: now + this.accessTokenExpiresIn,
    };

    const accessToken = this.jwtService.sign(payload);
    this.logger.debug(
      `New access token created for user ${userId}`,
      "AuthService",
    );

    // Update the latest token
    this.tokenBlacklistService.setLatestUserToken(user.id, accessToken);
    this.logger.log(
      `Tokens refreshed successfully for user ${user.email} (ID: ${userId})`,
      "AuthService",
    );

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        imageUrl: user.imageUrl,
      },
    };
  }

  async logout(user: User): Promise<boolean> {
    try {
      this.logger.debug(`Logging out user ID: ${user.id}`, "AuthService");

      await this.refreshTokenService.revokeAllUserRefreshTokens(user.id);
      this.logger.debug(
        `All refresh tokens revoked for user ${user.id}`,
        "AuthService",
      );

      this.tokenBlacklistService.blacklistUserTokens(user.id);
      this.logger.debug(
        `All access tokens blacklisted for user ${user.id}`,
        "AuthService",
      );

      this.logger.log(
        `User ${user.email} (ID: ${user.id}) successfully logged out`,
        "AuthService",
      );
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error logging out user ${user.id}: ${errorMessage}`,
        "AuthService",
      );
      return false;
    }
  }

  async validateToken(token: string): Promise<User | null> {
    if (this.tokenBlacklistService.isBlacklisted(token)) {
      this.logger.warn(
        `Token validation failed: Token is blacklisted`,
        "AuthService",
      );
      return null;
    }

    try {
      const payload = this.jwtService.verify(token);
      this.logger.debug(
        `Token verified for user ID: ${payload.sub}`,
        "AuthService",
      );

      // Clone or recreate entity manager options to ensure proper context
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        this.logger.warn(
          `Token validation failed: User with ID ${payload.sub} not found`,
          "AuthService",
        );
        return null;
      }

      this.logger.debug(
        `Token successfully validated for user ${user.id}`,
        "AuthService",
      );
      return user;
    } catch (verifyError: unknown) {
      const errorMessage =
        verifyError instanceof Error ? verifyError.message : "Unknown error";
      this.logger.warn(
        `Token verification failed: ${errorMessage}`,
        "AuthService",
      );
      return null;
    }
  }
}
