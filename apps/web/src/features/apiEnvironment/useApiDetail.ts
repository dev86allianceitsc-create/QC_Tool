import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { deleteApi as deleteApiRequest, getApi, updateApi as updateApiRequest } from "./apiEnvironment.api";
import type { ApiDetail } from "./apiEnvironment.types";

export function useApiDetail(
  projectId: string | null,
  apiId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [api, setApi] = useState<ApiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getApi(projectId, apiId, accessToken);
      setApi(result);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load API.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, apiId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateApi = useCallback(
    async (input: { apiName?: string; httpMethod?: string; path?: string; description?: string | null }) => {
      if (!accessToken || !projectId || !apiId) return;
      await updateApiRequest(projectId, apiId, input, accessToken);
      await refetch();
    },
    [accessToken, projectId, apiId, refetch],
  );

  const deleteApi = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return;
    await deleteApiRequest(projectId, apiId, accessToken);
  }, [accessToken, projectId, apiId]);

  return { api, loading, error, refetch, updateApi, deleteApi };
}
