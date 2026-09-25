import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { listSnapshots } from "./snapshot.api";
import type { SnapshotApiGroup, SnapshotListItem, SnapshotStatus } from "./snapshot.types";

const PAGE_SIZE = 20;

export interface SnapshotListFiltersState {
  apiId: string; // "" = ALL
  environmentId: string; // "" = ALL
  status: SnapshotStatus | ""; // "" = ALL
  createdFrom: string; // <input type="date"> value or ""
  createdTo: string;
}

const EMPTY_FILTERS: SnapshotListFiltersState = {
  apiId: "",
  environmentId: "",
  status: "",
  createdFrom: "",
  createdTo: "",
};

// UI-SNP-001 Snapshot History — list + filter + paginate GET
// /projects/:projectId/snapshots (API-SNP-001). Mirrors useRunList.ts's
// filters/pagination shape. createdFrom > createdTo is rejected client-side
// (AnD UI §3 Filter validation) so an invalid range is never sent — matches
// the backend's own 422 SEMANTIC_VALIDATION_ERROR check.
export function useSnapshotList(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [filters, setFilters] = useState<SnapshotListFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SnapshotListItem[]>([]);
  const [apiGroups, setApiGroups] = useState<SnapshotApiGroup[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const dateRangeError = useMemo(() => {
    if (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo) {
      return "From must not be after To.";
    }
    return null;
  }, [filters.createdFrom, filters.createdTo]);

  const queryFilters = useMemo(
    () => ({
      apiId: filters.apiId || undefined,
      environmentId: filters.environmentId || undefined,
      status: filters.status || undefined,
      createdFrom: filters.createdFrom || undefined,
      createdTo: filters.createdTo || undefined,
    }),
    [filters],
  );

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || dateRangeError) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listSnapshots(
        projectId,
        { ...queryFilters, page, pageSize: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" },
        accessToken,
      );
      setItems(result.items);
      setApiGroups(result.apiGroups);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Snapshots.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, queryFilters, page, dateRangeError, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function updateFilters(patch: Partial<SnapshotListFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return {
    filters,
    updateFilters,
    clearFilters,
    dateRangeError,
    page,
    setPage,
    items,
    apiGroups,
    totalItems,
    totalPages,
    loading,
    error,
    refetch,
  };
}
