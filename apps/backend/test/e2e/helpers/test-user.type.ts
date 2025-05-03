/**
 * Types for E2E test users and authentication
 */

/**
 * Represents a test user for E2E tests
 */
export interface TestUser {
  id: number;
  email: string;
  password: string;
  nickname: string;
}

/**
 * Represents the response from createTestUser helper function
 */
export interface TestUserResponse {
  user: TestUser;
  token: string;
  refreshToken: string;
}

/**
 * Dictionary of test users by index
 */
export interface TestUsersDict {
  [key: string]: TestUser;
}

/**
 * Dictionary of access tokens by user index
 */
export interface AccessTokensDict {
  [key: string]: string;
} 