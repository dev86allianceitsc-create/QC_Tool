import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const RESULT_VALUES = ["SUCCESS", "FAILURE", "DENIED"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

// Shared by API-SEC-001 (list) and API-SEC-003 (export) — export omits the
// pagination/sort fields it inherits but does not use (see
// ExportAuditLogsQueryDto below), so both endpoints build their `where`
// clause from the exact same filter fields.
export class AuditLogFilterDto {
  @ApiPropertyOptional({ description: "Matches against actor/target display text" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Audit event type, e.g. PROJECT_CREATED" })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ enum: RESULT_VALUES })
  @IsOptional()
  @IsIn(RESULT_VALUES)
  result?: (typeof RESULT_VALUES)[number];

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ description: "ISO 8601 UTC — inclusive lower bound on occurredAt" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: "ISO 8601 UTC — inclusive upper bound on occurredAt" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ListAuditLogsQueryDto extends AuditLogFilterDto {
  @ApiPropertyOptional({ description: "1-based page number", default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ["occurredAt"], default: "occurredAt" })
  @IsOptional()
  @IsIn(["occurredAt"])
  sortBy?: "occurredAt" = "occurredAt";

  @ApiPropertyOptional({ enum: SORT_ORDER_VALUES, default: "desc" })
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder?: (typeof SORT_ORDER_VALUES)[number] = "desc";
}
