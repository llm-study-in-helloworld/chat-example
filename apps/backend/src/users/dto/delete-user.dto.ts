import { IsNotEmpty, IsString } from "class-validator";

/**
 * DTO for deleting a user account (signout)
 */
export class DeleteUserDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
