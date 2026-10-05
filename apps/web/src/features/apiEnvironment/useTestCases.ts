import { useCallback, useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import { listTestCases, runAgain } from "./run.api"

import type { RunDetail, TestCaseListItem } from "./run.types"

// Phase 3 Test Case History & Run Again (§7/§8) — one card per distinct Test
// Case (testCaseKey) for this API (GET .../test-cases), unpaginated:
// testCaseKey already groups every execution of a logical test into one
// card, so the Run History tab's default view is "one row per test case
// ever run," not a page of raw executions (that's the drill-down, see
// useApiRunHistory's testCaseKey filter). Mirrors useComparisonAttempts'
// list+mutation shape — runTestCaseAgain refetches the list afterward so a
// card's lastRunAt/lastResult/runCount reflect the new execution once the
// caller navigates back here.
export function useTestCases(
  projectId: string | null,

  apiId: string | null,

  accessToken: string | null,

  onSessionExpired: () => void,

  onAccessDenied: () => void,
) {
  const [items, setItems] = useState<TestCaseListItem[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return

    setLoading(true)

    setError(null)

    try {
      const result = await listTestCases(projectId, apiId, accessToken)

      setItems(result)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load Test Case history.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, apiId, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Called from a Test Case card's "Run Again" action. Rethrows on failure
  // (e.g. a 422 NO_SAVED_INPUT race) after refetching, so the caller can
  // surface the server's message instead of this hook swallowing it; on
  // success the caller navigates to the returned RunDetail's new execution.
  const runTestCaseAgain = useCallback(
    async (executionId: string): Promise<RunDetail> => {
      if (!accessToken || !projectId || !apiId) throw new Error("Not ready")

      try {
        return await runAgain(projectId, apiId, executionId, accessToken)
      } finally {
        await refetch()
      }
    },

    [accessToken, projectId, apiId, refetch],
  )

  return { items, loading, error, refetch, runTestCaseAgain }
}
