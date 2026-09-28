import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "../../services/api-client"
import { useApiErrorHandler } from "./useApiErrorHandler"

const INITIAL_DELAY_MS = 1000
const BACKOFF_MULTIPLIER = 1.5
const MAX_DELAY_MS = 10000
const MAX_POLLS = 80

export interface UseBackoffPollResult<T> {
  data: T | null
  loading: boolean
  notFound: boolean
  timedOut: boolean
  error: string | null
  refetch: () => void
}

// Generalizes useRunPolling's fetch-then-poll-while-unfinished skeleton for
// resources whose "still working" state isn't a fixed enum value (Comparison
// Detail/Chain Detail use an isTerminal predicate instead) and whose access
// guard collapses every denial into 404 (comparison-access.guard.ts /
// comparison-chain-access.guard.ts) — a 404 on any fetch, including mid-poll,
// clears data and stops polling rather than leaving a stale detail view
// behind. Delay grows (x1.5/poll, capped) instead of staying fixed, since a
// Comparison/Chain can take longer than a Run Execution to reach a terminal
// state.
//
// fetchFn must be a stable (useCallback'd) reference — its identity is what
// restarts the poll from scratch, exactly like useRunPolling's [projectId,
// runId, accessToken] dependency list; pass null when inputs aren't ready yet
// (missing id/accessToken), mirroring that hook's own early-return guard.
export function useBackoffPoll<T>(
  fetchFn: (() => Promise<T>) | null,
  isTerminal: (data: T) => boolean,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
): UseBackoffPollResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)
  const pollCountRef = useRef(0)
  const delayRef = useRef(INITIAL_DELAY_MS)

  useEffect(() => {
    if (!fetchFn) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    setTimedOut(false)
    setPolling(false)
    pollCountRef.current = 0
    delayRef.current = INITIAL_DELAY_MS
    ;(async () => {
      try {
        const result = await fetchFn()
        if (cancelled) return
        setData(result)
        setLoading(false)
        if (!isTerminal(result)) {
          setPolling(true)
        }
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        if (!handleApiError(err)) {
          if (err instanceof ApiError && err.status === 404) {
            setData(null)
            setNotFound(true)
          } else {
            setError(
              err instanceof ApiError ? err.message : "Unable to load data.",
            )
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fetchFn, handleApiError, refetchToken])

  useEffect(() => {
    if (!polling || !data || !fetchFn) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        pollCountRef.current += 1
        try {
          const latest = await fetchFn()
          if (cancelled) return
          setData(latest)
          if (isTerminal(latest)) {
            setPolling(false)
          } else if (pollCountRef.current >= MAX_POLLS) {
            setPolling(false)
            setTimedOut(true)
          } else {
            delayRef.current = Math.min(
              delayRef.current * BACKOFF_MULTIPLIER,
              MAX_DELAY_MS,
            )
          }
        } catch (err) {
          if (cancelled) return
          setPolling(false)
          if (!handleApiError(err)) {
            if (err instanceof ApiError && err.status === 404) {
              setData(null)
              setNotFound(true)
            } else {
              setError(
                err instanceof ApiError ? err.message : "Unable to refresh.",
              )
            }
          }
        }
      })()
    }, delayRef.current)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [polling, data, fetchFn, handleApiError])

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1)
  }, [])

  return { data, loading, notFound, timedOut, error, refetch }
}
