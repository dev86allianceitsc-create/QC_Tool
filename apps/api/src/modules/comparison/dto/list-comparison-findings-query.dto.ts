import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { COMPARISON_FINDING_PHASE_VALUES } from "../comparison.constants";

// API-CMP-005: phase is optional but recommended; omitted means both INPUT
// and OUTPUT findings are returned in the same stable sort.
export class ListComparisonFindingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: COMPARISON_FINDING_PHASE_VALUES })
  @IsOptional()
  @IsIn(COMPARISON_FINDING_PHASE_VALUES)
  phase?: (typeof COMPARISON_FINDING_PHASE_VALUES)[number];
}
