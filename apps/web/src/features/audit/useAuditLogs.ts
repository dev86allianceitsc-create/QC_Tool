import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { exportAuditLogs, listAuditLogs } from "./audit.api";
import type { AuditLogListItem, AuditResult } from "./audit.types";

const PAGE_SIZE = 20;

export interface AuditLogFiltersState {
  search: string;
  eventType: string; // "" = ALL
  result: AuditResult | ""; // "" = ALL
  projectId: string; // "" = ALL
  from: string;
  to: string;
}

export type ExportState = "idle" | "exporting" | "success" | "error";

export function useAuditLogs(accessToken: string | null, onSessionExpired: () => void, onAccessDenied: () => void) {
  const [filters, setFilters] = useState<AuditLogFiltersState>({ search: "", eventType: "", result: "", projectId: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditLogListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const queryFilters = useMemo(
    () => ({
      search: filters.search || undefined,
      eventType: filters.eventType || undefined,
      result: filters.result || undefined,
      projectId: filters.projectId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters],
  );

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditLogs({ ...queryFilters, page, pageSize: PAGE_SIZE, sortBy: "occurredAt", sortOrder: "desc" }, accessToken);
      setItems(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load audit logs.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, queryFilters, page, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function updateFilters(patch: Partial<AuditLogFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ search: "", eventType: "", result: "", projectId: "", from: "", to: "" });
    setPage(1);
  }

  async function exportCsv() {
    if (!accessToken) return;
    setExportState("exporting");
    try {
      const csv = await exportAuditLogs(queryFilters, accessToken);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportState("success");
    } catch (err) {
      if (!handleApiError(err)) {
        setExportState("error");
      }
    }
  }

  return {
    filters,
    updateFilters,
    clearFilters,
    page,
    setPage,
    items,
    totalItems,
    totalPages,
    loading,
    error,
    refetch,
    exportState,
    exportCsv,
  };
}
