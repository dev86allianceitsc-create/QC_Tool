import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { listRuns } from "./run.api";
import type { RunListItem } from "./run.types";

const PAGE_SIZE = 20;

export interface RunListFiltersState {
  apiId: string; // "" = ALL
  environmentId: string; // "" = ALL
  runType: string; // "" = ALL ("SINGLE" | "BATCH")
  runStatus: string; // "" = ALL
  createdFrom: string; // <input type="date"> value or ""
  createdTo: string;
}

const EMPTY_FILTERS: RunListFiltersState = {
  apiId: "",
  environmentId: "",
  runType: "",
  runStatus: "",
  createdFrom: "",
  createdTo: "",
};

// UI-RUN-07 Project Test Runs — list + filter + paginate GET
// /projects/:projectId/runs (API-RUN-004, already implemented in Phase 2).
// Mirrors useAuditLogs.ts's filters/pagination shape so the two "history
// table" screens in this app behave the same way.
export function useRunList(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [filters, setFilters] = useState<RunListFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RunListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const queryFilters = useMemo(
    () => ({
      apiId: filters.apiId || undefined,
      environmentId: filters.environmentId || undefined,
      runType: filters.runType || undefined,
      runStatus: filters.runStatus || undefined,
      createdFrom: filters.createdFrom || undefined,
      createdTo: filters.createdTo || undefined,
    }),
    [filters],
  );

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listRuns(
        projectId,
        { ...queryFilters, page, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" },
        accessToken,
      );
      setItems(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Runs.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, queryFilters, page, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function updateFilters(patch: Partial<RunListFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return { filters, updateFilters, clearFilters, page, setPage, items, totalItems, totalPages, loading, error, refetch };
}
