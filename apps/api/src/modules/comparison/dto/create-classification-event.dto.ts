import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";

import { COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH, COMPARISON_CLASSIFICATION_VALUES } from "../comparison.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

// API-CMP-009 (AnD API v0.2 §3, CMP-002 Should). expectedRevision is required
// but nullable: omitting the key (undefined) fails @IsInt() below and is
// correctly rejected as a missing required field, while an explicit `null`
// is the documented "I believe there is no event yet" value and skips
// validation via @ValidateIf — same required-but-nullable technique as
// PutRequestInputDto's requestBody field.
export class CreateClassificationEventDto {
  @ApiProperty({ enum: COMPARISON_CLASSIFICATION_VALUES })
  @IsIn(COMPARISON_CLASSIFICATION_VALUES)
  classification!: "EXPECTED" | "UNEXPECTED";

  @ApiPropertyOptional({ nullable: true, maxLength: COMPARISON_CLASSIFICATION_NOTE_MAX_LENGTH })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsOptional()
  @Transform(trim)
  @IsString()
  note?: string | null;

  @ApiProperty({ nullable: true, description: "null when no classification event exists yet for this Comparison; otherwise the revision currently seen by the caller" })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  expectedRevision!: number | null;
}
