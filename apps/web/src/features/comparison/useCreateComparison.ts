import { useCallback, useState } from "react"
import { ApiError } from "../../services/api-client"
import { createComparison, createComparisonChain } from "./comparison.api"
import type {
  CreateChainResultDto,
  CreateComparisonResponse,
} from "./comparison.types"

export type CreateComparisonSubmitState = "idle" | "submitting" | "error"

// Backs CreateComparisonModal's three tabs — one shared submitting/error
// state (only one tab can be mid-submit at a time in a single modal
// instance), mirroring useInvalidateSnapshot's {state,error,submit,resetError}
// shape. Deliberately does not route through useApiErrorHandler, same
// rationale as useInvalidateSnapshot: the modal is layered on a screen whose
// own list hook already handles the global session/access redirect, so a
// failure here (validation, a real transport error) surfaces inline instead.
export function useCreateComparison(
  projectId: string | null,
  accessToken: string | null,
) {
  const [state, setState] = useState<CreateComparisonSubmitState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const submitPair = useCallback(
    async (
      baselineSnapshotId: string,
      targetSnapshotId: string,
    ): Promise<CreateComparisonResponse | null> => {
      if (!projectId || !accessToken) return null
      setState("submitting")
      setError(null)
      setErrorCode(null)
      try {
        const result = await createComparison(
          projectId,
          { selectionMode: "PAIR", baselineSnapshotId, targetSnapshotId },
          accessToken,
        )
        setState("idle")
        return result
      } catch (err) {
        setState("error")
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to create Comparison.",
        )
        setErrorCode(err instanceof ApiError ? err.errorCode : null)
        return null
      }
    },
    [projectId, accessToken],
  )

  const submitBaselineLatest = useCallback(
    async (
      apiId: string,
      environmentId: string,
      authContextRef?: string,
    ): Promise<CreateComparisonResponse | null> => {
      if (!projectId || !accessToken) return null
      setState("submitting")
      setError(null)
      setErrorCode(null)
      try {
        const result = await createComparison(
          projectId,
          {
            selectionMode: "BASELINE_LATEST",
            apiId,
            environmentId,
            authContextRef,
          },
          accessToken,
        )
        setState("idle")
        return result
      } catch (err) {
        setState("error")
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to create Comparison.",
        )
        setErrorCode(err instanceof ApiError ? err.errorCode : null)
        return null
      }
    },
    [projectId, accessToken],
  )

  const submitChain = useCallback(
    async (
      startSnapshotId: string,
      endSnapshotId: string,
    ): Promise<CreateChainResultDto | null> => {
      if (!projectId || !accessToken) return null
      setState("submitting")
      setError(null)
      setErrorCode(null)
      try {
        const result = await createComparisonChain(
          projectId,
          { startSnapshotId, endSnapshotId },
          accessToken,
        )
        setState("idle")
        return result
      } catch (err) {
        setState("error")
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to create Comparison chain.",
        )
        setErrorCode(err instanceof ApiError ? err.errorCode : null)
        return null
      }
    },
    [projectId, accessToken],
  )

  const resetError = useCallback(() => {
    setError(null)
    setErrorCode(null)
    setState("idle")
  }, [])

  return {
    state,
    error,
    errorCode,
    submitPair,
    submitBaselineLatest,
    submitChain,
    resetError,
  }
}
