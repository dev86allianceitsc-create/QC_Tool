import { useState } from "react"
import { CheckIcon, CopyIcon } from "../../features/snapshot/snapshotIcons"

// Shared copy-to-clipboard affordance for long identifiers (Snapshot ids,
// Comparison ids) that must stay pastable in full even when the row/column
// truncates the display text. Mirrors SnapshotDetailScreen's private
// CopyableText — pulled into the UI kit because Comparison History, Detail,
// and Chain Detail all need the same behavior (History/Detail/Chain pair ids).
export function CopyableText({
  value,
  display,
  className = "",
}: {
  value: string
  display?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied/unavailable — copy is a convenience,
      // not a requirement, so failing silently is acceptable here.
    }
  }

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 ${className}`}
    >
      <span className="min-w-0 truncate" title={value}>
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        title="Copy to clipboard"
        className="flex-shrink-0 cursor-pointer rounded border-none bg-transparent p-0.5 text-muted hover:text-gray-900"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-success" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  )
}
