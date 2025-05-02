import { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';

/**
 * Helper function to extract token from cookie or Authorization header
 */
export const extractRefreshTokenFromCookieOrHeader = (req: Request): string | null => {
  // First priority: Check if we have the refresh token as a cookie
  if (req.cookies && req.cookies.refresh_token) {
    return req.cookies.refresh_token;
  }
  
  // Second priority: Try to parse the cookie header manually
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
    const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refresh_token='));
    
    if (refreshTokenCookie) {
      const token = refreshTokenCookie.split('=')[1];
      return token;
    }
  }
  
  // Last priority: Check if it's being sent as a Bearer token in the Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

/**
 * JWT 추출 함수 - 쿠키 또는 Authorization 헤더에서 토큰 추출
 */
export const extractJwtFromCookieOrAuthHeader = (req: Request): string | null => {
  if (req.cookies && req.cookies.jwt) {
    return req.cookies.jwt;
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};