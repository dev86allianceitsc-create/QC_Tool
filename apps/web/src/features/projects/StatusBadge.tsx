import type { ProjectStatus } from "./projects.types";
import { Badge, type BadgeTone } from "../../components/ui/Badge";

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={STATUS_TONE[status]} label={status} />;
}
