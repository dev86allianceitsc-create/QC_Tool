import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsUUID } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { RUN_TYPE_VALUES, type RunType } from "./create-run.dto";

const RUN_STATUS_VALUES = ["PENDING", "RUNNING", "COMPLETED", "INTERRUPTED"] as const;
const SORT_BY_VALUES = ["createdAt", "updatedAt", "startedAt", "endedAt"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

export class ListRunsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid", description: "Filter to Runs that include this API" })
  @IsOptional()
  @IsUUID()
  apiId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @ApiPropertyOptional({ enum: RUN_TYPE_VALUES })
  @IsOptional()
  @IsIn(RUN_TYPE_VALUES)
  runType?: RunType;

  @ApiPropertyOptional({ enum: RUN_STATUS_VALUES })
  @IsOptional()
  @IsIn(RUN_STATUS_VALUES)
  runStatus?: (typeof RUN_STATUS_VALUES)[number];

  @ApiPropertyOptional({ description: "ISO 8601 lower bound on createdAt" })
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 upper bound on createdAt" })
  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @ApiPropertyOptional({ enum: SORT_BY_VALUES, default: "createdAt" })
  @IsOptional()
  @IsIn(SORT_BY_VALUES)
  sortBy?: (typeof SORT_BY_VALUES)[number] = "createdAt";

  @ApiPropertyOptional({ enum: SORT_ORDER_VALUES, default: "desc" })
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder?: (typeof SORT_ORDER_VALUES)[number] = "desc";
}
