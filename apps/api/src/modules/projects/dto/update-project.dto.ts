import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

const STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

// PATCH semantics (API-PRJ-004): a field omitted from the request body stays
// unchanged; `description` may be explicitly set to null to clear it. The
// service requires at least one of these three fields to be present.
export class UpdateProjectDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  projectName?: string;

  @ApiPropertyOptional({ description: "Pass null to clear", nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: STATUS_VALUES })
  @IsOptional()
  @IsIn(STATUS_VALUES)
  projectStatus?: (typeof STATUS_VALUES)[number];
}
