import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthResponseDto, UserResponseDto } from "../dto";
import { User } from "../entities";
import { ChangePasswordDto } from "../users/dto/change-password.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { DeleteUserDto } from "../users/dto/delete-user.dto";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { RefreshToken } from "./decorators/refresh-token.decorator";
import { CurrentUser } from "./decorators/user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RefreshTokenAuthGuard } from "./guards/refresh-token-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 회원 가입 엔드포인트
   */
  @Post("signup")
  async signup(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.createUser(createUserDto);
  }

  @Post("login")
  async login(
    @Body() loginDto: { email: string; password: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    try {
      // First, clear any existing cookies
      response.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      response.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
      });

      const user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
      );

      // Use the login method from AuthService to get tokens
      const result = await this.authService.login(user, request);

      // Set the access token as a cookie
      response.cookie("jwt", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
        path: "/",
      });

      // Set the refresh token as a cookie with longer expiration
      response.cookie("refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/api/auth/refresh", // Restrict to the refresh endpoint path
      });

      return AuthResponseDto.fromEntity(user, result.accessToken);
    } catch (error) {
      throw new UnauthorizedException("Invalid credentials");
    }
  }

  /**
   * 비밀번호 변경 엔드포인트
   */
  @UseGuards(JwtAuthGuard)
  @Patch("password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: boolean }> {
    // First, try to change the password
    const success = await this.usersService.changePassword(
      user,
      changePasswordDto,
    );

    if (!success) {
      throw new UnauthorizedException("Invalid password");
    }

    // If password change was successful, invalidate all tokens
    await this.authService.logout(user);

    // Clear all cookies to ensure the client has to log in again
    response.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
    });

    // Set expired cookies to ensure they're removed from the client
    response.cookie("jwt", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    response.cookie("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/api/auth/refresh",
    });

    // Return success response
    return { success: true };
  }

  /**
   * 액세스 토큰 갱신 엔드포인트
   */
  @UseGuards(RefreshTokenAuthGuard)
  @Post("refresh")
  async refreshTokens(
    @Req() request: Request,
    @CurrentUser() user: User,
    @RefreshToken() refreshToken: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    try {
      const result = await this.authService.refreshTokens(
        user.id,
        refreshToken,
        request,
      );

      // 쿠키 제거
      response.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      response.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
      });

      // Set the new access token as a cookie
      response.cookie("jwt", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
        path: "/",
      });

      // Set the new refresh token as a cookie
      response.cookie("refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/api/auth/refresh", // Restrict to the refresh endpoint path
      });

      return AuthResponseDto.fromEntity(user, result.accessToken);
    } catch (error) {
      console.error("Error refreshing token:", error);

      // Clear the cookies if there's an error
      response.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      response.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
      });

      throw new UnauthorizedException("Failed to refresh token");
    }
  }

  /**
   * 로그아웃 엔드포인트
   * 클라이언트의 쿠키를 강제로 제거하고 토큰을 무효화
   */
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    // Pass the user to ensure all tokens for this user are revoked
    if (!(await this.authService.logout(user))) {
      throw new UnauthorizedException("Failed to logout");
    }

    // 쿠키 제거
    response.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
    });

    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie("jwt", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    response.cookie("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/api/auth/refresh",
    });

    return { message: "Logged out successfully" };
  }

  /**
   * 회원 탈퇴 엔드포인트
   * 사용자 계정을 완전히 삭제
   */
  @UseGuards(JwtAuthGuard)
  @Delete("signout")
  @HttpCode(HttpStatus.OK)
  async signout(
    @CurrentUser() user: User,
    @Body() deleteUserDto: DeleteUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    // 계정 삭제
    const success = await this.usersService.deleteUser(
      user,
      deleteUserDto.password,
    );
    if (!success) {
      throw new UnauthorizedException("Failed to delete account");
    }

    // Pass the user to ensure all tokens are revoked
    if (!(await this.authService.logout(user))) {
      throw new UnauthorizedException("Failed to logout");
    }

    // 쿠키 제거
    response.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
    });

    // 빈 토큰으로 쿠키 설정 (만료 시간 0)
    response.cookie("jwt", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    response.cookie("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
      path: "/api/auth/refresh",
    });

    return { message: "Account deleted successfully" };
  }
}
