import type { EnvironmentClassification } from "./apiEnvironment.types";

// Same lookup-table pattern as ../projects/StatusBadge.tsx.
const CLASSIFICATION_STYLES: Record<EnvironmentClassification, { bg: string; color: string; label: string }> = {
  PRODUCTION: { bg: "#FEF2F4", color: "#C41230", label: "Production" },
  NON_PRODUCTION: { bg: "#F3F4F6", color: "#6B7280", label: "Non-Production" },
};

export function ClassificationBadge({ classification }: { classification: EnvironmentClassification }) {
  const style = CLASSIFICATION_STYLES[classification];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold",
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}
