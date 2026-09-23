import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getRun } from "./run.api";
import type { RunDetail } from "./run.types";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 80; // ~2 minutes
const UNFINISHED_RUN_STATUSES = new Set(["PENDING", "RUNNING"]);

export interface UseRunPollingResult {
  run: RunDetail | null;
  loading: boolean;
  timedOut: boolean;
  error: string | null;
  refetch: () => void;
}

// UI-RUN-06 Run Result — fetches one Run and polls getRun while its
// runStatus is PENDING/RUNNING (dispatch is fire-and-forget server-side,
// no push channel). Cadence/backstop mirrors useSingleRunExecution.
export function useRunPolling(
  projectId: string | null,
  runId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
): UseRunPollingResult {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!projectId || !runId || !accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    setPolling(false);
    pollCountRef.current = 0;

    (async () => {
      try {
        const result = await getRun(projectId, runId, accessToken);
        if (cancelled) return;
        setRun(result);
        setLoading(false);
        if (UNFINISHED_RUN_STATUSES.has(result.runStatus)) {
          setPolling(true);
        }
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        if (!handleApiError(err)) {
          setError(err instanceof ApiError ? err.message : "Unable to load Run.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, runId, accessToken, handleApiError, refetchToken]);

  useEffect(() => {
    if (!polling || !run || !projectId || !runId || !accessToken) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        pollCountRef.current += 1;
        try {
          const latest = await getRun(projectId, runId, accessToken);
          if (cancelled) return;
          setRun(latest);
          if (!UNFINISHED_RUN_STATUSES.has(latest.runStatus)) {
            setPolling(false);
          } else if (pollCountRef.current >= MAX_POLLS) {
            setPolling(false);
            setTimedOut(true);
          }
        } catch (err) {
          if (cancelled) return;
          setPolling(false);
          if (!handleApiError(err)) {
            setError(err instanceof ApiError ? err.message : "Unable to refresh Run status.");
          }
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polling, run, projectId, runId, accessToken, handleApiError]);

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  return { run, loading, timedOut, error, refetch };
}
