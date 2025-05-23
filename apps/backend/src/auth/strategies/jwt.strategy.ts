import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import { extractJwtFromCookieOrAuthHeader } from "../helpers/extractor";
import { TokenBlacklistService } from "../token-blacklist.service";

interface JwtPayload {
  sub: number; // 사용자 ID
  email: string;
  nickname: string;
  iat: number; // 발급 시간
  exp: number; // 만료 시간
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrAuthHeader,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET") || "your-secret-key",
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // 토큰 획득
    const token = extractJwtFromCookieOrAuthHeader(req);

    // 토큰이 블랙리스트에 있는지 확인
    if (token && this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException("로그아웃된 토큰입니다");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
