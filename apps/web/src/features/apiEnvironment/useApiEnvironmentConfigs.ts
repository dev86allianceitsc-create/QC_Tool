import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { listApiEnvironmentConfigs, putApiEnvironmentConfig } from "./apiEnvironment.api";
import type { ApiEnvironmentConfigListItem } from "./apiEnvironment.types";

export function useApiEnvironmentConfigs(
  projectId: string | null,
  apiId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [configs, setConfigs] = useState<ApiEnvironmentConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listApiEnvironmentConfigs(projectId, apiId, accessToken);
      setConfigs(result.items);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Environment configurations.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, apiId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const putConfig = useCallback(
    async (environmentId: string, fullUrl: string) => {
      if (!accessToken || !projectId || !apiId) return;
      await putApiEnvironmentConfig(projectId, apiId, environmentId, fullUrl, accessToken);
      await refetch();
    },
    [accessToken, projectId, apiId, refetch],
  );

  return { configs, loading, error, refetch, putConfig };
}
