import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extracts the refresh token from the request
 * This can come from either a cookie or a header
 */
export const RefreshToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    
    // First try to get from cookie
    const cookieToken = request.cookies?.refresh_token;
    if (cookieToken) {
      return cookieToken;
    }
    
    // Then try to get from authorization header (for API clients)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Check if it's a refresh token by examining the payload structure
      // This is a simplistic approach; in production you might want more robust checks
      const token = authHeader.substring(7);
      try {
        // If this is a refresh token, the client should specify it's a refresh token
        // using a custom header
        if (request.headers['x-token-type'] === 'refresh') {
          return token;
        }
      } catch (e) {
        // If we can't parse the token, it's not a valid refresh token
        return undefined;
      }
    }
    
    // Finally try to get from a dedicated header
    return request.headers['x-refresh-token'];
  },
);