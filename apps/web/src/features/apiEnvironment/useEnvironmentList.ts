import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { createEnvironment as createEnvironmentRequest, listEnvironments, updateEnvironment as updateEnvironmentRequest } from "./apiEnvironment.api";
import type { EnvironmentClassification, EnvironmentListItem, EnvironmentStatus } from "./apiEnvironment.types";

const PAGE_SIZE = 100;

export function useEnvironmentList(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [environments, setEnvironments] = useState<EnvironmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listEnvironments(projectId, { pageSize: PAGE_SIZE }, accessToken);
      setEnvironments(result.items);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Environments.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createEnvironment = useCallback(
    async (input: { environmentName: string; classification: EnvironmentClassification }) => {
      if (!accessToken || !projectId) return;
      await createEnvironmentRequest(projectId, input, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  const updateEnvironment = useCallback(
    async (
      environmentId: string,
      input: {
        environmentName?: string;
        classification?: EnvironmentClassification;
        allowRun?: boolean;
        environmentStatus?: EnvironmentStatus;
      },
    ) => {
      if (!accessToken || !projectId) return;
      await updateEnvironmentRequest(projectId, environmentId, input, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  return { environments, loading, error, refetch, createEnvironment, updateEnvironment };
}
