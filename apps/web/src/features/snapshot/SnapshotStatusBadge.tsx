import type { SnapshotStatus } from "./snapshot.types";
import { Badge, type BadgeTone } from "../../components/ui/Badge";

const STATUS_TONE: Record<SnapshotStatus, BadgeTone> = {
  NORMAL: "success",
  INVALIDATED: "neutral",
};

export function SnapshotStatusBadge({ status }: { status: SnapshotStatus }) {
  return <Badge tone={STATUS_TONE[status]} label={status === "NORMAL" ? "Normal" : "Invalidated"} />;
}
