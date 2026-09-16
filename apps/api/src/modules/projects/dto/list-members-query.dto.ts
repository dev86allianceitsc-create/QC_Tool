import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const ACCOUNT_STATUS_VALUES = ["INVITED", "ACTIVE", "INACTIVE", "BLOCKED"] as const;

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Email search (case-insensitive substring)" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_STATUS_VALUES })
  @IsOptional()
  @IsIn(ACCOUNT_STATUS_VALUES)
  accountStatus?: (typeof ACCOUNT_STATUS_VALUES)[number];
}
