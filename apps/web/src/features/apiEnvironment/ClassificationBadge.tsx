import type { EnvironmentClassification } from "./apiEnvironment.types";
import { Badge, type BadgeTone } from "../../components/ui/Badge";

// Classification is not a danger/error signal — PRODUCTION keeps its own
// distinct (non-error) accent so it never reads as a validation failure.
const CLASSIFICATION_STYLES: Record<EnvironmentClassification, { tone: BadgeTone; label: string }> = {
  PRODUCTION: { tone: "info", label: "Production" },
  NON_PRODUCTION: { tone: "neutral", label: "Non-Production" },
};

export function ClassificationBadge({ classification }: { classification: EnvironmentClassification }) {
  const style = CLASSIFICATION_STYLES[classification];
  return <Badge tone={style.tone} label={style.label} />;
}
