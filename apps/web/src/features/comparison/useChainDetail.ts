import { useMemo } from "react"
import { useBackoffPoll } from "../shared/useBackoffPoll"
import { getComparisonChain } from "./comparison.api"
import type { ComparisonChainDetailDto } from "./comparison.types"

const TERMINAL_STATUSES = new Set(["BLOCKED", "FAILED", "COMPLETED"])

function isTerminal(chain: ComparisonChainDetailDto): boolean {
  return chain.pairs.every((pair) =>
    TERMINAL_STATUSES.has(pair.comparison.processingStatus),
  )
}

// UI-CMP-04 Chain Detail — GET /comparison-chains/:comparisonChainId
// (API-CMP-008), polling (backoff) while any visible pair is non-terminal. A
// BLOCKED/FAILED pair never stops polling on its own — only once every
// visible pair has reached a terminal status. comparison-chain-access.guard.ts
// collapses every denial into 404, same rationale as useComparisonDetail.
export function useChainDetail(
  comparisonChainId: string | null,
  page: number,
  pageSize: number,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const fetchFn = useMemo(() => {
    if (!comparisonChainId || !accessToken) return null
    return () =>
      getComparisonChain(comparisonChainId, { page, pageSize }, accessToken)
  }, [comparisonChainId, page, pageSize, accessToken])

  const { data, loading, notFound, timedOut, error, refetch } = useBackoffPoll(
    fetchFn,
    isTerminal,
    onSessionExpired,
    onAccessDenied,
  )

  return { chain: data, loading, notFound, timedOut, error, refetch }
}
