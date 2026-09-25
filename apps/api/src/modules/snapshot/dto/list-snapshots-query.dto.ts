import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsUUID } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const SNAPSHOT_STATUS_VALUES = ["NORMAL", "INVALIDATED"] as const;
// AnD API Group 5 §3.1 — sortBy is intentionally restricted to createdAt
// only (unlike Run's list, which also allows updatedAt/startedAt/endedAt).
const SORT_BY_VALUES = ["createdAt"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

export class ListSnapshotsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "uuid", description: "Filter to Snapshots of this API" })
  @IsOptional()
  @IsUUID()
  apiId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Filter to Snapshots of this Environment" })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @ApiPropertyOptional({ enum: SNAPSHOT_STATUS_VALUES })
  @IsOptional()
  @IsIn(SNAPSHOT_STATUS_VALUES)
  status?: (typeof SNAPSHOT_STATUS_VALUES)[number];

  @ApiPropertyOptional({ description: "ISO 8601 lower bound on createdAt, inclusive" })
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional({ description: "ISO 8601 upper bound on createdAt, inclusive" })
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
