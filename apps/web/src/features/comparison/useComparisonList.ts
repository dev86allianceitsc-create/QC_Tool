import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiError } from "../../services/api-client"
import { useApiErrorHandler } from "../shared/useApiErrorHandler"
import { listComparisons } from "./comparison.api"
import type {
  ComparisonProcessingStatus,
  ComparisonResult,
  ComparisonSourceKind,
  ComparisonSummaryDto,
} from "./comparison.types"

const PAGE_SIZE = 20

export interface ComparisonListFiltersState {
  apiId: string // "" = ALL
  snapshotId: string // matches baselineSnapshotId OR targetSnapshotId, per ListComparisonsQueryDto
  executionId: string
  sourceKind: ComparisonSourceKind | ""
  processingStatus: ComparisonProcessingStatus | ""
  result: ComparisonResult | ""
}

const EMPTY_FILTERS: ComparisonListFiltersState = {
  apiId: "",
  snapshotId: "",
  executionId: "",
  sourceKind: "",
  processingStatus: "",
  result: "",
}

// UI-CMP-01 Comparison History — list + filter + paginate GET
// /projects/:projectId/comparisons (API-CMP-003). Mirrors
// useSnapshotList.ts's filters/pagination shape; ListComparisonsQueryDto has
// no sortBy/sortOrder (server applies a fixed createdAt DESC order), and the
// paged result is hasMore-based rather than totalPages-based.
export function useComparisonList(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [filters, setFilters] =
    useState<ComparisonListFiltersState>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<ComparisonSummaryDto[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const queryFilters = useMemo(
    () => ({
      apiId: filters.apiId || undefined,
      snapshotId: filters.snapshotId || undefined,
      executionId: filters.executionId || undefined,
      sourceKind: filters.sourceKind || undefined,
      processingStatus: filters.processingStatus || undefined,
      result: filters.result || undefined,
    }),
    [filters],
  )

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const result = await listComparisons(
        projectId,
        { ...queryFilters, page, pageSize: PAGE_SIZE },
        accessToken,
      )
      setItems(result.items)
      setTotalItems(result.totalItems)
      setHasMore(result.hasMore)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError ? err.message : "Unable to load Comparisons.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, queryFilters, page, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  function updateFilters(patch: Partial<ComparisonListFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  return {
    filters,
    updateFilters,
    clearFilters,
    page,
    setPage,
    items,
    totalItems,
    hasMore,
    loading,
    error,
    refetch,
  }
}
