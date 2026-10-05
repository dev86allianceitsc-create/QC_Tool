import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from "class-validator";

export const IGNORE_RULE_SCOPE_VALUES = ["API", "PROJECT"] as const;
export type IgnoreRuleScope = (typeof IGNORE_RULE_SCOPE_VALUES)[number];

// Manual "add a rule" from Project Settings (spec §4). apiId is required
// when scope=API (the rule's one target API) and must be omitted/absent
// when scope=PROJECT — mirrors ck_ignore_rules_scope_api_id at the DB layer,
// checked again here so a bad request is rejected as 400 VALIDATION_ERROR
// before ever reaching the service/DB.
export class CreateIgnoreRuleDto {
  @ApiProperty({ enum: IGNORE_RULE_SCOPE_VALUES })
  @IsIn(IGNORE_RULE_SCOPE_VALUES)
  scope!: IgnoreRuleScope;

  @ApiPropertyOptional({ description: "Required when scope=API; must be omitted when scope=PROJECT" })
  @ValidateIf((dto: CreateIgnoreRuleDto) => dto.scope === "API")
  @IsUUID()
  apiId?: string;

  @ApiProperty({ maxLength: 500, description: "JSONPath-flavored path, e.g. $.StartTime, $.Data.Status, $.Data[*].updatedAt" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^\$/, { message: "path must start with $" })
  path!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  note?: string;
}
