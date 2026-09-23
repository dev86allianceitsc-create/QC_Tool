import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { createRun, getRun, getRunExecution } from "./run.api";
import type { RunDetail, RunExecutionDetail, RunRequestValuesPayload } from "./run.types";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 80; // ~2 minutes
const UNFINISHED_RUN_STATUSES = new Set(["PENDING", "RUNNING"]);

export interface UseSingleRunExecutionResult {
  run: RunDetail | null;
  executionDetail: RunExecutionDetail | null;
  executing: boolean;
  timedOut: boolean;
  error: string | null;
  execute: (requestValues: RunRequestValuesPayload, apiVersion: string, databaseVersion: string) => Promise<void>;
  reset: () => void;
}

// Real Single Run execution for the Run API area's Execute step (Group Run).
// Creates one SINGLE Run, then polls getRun — dispatch runs fire-and-forget
// server-side with no push channel — until runStatus leaves PENDING/RUNNING,
// then loads the one execution's full detail (the backend's own redacted
// request/response trace; REQ-SEC-002 boundary, nothing masked client-side).
export function useSingleRunExecution(
  projectId: string | null,
  apiId: string | null,
  environmentId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
): UseSingleRunExecutionResult {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [executionDetail, setExecutionDetail] = useState<RunExecutionDetail | null>(null);
  const [executing, setExecuting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);
  const pollCountRef = useRef(0);

  const loadExecutionDetail = useCallback(
    async (runId: string, executionId: string) => {
      if (!projectId || !accessToken) return;
      try {
        const detail = await getRunExecution(projectId, runId, executionId, accessToken);
        setExecutionDetail(detail);
      } catch (err) {
        if (!handleApiError(err)) {
          setError(err instanceof ApiError ? err.message : "Unable to load Run Execution detail.");
        }
      }
    },
    [projectId, accessToken, handleApiError],
  );

  useEffect(() => {
    if (!polling || !run || !projectId || !accessToken) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        pollCountRef.current += 1;
        try {
          const latest = await getRun(projectId, run.runId, accessToken);
          if (cancelled) return;
          setRun(latest);
          if (!UNFINISHED_RUN_STATUSES.has(latest.runStatus)) {
            setPolling(false);
            setExecuting(false);
            const execId = latest.executions[0]?.executionId;
            if (execId) await loadExecutionDetail(latest.runId, execId);
          } else if (pollCountRef.current >= MAX_POLLS) {
            setPolling(false);
            setExecuting(false);
            setTimedOut(true);
          }
        } catch (err) {
          if (cancelled) return;
          setPolling(false);
          setExecuting(false);
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
  }, [polling, run, projectId, accessToken, handleApiError, loadExecutionDetail]);

  const execute = useCallback(
    async (requestValues: RunRequestValuesPayload, apiVersion: string, databaseVersion: string) => {
      if (!projectId || !apiId || !environmentId || !accessToken) return;
      setExecuting(true);
      setError(null);
      setRun(null);
      setExecutionDetail(null);
      setTimedOut(false);
      pollCountRef.current = 0;
      try {
        const created = await createRun(
          projectId,
          {
            runType: "SINGLE",
            environmentId,
            executions: [
              {
                apiId,
                requestValues,
                apiVersion: apiVersion.trim() || undefined,
                databaseVersion: databaseVersion.trim() || undefined,
              },
            ],
          },
          accessToken,
        );
        setRun(created);
        if (UNFINISHED_RUN_STATUSES.has(created.runStatus)) {
          setPolling(true);
        } else {
          setExecuting(false);
          const execId = created.executions[0]?.executionId;
          if (execId) await loadExecutionDetail(created.runId, execId);
        }
      } catch (err) {
        setExecuting(false);
        if (!handleApiError(err)) {
          setError(err instanceof ApiError ? err.message : "Unable to execute Run.");
        }
      }
    },
    [projectId, apiId, environmentId, accessToken, handleApiError, loadExecutionDetail],
  );

  const reset = useCallback(() => {
    setRun(null);
    setExecutionDetail(null);
    setExecuting(false);
    setPolling(false);
    setTimedOut(false);
    setError(null);
    pollCountRef.current = 0;
  }, []);

  return { run, executionDetail, executing, timedOut, error, execute, reset };
}
