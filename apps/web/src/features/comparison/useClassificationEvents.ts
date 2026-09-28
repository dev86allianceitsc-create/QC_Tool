import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../../services/api-client"
import { useApiErrorHandler } from "../shared/useApiErrorHandler"
import {
  createClassificationEvent,
  listClassificationEvents,
} from "./comparison.api"
import type {
  ClassificationEventItemDto,
  ComparisonClassificationValue,
} from "./comparison.types"

const PAGE_SIZE = 20

// UI-CMP-03 tab 5 (Classification history) + CMP-002 Should create control —
// API-CMP-010 list + API-CMP-009 create bundled (mirrors useComparisonAttempts's
// list+mutation shape). create() always refetches afterward (success adds a
// row; a 409 REVISION_CONFLICT refetches the now-current revision) and
// rethrows on failure so the caller shows the server's message rather than
// silently overwriting (AC-09).
export function useClassificationEvents(
  comparisonId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [items, setItems] = useState<ClassificationEventItemDto[]>([])
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
      const result = await listClassificationEvents(
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
            : "Unable to load classification history.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, comparisonId, page, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const create = useCallback(
    async (
      classification: ComparisonClassificationValue,
      note: string | null,
      expectedRevision: number | null,
    ) => {
      if (!accessToken || !comparisonId) throw new Error("Not ready")
      try {
        return await createClassificationEvent(
          comparisonId,
          { classification, note, expectedRevision },
          accessToken,
        )
      } finally {
        await refetch()
      }
    },
    [accessToken, comparisonId, refetch],
  )

  return {
    items,
    page,
    setPage,
    totalItems,
    hasMore,
    loading,
    error,
    refetch,
    create,
  }
}
