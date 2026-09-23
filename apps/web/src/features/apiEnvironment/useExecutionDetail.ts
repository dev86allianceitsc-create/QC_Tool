import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getRun, getRunExecution } from "./run.api";
import type { RunDetail, RunExecutionDetail, RunExecutionListItem } from "./run.types";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 80; // ~2 minutes
const UNFINISHED_STATUSES = new Set(["PENDING", "RUNNING"]);

export interface UseExecutionDetailResult {
  run: RunDetail | null;
  execution: RunExecutionListItem | null;
  executionDetail: RunExecutionDetail | null;
  loading: boolean;
  timedOut: boolean;
  error: string | null;
  refetch: () => void;
}

// UI-RUN-05 standalone Execution Detail — used both by Run Result's
// per-execution link and (later) Project Test Runs. Polls while THIS
// execution's executionStatus is PENDING/RUNNING, not run.runStatus, which
// can stay RUNNING for a Batch parent after this one child already finished
// (see ExecutionResultView.tsx). Cadence/backstop mirrors
// useSingleRunExecution exactly.
export function useExecutionDetail(
  projectId: string | null,
  runId: string | null,
  executionId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
): UseExecutionDetailResult {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [executionDetail, setExecutionDetail] = useState<RunExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!projectId || !runId || !executionId || !accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    setPolling(false);
    pollCountRef.current = 0;

    (async () => {
      try {
        const [runResult, detail] = await Promise.all([
          getRun(projectId, runId, accessToken),
          getRunExecution(projectId, runId, executionId, accessToken),
        ]);
        if (cancelled) return;
        setRun(runResult);
        setExecutionDetail(detail);
        setLoading(false);
        const execution = runResult.executions.find((e) => e.executionId === executionId) ?? null;
        if (execution && UNFINISHED_STATUSES.has(execution.executionStatus)) {
          setPolling(true);
        }
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        if (!handleApiError(err)) {
          setError(err instanceof ApiError ? err.message : "Unable to load Run Execution detail.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, runId, executionId, accessToken, handleApiError, refetchToken]);

  useEffect(() => {
    if (!polling || !run || !projectId || !runId || !executionId || !accessToken) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        pollCountRef.current += 1;
        try {
          const [runResult, detail] = await Promise.all([
            getRun(projectId, runId, accessToken),
            getRunExecution(projectId, runId, executionId, accessToken),
          ]);
          if (cancelled) return;
          setRun(runResult);
          setExecutionDetail(detail);
          const execution = runResult.executions.find((e) => e.executionId === executionId) ?? null;
          if (!execution || !UNFINISHED_STATUSES.has(execution.executionStatus)) {
            setPolling(false);
          } else if (pollCountRef.current >= MAX_POLLS) {
            setPolling(false);
            setTimedOut(true);
          }
        } catch (err) {
          if (cancelled) return;
          setPolling(false);
          if (!handleApiError(err)) {
            setError(err instanceof ApiError ? err.message : "Unable to refresh Run Execution status.");
          }
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polling, run, projectId, runId, executionId, accessToken, handleApiError]);

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  const execution = run?.executions.find((e) => e.executionId === executionId) ?? null;

  return { run, execution, executionDetail, loading, timedOut, error, refetch };
}
