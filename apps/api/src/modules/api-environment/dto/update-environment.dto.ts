import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { CLASSIFICATION_VALUES, type Classification } from "./create-environment.dto";

const ENVIRONMENT_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
export type EnvironmentStatusValue = (typeof ENVIRONMENT_STATUS_VALUES)[number];

// API-ENV-004 updateEnvironment. Single PATCH resource covering Rename,
// Classification, Allow Run and lifecycle (Deactivate/Reactivate). All
// fields are Nullable=N — @IsOptional() allows omission (unchanged) but an
// explicit null on any of these is rejected by the underlying type checks.
export class UpdateEnvironmentDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  environmentName?: string;

  @ApiPropertyOptional({ enum: CLASSIFICATION_VALUES })
  @IsOptional()
  @IsIn(CLASSIFICATION_VALUES)
  classification?: Classification;

  @ApiPropertyOptional({ description: "Admin-only explicit Allow Run change" })
  @IsOptional()
  @IsBoolean()
  allowRun?: boolean;

  @ApiPropertyOptional({ enum: ENVIRONMENT_STATUS_VALUES })
  @IsOptional()
  @IsIn(ENVIRONMENT_STATUS_VALUES)
  environmentStatus?: EnvironmentStatusValue;
}
