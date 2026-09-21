export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-muted",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-error-light text-error",
  info: "bg-primary-light text-gray-900",
};

export function Badge({ tone = "neutral", label, className = "" }: { tone?: BadgeTone; label: string; className?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]} ${className}`}>{label}</span>;
}
