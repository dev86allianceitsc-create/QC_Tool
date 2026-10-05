import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const SORT_BY_VALUES = ["createdAt", "updatedAt"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

export class ListApiRunExecutionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  // Phase 3 Test Case History & Run Again (§8 drill-down) — filters this
  // API's execution history down to one Test Case's chain (see
  // RunExecution.testCaseKey schema doc comment).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testCaseKey?: string;

  @ApiPropertyOptional({ enum: SORT_BY_VALUES, default: "createdAt" })
  @IsOptional()
  @IsIn(SORT_BY_VALUES)
  sortBy?: (typeof SORT_BY_VALUES)[number] = "createdAt";

  @ApiPropertyOptional({ enum: SORT_ORDER_VALUES, default: "desc" })
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder?: (typeof SORT_ORDER_VALUES)[number] = "desc";
}
