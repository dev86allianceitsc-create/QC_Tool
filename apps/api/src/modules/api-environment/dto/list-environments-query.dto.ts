import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { CLASSIFICATION_VALUES, type Classification } from "./create-environment.dto";

const STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

export class ListEnvironmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "environmentName search (case-insensitive substring)" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: STATUS_VALUES })
  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];

  @ApiPropertyOptional({ enum: CLASSIFICATION_VALUES })
  @IsOptional()
  @IsIn(CLASSIFICATION_VALUES)
  classification?: Classification;
}
