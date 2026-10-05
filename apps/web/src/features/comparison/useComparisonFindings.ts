import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../../services/api-client"
import { useApiErrorHandler } from "../shared/useApiErrorHandler"
import { listComparisonFindings } from "./comparison.api"
import type {
  ComparisonFindingItemDto,
  ComparisonFindingPhase,
  ComparisonProcessingStatus,
  ComparisonResult,
} from "./comparison.types"

const PAGE_SIZE = 20

// UI-CMP-03 tabs 2/3 (Output differences / Input diagnosis) — API-CMP-005,
// one hook shape for both since ComparisonFindingsTab is parametrized by
// phase. processingStatus/result come back alongside items so the tab can
// render "still processing" / terminal-without-findings states correctly
// (AC-02/AC-03/AC-07) instead of inferring them from an empty items array.
export function useComparisonFindings(
  comparisonId: string | null,
  phase: ComparisonFindingPhase,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
  parentProcessingStatus: ComparisonProcessingStatus | null,
) {
  const [items, setItems] = useState<ComparisonFindingItemDto[]>([])
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [processingStatus, setProcessingStatus] =
    useState<ComparisonProcessingStatus | null>(null)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !comparisonId) return
    setLoading(true)
    setError(null)
    try {
      const response = await listComparisonFindings(
        comparisonId,
        { phase, page, pageSize: PAGE_SIZE },
        accessToken,
      )
      setItems(response.items)
      setTotalItems(response.totalItems)
      setHasMore(response.hasMore)
      setProcessingStatus(response.processingStatus)
      setResult(response.result)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError ? err.message : "Unable to load findings.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, comparisonId, phase, page, handleApiError])

  useEffect(() => {
    void refetch()
    // parentProcessingStatus: the header (useComparisonDetail) polls this
    // Comparison independently of this tab — re-fetch findings whenever it
    // changes so a tab left open on "Still processing" updates once the
    // parent observes a terminal status, instead of only refetching on
    // mount/page/phase change.
  }, [refetch, parentProcessingStatus])

  useEffect(() => {
    setPage(1)
  }, [phase])

  return {
    items,
    page,
    setPage,
    totalItems,
    hasMore,
    processingStatus,
    result,
    loading,
    error,
    refetch,
  }
}
