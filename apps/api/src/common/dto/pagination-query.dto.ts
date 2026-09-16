import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

// Shared page/pageSize fields per API_Design_Standard_v2.0 pagination
// convention — extended by every list-query DTO (Projects, Members, Audit)
// so the bounds (page >= 1, 1 <= pageSize <= 100) aren't redefined per DTO.
export class PaginationQueryDto {
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
}
