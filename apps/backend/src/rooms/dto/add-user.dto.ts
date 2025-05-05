import { IsNotEmpty, IsNumber } from "class-validator";

/**
 * DTO for adding a user to a room request
 */
export class AddUserDto {
  @IsNumber()
  @IsNotEmpty()
  userId!: number;
}

export class AddUserRequestDto extends AddUserDto {}
