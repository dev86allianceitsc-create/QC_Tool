import type { AuditResult } from "./audit.types";

// Same pill shape as ../projects/StatusBadge.tsx. Colors extend the
// index.css @theme tokens: --color-success (#16A34A), --color-error
// (#DC2626), --color-warning (#D97706).
const RESULT_STYLES: Record<AuditResult, { bg: string; color: string }> = {
  SUCCESS: { bg: "#EAF7EE", color: "#16A34A" },
  FAILURE: { bg: "#FDECEC", color: "#DC2626" },
  DENIED: { bg: "#FFF7ED", color: "#D97706" },
};

export function AuditResultBadge({ result }: { result: AuditResult }) {
  const style = RESULT_STYLES[result];
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
      {result}
    </span>
  );
}
