import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../entities';

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
    private readonly em: EntityManager,
    private readonly configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.em.findOne(User, { id: payload.sub });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
} 