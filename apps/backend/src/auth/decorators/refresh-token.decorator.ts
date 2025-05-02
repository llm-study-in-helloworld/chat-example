import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from 'express';
import { extractRefreshTokenFromCookieOrHeader } from "../helpers/extractor";

export const RefreshToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    return extractRefreshTokenFromCookieOrHeader(request);
  },
);