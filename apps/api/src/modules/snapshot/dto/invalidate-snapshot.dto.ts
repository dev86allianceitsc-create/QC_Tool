import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

import { SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH } from "../snapshot.constants";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

// AnD API Group 5 Snapshot §6.1: reason must be trimmed and reject
// empty/whitespace-only input; exact length cap is left "physical TBD" by
// the requirement — SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH is an
// implementation default (see snapshot.constants.ts).
export class InvalidateSnapshotDto {
  @ApiProperty({ maxLength: SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH, description: "Reason for invalidating this Snapshot (trimmed; must not be empty)" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SNAPSHOT_INVALIDATION_REASON_MAX_LENGTH)
  reason!: string;
}
