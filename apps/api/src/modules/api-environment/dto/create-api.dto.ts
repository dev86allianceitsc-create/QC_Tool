import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const trimUpper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

// API-API-002 createApi. httpMethod has no fixed allowlist here — the
// supported-method domain belongs to REQ-INP-002 (Group 3B) and must not be
// silently narrowed by this DTO; only trim/uppercase canonicalization + a
// length bound are applied.
export class CreateApiDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  apiName!: string;

  @ApiProperty({ maxLength: 10, description: "Trimmed and uppercased before validation" })
  @Transform(trimUpper)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  httpMethod!: string;

  @ApiProperty({ maxLength: 2048, description: "Must start with /" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^\//, { message: "path must start with /" })
  path!: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsOptional()
  @IsString()
  description?: string | null;
}
