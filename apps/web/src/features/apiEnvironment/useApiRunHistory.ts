import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { listApiRunExecutions } from "./run.api";
import type { ApiRunExecutionListItem } from "./run.types";

const PAGE_SIZE = 20;

export interface ApiRunHistoryFiltersState {
  environmentId: string; // "" = ALL
}

const EMPTY_FILTERS: ApiRunHistoryFiltersState = { environmentId: "" };

// UI-RUN-08 Run History — list + filter + paginate GET
// /projects/:projectId/apis/:apiId/run-executions (API-RUN-005, already
// implemented in Phase 2). ListApiRunExecutionsQueryDto only supports an
// Environment filter plus sort (no runType/runStatus/date-range like
// UI-RUN-07's ListRunsQueryDto), so this hook's filter state is
// intentionally narrower than useRunList's.
export function useApiRunHistory(
  projectId: string | null,
  apiId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [filters, setFilters] = useState<ApiRunHistoryFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ApiRunExecutionListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const queryFilters = useMemo(
    () => ({
      environmentId: filters.environmentId || undefined,
    }),
    [filters],
  );

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listApiRunExecutions(
        projectId,
        apiId,
        { ...queryFilters, page, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" },
        accessToken,
      );
      setItems(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Run History.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, apiId, queryFilters, page, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function updateFilters(patch: Partial<ApiRunHistoryFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return { filters, updateFilters, clearFilters, page, setPage, items, totalItems, totalPages, loading, error, refetch };
}
