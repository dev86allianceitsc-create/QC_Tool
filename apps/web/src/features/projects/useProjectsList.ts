import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { createProject as createProjectRequest, listProjects } from "./projects.api";
import type { ProjectListItem } from "./projects.types";

// No list-filter UI exists on ProjectListScreen today, so this fetches one
// generous page rather than adding new filter/pagination controls (the
// backend is authoritative for what "generous" means via its own ≤100 cap).
const PAGE_SIZE = 100;

export function useProjectsList(accessToken: string | null, onSessionExpired: () => void, onAccessDenied: () => void) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listProjects({ pageSize: PAGE_SIZE }, accessToken);
      setProjects(result.items);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load projects.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (projectName: string, description: string) => {
      if (!accessToken) return;
      await createProjectRequest({ projectName, description: description || undefined }, accessToken);
      await refetch();
    },
    [accessToken, refetch],
  );

  return { projects, loading, error, refetch, create };
}
