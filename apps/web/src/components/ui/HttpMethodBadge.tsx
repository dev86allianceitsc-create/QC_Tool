import { Badge, type BadgeTone } from "./Badge";

const METHOD_TONE: Record<string, BadgeTone> = {
  GET: "info",
  POST: "success",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
};

// Distinct color per HTTP method so a Method column/label is scannable at a
// glance, reusing the app's existing semantic tones (no new colors added):
// GET=graphite (safe/read), POST=green (create), PUT/PATCH=amber (update),
// DELETE=red (destructive, matches the Delete button color elsewhere).
export function HttpMethodBadge({ method, className = "" }: { method: string; className?: string }) {
  return <Badge tone={METHOD_TONE[method] ?? "neutral"} label={method} className={`font-mono ${className}`} />;
}
