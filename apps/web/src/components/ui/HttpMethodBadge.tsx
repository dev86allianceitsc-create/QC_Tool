const METHOD_CLASSES: Record<string, string> = {
  GET: "bg-blue-50 text-blue-700 border-blue-300",

  POST: "bg-green-50 text-green-700 border-green-300",

  PUT: "bg-amber-50 text-amber-800 border-amber-300",

  PATCH: "bg-purple-50 text-purple-700 border-purple-300",

  DELETE: "bg-red-50 text-red-700 border-red-300",
}

const FALLBACK_CLASSES = "bg-gray-50 text-gray-700 border-gray-300"

// Distinct, higher-contrast color per HTTP method so a Method column/label is
// scannable at a glance: GET=blue, POST=green, PUT=amber, PATCH=purple,
// DELETE=red. Self-contained (not the generic Badge) so this exact palette
// stays fixed regardless of the shared BadgeTone vocabulary used elsewhere.
export function HttpMethodBadge({
  method,
  className = "",
}: {
  method: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex min-w-[64px] items-center justify-center whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${METHOD_CLASSES[method] ?? FALLBACK_CLASSES} ${className}`}
    >
      {method}
    </span>
  )
}
