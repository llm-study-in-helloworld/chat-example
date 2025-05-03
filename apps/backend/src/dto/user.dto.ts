/**
 * User 엔티티의 기본 속성을 정의하는 인터페이스
 */
import { User } from '../entities';

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
 * 응답 시 사용하는 User 클래스
 */
export class UserResponseDto implements Omit<UserDto, 'createdAt' | 'updatedAt'> {
  id: number = 0;
  email: string = '';
  nickname: string = '';
  imageUrl?: string;
  createdAt: string = '';
  updatedAt: string = '';

  /**
   * User 엔티티를 ResponseDto로 변환
   */
  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.nickname = user.nickname;
    dto.imageUrl = user.imageUrl;
    dto.createdAt = user.createdAt.toISOString();
    dto.updatedAt = user.updatedAt.toISOString();
    return dto;
  }
} 