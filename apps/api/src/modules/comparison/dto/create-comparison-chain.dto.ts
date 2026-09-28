import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

// API-CMP-002 (AnD API v0.2 §3): only the two chain endpoints come from the
// client — the server resolves and freezes every Snapshot in between
// (executionCompletedAt ASC, snapshotId ASC) itself. The client never
// supplies the ordered Snapshot list; that would make the client the
// authoritative source for chain membership, which AnD explicitly forbids.
export class CreateComparisonChainDto {
  @ApiProperty({ format: "uuid", description: "First Snapshot in the chain" })
  @IsUUID()
  startSnapshotId!: string;

  @ApiProperty({ format: "uuid", description: "Last Snapshot in the chain; must differ from startSnapshotId and share the same Project/API/Environment/auth context" })
  @IsUUID()
  endSnapshotId!: string;
}
