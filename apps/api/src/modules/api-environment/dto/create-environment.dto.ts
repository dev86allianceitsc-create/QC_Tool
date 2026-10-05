import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export const CLASSIFICATION_VALUES = ["PRODUCTION", "NON_PRODUCTION"] as const;
export type Classification = (typeof CLASSIFICATION_VALUES)[number];

// API-ENV-002 createEnvironment. No allowRun field — it is server-derived
// from classification (NON_PRODUCTION -> true, PRODUCTION -> false) and the
// client cannot override the initial safety default.
export class CreateEnvironmentDto {
  @ApiProperty({ maxLength: 100, description: "Unique case-insensitive within the Project" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  environmentName!: string;

  @ApiProperty({ enum: CLASSIFICATION_VALUES })
  @IsIn(CLASSIFICATION_VALUES)
  classification!: Classification;

  // Phase 1 domain binding (customer feedback #2). Optional — a domain-only
  // origin (no path/query/fragment, validated by validateOriginOnlyUrl) used
  // as a fallback base for this Environment's APIs that have no per-API Full
  // URL override.
  @ApiPropertyOptional({ maxLength: 2048, description: "Domain-only base URL (no path/query/fragment), used as a fallback when an API has no Full URL override" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;
}
