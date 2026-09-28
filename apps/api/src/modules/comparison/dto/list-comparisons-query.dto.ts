import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import {
  COMPARISON_PROCESSING_STATUS_VALUES,
  COMPARISON_RESULT_VALUES,
  COMPARISON_SOURCE_KIND_VALUES,
} from "../comparison.constants";

// API-CMP-003 (AnD API v0.2 §4): allowlisted filters only — no free-form DB
// column name is ever accepted. `result` filters strictly SAME/DIFFERENT and
// never matches a NULL (not-yet-concluded) result as if it meant something.
export class ListComparisonsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  apiId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Matches this Comparison's Snapshot A or Snapshot B" })
  @IsOptional()
  @IsUUID()
  snapshotId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Matches the AUTO_EXECUTION source Execution, or the source Execution that produced Snapshot A or B",
  })
  @IsOptional()
  @IsUUID()
  executionId?: string;

  @ApiPropertyOptional({ enum: COMPARISON_SOURCE_KIND_VALUES })
  @IsOptional()
  @IsIn(COMPARISON_SOURCE_KIND_VALUES)
  sourceKind?: (typeof COMPARISON_SOURCE_KIND_VALUES)[number];

  @ApiPropertyOptional({ enum: COMPARISON_PROCESSING_STATUS_VALUES })
  @IsOptional()
  @IsIn(COMPARISON_PROCESSING_STATUS_VALUES)
  processingStatus?: (typeof COMPARISON_PROCESSING_STATUS_VALUES)[number];

  @ApiPropertyOptional({ enum: COMPARISON_RESULT_VALUES })
  @IsOptional()
  @IsIn(COMPARISON_RESULT_VALUES)
  result?: (typeof COMPARISON_RESULT_VALUES)[number];
}
