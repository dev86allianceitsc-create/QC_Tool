import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// Format is validated in the service after normalization (not here via
// @IsEmail()), matching UpdateInvitedUserEmailDto's convention, so a bad
// format surfaces as VALIDATION_ERROR — consistent with the AnD's 400
// VALIDATION_ERROR for this endpoint rather than a distinct format code.
export class AddMemberDto {
  @ApiProperty({ description: "Email of the user to add (trimmed + lowercased before validation)", maxLength: 320 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;
}
