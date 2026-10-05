import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

// Enable/disable only (spec §4) — path/scope/apiId are immutable once
// created; changing what a rule targets is "delete and re-create", not an
// update, same as the repo's other scope-defining fields elsewhere.
export class UpdateIgnoreRuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
