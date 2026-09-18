import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const trimUpper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

// API-API-004 updateApi. PATCH semantics: omitted = unchanged. apiName,
// httpMethod, path are Nullable=N — @IsString() already rejects an explicit
// null. description is the only Nullable=Y field: explicit null clears it.
export class UpdateApiDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  apiName?: string;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @Transform(trimUpper)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  httpMethod?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^\//, { message: "path must start with /" })
  path?: string;

  @ApiPropertyOptional({ description: "Pass null to clear", nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  description?: string | null;
}
