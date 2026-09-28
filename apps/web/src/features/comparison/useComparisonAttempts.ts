import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../../services/api-client"
import { useApiErrorHandler } from "../shared/useApiErrorHandler"
import { listComparisonAttempts, retryComparison } from "./comparison.api"
import type { ComparisonAttemptListItemDto } from "./comparison.types"

const PAGE_SIZE = 20

// UI-CMP-03 tab 4 (Attempt history) — API-CMP-006 list + API-CMP-007 retry
// bundled together (mirrors useApiList's list+mutation shape): a successful
// retry only shows up once this list refetches. retry() rethrows on failure
// (e.g. a 409 conflict) after refetching, so the caller can show the
// server's message without this hook swallowing it.
export function useComparisonAttempts(
  comparisonId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [items, setItems] = useState<ComparisonAttemptListItemDto[]>([])
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !comparisonId) return
    setLoading(true)
    setError(null)
    try {
      const result = await listComparisonAttempts(
        comparisonId,
        { page, pageSize: PAGE_SIZE },
        accessToken,
      )
      setItems(result.items)
      setTotalItems(result.totalItems)
      setHasMore(result.hasMore)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load attempt history.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, comparisonId, page, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const retry = useCallback(async () => {
    if (!accessToken || !comparisonId) throw new Error("Not ready")
    try {
      return await retryComparison(comparisonId, accessToken)
    } finally {
      await refetch()
    }
  }, [accessToken, comparisonId, refetch])

  return {
    items,
    page,
    setPage,
    totalItems,
    hasMore,
    loading,
    error,
    refetch,
    retry,
  }
}
