/**
 * Base user interface for common properties
 */
export interface BaseUser {
  id: number;
  email: string;
  nickname: string;
  imageUrl?: string | null;
}

/**
 * User type with timestamps
 */
export interface User extends BaseUser {
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal user information for message display
 */
export interface MessageUser {
  id: number;
  nickname: string;
  imageUrl?: string | null;
}

/**
 * User creation request
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  nickname: string;
}

/**
 * User login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  nickname?: string;
  email?: string;
  currentPassword?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Auth response with token
 */
export interface AuthResponse {
  user: User;
  token: string;
} 