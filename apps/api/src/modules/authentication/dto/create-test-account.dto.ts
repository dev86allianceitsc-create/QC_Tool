import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

// REVISION 3C-R02 — a named Login Form credential saved on an Environment's
// Authentication Configuration. label is user-facing and unique per
// Environment (ux_test_accounts_environment_id_label); password is required
// on create (there is nothing to rotate yet).
export class CreateTestAccountDto {
  @ApiProperty({ maxLength: 100, description: "Unique, case-sensitive within the Environment" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  @ApiProperty({ maxLength: 1024 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
