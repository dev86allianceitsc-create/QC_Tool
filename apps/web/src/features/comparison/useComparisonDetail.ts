import { useMemo } from "react"
import { useBackoffPoll } from "../shared/useBackoffPoll"
import { getComparison } from "./comparison.api"
import type { ComparisonDetailDto } from "./comparison.types"

const TERMINAL_STATUSES = new Set(["BLOCKED", "FAILED", "COMPLETED"])

function isTerminal(detail: ComparisonDetailDto): boolean {
  return TERMINAL_STATUSES.has(detail.processingStatus)
}

// UI-CMP-03 Comparison Detail — GET /comparisons/:comparisonId (API-CMP-004),
// polling (backoff) while processingStatus is QUEUED/RUNNING (dispatch is
// fire-and-forget server-side, no push channel). comparison-access.guard.ts
// collapses every access denial into the same 404 as "doesn't exist", so
// useBackoffPoll's notFound state alone covers both cases (deviation #6).
export function useComparisonDetail(
  comparisonId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const fetchFn = useMemo(() => {
    if (!comparisonId || !accessToken) return null
    return () => getComparison(comparisonId, accessToken)
  }, [comparisonId, accessToken])

  const { data, loading, notFound, timedOut, error, refetch } = useBackoffPoll(
    fetchFn,
    isTerminal,
    onSessionExpired,
    onAccessDenied,
  )

  return { comparison: data, loading, notFound, timedOut, error, refetch }
}
