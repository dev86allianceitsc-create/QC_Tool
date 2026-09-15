import type { ProjectStatus } from "./projects.types";

// Colors match the (currently otherwise-unused) index.css @theme tokens:
// --color-success (#16A34A) and --color-muted (#6B7280).
const STATUS_STYLES: Record<ProjectStatus, { bg: string; color: string }> = {
  ACTIVE: { bg: "#EAF7EE", color: "#16A34A" },
  INACTIVE: { bg: "#F3F4F6", color: "#6B7280" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const style = STATUS_STYLES[status];
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
      {status}
    </span>
  );
}
