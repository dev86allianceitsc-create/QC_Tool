import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

// Only `email` is accepted — the global ValidationPipe (whitelist +
// forbidNonWhitelisted, see main.ts) rejects any other field (systemRole,
// accountStatus, googleSubjectId, etc.) with 400 VALIDATION_ERROR before it
// ever reaches the controller/service.
//
// Format is intentionally NOT enforced here via @IsEmail(): the API contract
// (API-USR-005) requires the specific INVALID_EMAIL_FORMAT business error
// code, whereas a class-validator failure through the global pipe surfaces
// as the generic VALIDATION_ERROR code. Format is validated in
// UsersService.updateInvitedUserEmail, after normalization, so the
// INVALID_EMAIL_FORMAT code can be raised explicitly.
export class UpdateInvitedUserEmailDto {
  @ApiProperty({ description: "New email for the target INVITED user (trimmed + lowercased before validation)" })
  @IsString()
  @IsNotEmpty()
  email!: string;
}
