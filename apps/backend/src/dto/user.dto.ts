/**
 * User 엔티티의 기본 속성을 정의하는 인터페이스
 */
import { AuthResponse, User } from "@chat-example/types";
import { User as UserEntity } from "../entities";

/**
 * 응답 시 사용하는 User 클래스
 */
export class UserResponseDto implements User {
  id: number = 0;
  email: string = "";
  nickname: string = "";
  imageUrl?: string;
  createdAt: string = "";
  updatedAt: string = "";

  /**
   * User 엔티티를 ResponseDto로 변환
   */
  static fromEntity(user: UserEntity): UserResponseDto {
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

export class AuthResponseDto implements AuthResponse {
  token: string = "";
  user: UserResponseDto = new UserResponseDto();

  static fromEntity(user: UserEntity, token: string): AuthResponseDto {
    const dto = new AuthResponseDto();

    dto.token = token;
    dto.user = UserResponseDto.fromEntity(user);

    return dto;
  }
}
