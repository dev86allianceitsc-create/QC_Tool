import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../../services/api-client"
import { getSnapshot, listSnapshots } from "../snapshot/snapshot.api"

export type LatestAuthContextResult = { status: "loading" } | {
  status: "error"
  message: string
} | { status: "no-snapshot" } | {
  status: "resolved"
  key: string
  label?: string
}

// UI-CMP-02 "Baseline vs latest" tab — no endpoint enumerates distinct auth
// contexts (API-VERIFY-02, deviation #9 in the plan); the most recent
// Snapshot for the chosen API+Environment is the only signal available, so
// this resolves that Snapshot's own authContext and the tab shows it
// read-only rather than as a dropdown. Errors surface inline in the modal,
// same rationale as useInvalidateSnapshot/useCreateComparison.
export function useLatestAuthContext(
  projectId: string | null,
  apiId: string | null,
  environmentId: string | null,
  accessToken: string | null,
): LatestAuthContextResult {
  const [result, setResult] = useState<LatestAuthContextResult>({
    status: "loading",
  })

  const resolve = useCallback(async () => {
    if (!projectId || !apiId || !environmentId || !accessToken) {
      setResult({ status: "loading" })
      return
    }
    setResult({ status: "loading" })
    try {
      const list = await listSnapshots(
        projectId,
        {
          apiId,
          environmentId,
          pageSize: 1,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
        accessToken,
      )
      const latest = list.items[0]
      if (!latest) {
        setResult({ status: "no-snapshot" })
        return
      }
      const detail = await getSnapshot(
        projectId,
        latest.snapshotId,
        accessToken,
      )
      setResult({
        status: "resolved",
        key: detail.authContext.key,
        label: detail.authContext.label,
      })
    } catch (err) {
      setResult({
        status: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Unable to resolve auth context.",
      })
    }
  }, [projectId, apiId, environmentId, accessToken])

  useEffect(() => {
    void resolve()
  }, [resolve])

  return result
}
