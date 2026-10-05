import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, IsUUID, Matches, MaxLength, ValidateIf } from "class-validator";

import { IGNORE_RULE_SCOPE_VALUES, IgnoreRuleScope } from "./create-ignore-rule.dto";

// "Ignore selected (N)" from View Differences (spec §5) — ONE confirmation
// dialog, ONE request, for the whole selection. All selected findings share
// the same target (the Comparison's own API, and the radio choice of
// "This API" vs "Entire Project"), so apiId/scope are singular at the
// request level while paths is the batch; the service creates one IgnoreRule
// per path, skipping any that already exist (spec: "avoid duplicate rules").
export class BulkCreateIgnoreRulesDto {
  @ApiProperty({ enum: IGNORE_RULE_SCOPE_VALUES })
  @IsIn(IGNORE_RULE_SCOPE_VALUES)
  scope!: IgnoreRuleScope;

  @ApiProperty({ description: "Required when scope=API; must be omitted when scope=PROJECT" })
  @ValidateIf((dto: BulkCreateIgnoreRulesDto) => dto.scope === "API")
  @IsUUID()
  apiId?: string;

  @ApiProperty({ type: [String], description: "Distinct locationPath values selected from View Differences, e.g. $.StartTime, $.EndTime, $.TotalMilli" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v.trim() : v)) : value))
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @Matches(/^\$/, { each: true, message: "each path must start with $" })
  paths!: string[];
}
