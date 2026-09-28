import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../../services/api-client"
import { listSnapshots } from "../snapshot/snapshot.api"
import type { SnapshotListItem } from "../snapshot/snapshot.types"

const RECENT_PAGE_SIZE = 20

// Backs SnapshotPickerField for Create Comparison's "Two Snapshots" tab and
// Sequential chain's start/end pickers — a scoped recent-Snapshot list (AnD
// UI §4 "UI lọc cùng scope để giảm lỗi", deviation #8 in the plan) instead of
// a bare UUID box, reusing listSnapshots rather than a new endpoint. Errors
// surface inline in the picker field, same rationale as useLatestAuthContext.
export function useSnapshotPicker(
  projectId: string | null,
  apiId: string | null,
  environmentId: string | null,
  accessToken: string | null,
) {
  const [items, setItems] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!projectId || !apiId || !environmentId || !accessToken) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listSnapshots(
        projectId,
        {
          apiId,
          environmentId,
          pageSize: RECENT_PAGE_SIZE,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        accessToken,
      )
      setItems(result.items)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to load recent Snapshots.",
      )
    } finally {
      setLoading(false)
    }
  }, [projectId, apiId, environmentId, accessToken])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { items, loading, error, refetch }
}
