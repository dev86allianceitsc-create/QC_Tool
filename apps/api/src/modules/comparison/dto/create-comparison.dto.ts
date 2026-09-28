import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString, IsUUID, ValidateIf } from "class-validator";

import { COMPARISON_SELECTION_MODE_VALUES, ComparisonSelectionMode } from "../comparison.constants";

// API-CMP-001 (AnD API v0.2 §3): selectionMode is a discriminator — the
// server accepts exactly one branch. class-validator's @ValidateIf only
// expresses "required when this branch is selected"; the complementary
// "forbidden when the other branch is selected" half of "cả hai nhánh trộn"
// (400 VALIDATION_ERROR) has no built-in decorator and is enforced in
// ComparisonQueryService.createComparison instead, right before this DTO's
// fields are read.
export class CreateComparisonDto {
  @ApiProperty({ enum: COMPARISON_SELECTION_MODE_VALUES })
  @IsIn(COMPARISON_SELECTION_MODE_VALUES)
  selectionMode!: ComparisonSelectionMode;

  @ApiPropertyOptional({ format: "uuid", description: "Snapshot A (baseline); required when selectionMode is PAIR" })
  @ValidateIf((o: CreateComparisonDto) => o.selectionMode === "PAIR")
  @IsUUID()
  baselineSnapshotId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Snapshot B (target), distinct from baselineSnapshotId; required when selectionMode is PAIR" })
  @ValidateIf((o: CreateComparisonDto) => o.selectionMode === "PAIR")
  @IsUUID()
  targetSnapshotId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "API scope for latest-Snapshot resolution; required when selectionMode is BASELINE_LATEST" })
  @ValidateIf((o: CreateComparisonDto) => o.selectionMode === "BASELINE_LATEST")
  @IsUUID()
  apiId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Environment scope for latest-Snapshot resolution; required when selectionMode is BASELINE_LATEST" })
  @ValidateIf((o: CreateComparisonDto) => o.selectionMode === "BASELINE_LATEST")
  @IsUUID()
  environmentId?: string;

  @ApiPropertyOptional({
    description:
      "Opaque reference to a stable historical auth context, resolved server-side (never a raw token); required when selectionMode is BASELINE_LATEST",
  })
  @ValidateIf((o: CreateComparisonDto) => o.selectionMode === "BASELINE_LATEST")
  @IsString()
  @IsNotEmpty()
  authContextRef?: string;
}
