import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { confirmOpenApiImport, createApi as createApiRequest, listApis, previewOpenApiImport } from "./apiEnvironment.api";
import type { ApiListItem } from "./apiEnvironment.types";

const PAGE_SIZE = 100;

export function useApiList(
  projectId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [apis, setApis] = useState<ApiListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listApis(projectId, { pageSize: PAGE_SIZE }, accessToken);
      setApis(result.items);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load APIs.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createApi = useCallback(
    async (input: { apiName: string; httpMethod: string; path: string; description: string | null }) => {
      if (!accessToken || !projectId) return;
      await createApiRequest(projectId, input, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  const importPreview = useCallback(
    async (file: File) => {
      if (!accessToken || !projectId) throw new Error("Not ready");
      return previewOpenApiImport(projectId, file, accessToken);
    },
    [accessToken, projectId],
  );

  const importConfirm = useCallback(
    async (file: File, selectedCandidates: { httpMethod: string; path: string }[]) => {
      if (!accessToken || !projectId) throw new Error("Not ready");
      const outcome = await confirmOpenApiImport(projectId, file, selectedCandidates, accessToken);
      await refetch();
      return outcome;
    },
    [accessToken, projectId, refetch],
  );

  return { apis, loading, error, refetch, createApi, importPreview, importConfirm };
}
