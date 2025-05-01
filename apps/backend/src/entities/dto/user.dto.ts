/**
 * User 엔티티의 기본 속성을 정의하는 인터페이스
 */
export interface UserDto {
  id: number;
  email: string;
  nickname: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 인증 시 사용하는 User 인터페이스
 */
export interface AuthUserDto extends UserDto {
  passwordHash: string;
}

/**
 * 응답 시 사용하는 User 인터페이스
 */
export interface UserResponseDto extends Omit<UserDto, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
} 