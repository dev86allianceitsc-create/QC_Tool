import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { deleteProject as deleteProjectRequest, getProject, updateProject as updateProjectRequest } from "./projects.api";
import type { ProjectDetail, ProjectStatus } from "./projects.types";

export function useProjectDetail(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      setProject(await getProject(projectId, accessToken));
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load project.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const update = useCallback(
    async (fields: { projectName?: string; description?: string | null; projectStatus?: ProjectStatus }) => {
      if (!accessToken || !projectId) return;
      await updateProjectRequest(projectId, fields, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  const remove = useCallback(async () => {
    if (!accessToken || !projectId) return;
    await deleteProjectRequest(projectId, accessToken);
  }, [accessToken, projectId]);

  return { project, loading, error, refetch, update, remove };
}
