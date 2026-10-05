import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";

import { IGNORE_RULE_SCOPE_VALUES, IgnoreRuleScope } from "./create-ignore-rule.dto";

// Project Settings' Ignore Rules view (spec §4) — small, project-scoped list,
// not paginated (same convention as TestAccountService.list/
// ApiEnvironmentConfigsService.list, which return a plain array rather than
// a PagedResult for resource sets that stay small per project).
export class ListIgnoreRulesQueryDto {
  @ApiPropertyOptional({ description: "Filter to rules targeting this API (API-scoped rules only)" })
  @IsOptional()
  @IsUUID()
  apiId?: string;

  @ApiPropertyOptional({ enum: IGNORE_RULE_SCOPE_VALUES })
  @IsOptional()
  @IsIn(IGNORE_RULE_SCOPE_VALUES)
  scope?: IgnoreRuleScope;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  enabled?: boolean;
}
