import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
const SORT_BY_VALUES = ["projectName", "createdAt", "updatedAt"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

export class ListProjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Project name search (case-insensitive substring)" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: STATUS_VALUES })
  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];

  @ApiPropertyOptional({ enum: SORT_BY_VALUES, default: "createdAt" })
  @IsOptional()
  @IsIn(SORT_BY_VALUES)
  sortBy?: (typeof SORT_BY_VALUES)[number] = "createdAt";

  @ApiPropertyOptional({ enum: SORT_ORDER_VALUES, default: "desc" })
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder?: (typeof SORT_ORDER_VALUES)[number] = "desc";
}
