import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListApisQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "apiName/path search (case-insensitive substring)" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Exact httpMethod filter (trimmed/uppercased before matching)" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(10)
  httpMethod?: string;
}
