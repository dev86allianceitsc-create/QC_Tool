import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getRequestInput, putRequestInput } from "./apiEnvironment.api";
import type { PutRequestInputPayload, RequestInputDefinition } from "./requestInput.types";

// 3B-12: canonical Request Input Definition, backed by the real
// GET/PUT /projects/:projectId/apis/:apiId/request-input endpoints.
// `definition` only ever reflects a successful GET or a successful PUT
// response — a failed save() leaves it (and therefore any draft baselined
// against it) untouched, per the §4 State Model.
export function useRequestInput(
  projectId: string | null,
  apiId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [definition, setDefinition] = useState<RequestInputDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRequestInput(projectId, apiId, accessToken);
      setDefinition(result);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Request Input.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, apiId, handleApiError]);

  useEffect(() => {
    setDefinition(null);
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (payload: PutRequestInputPayload): Promise<RequestInputDefinition> => {
      if (!accessToken || !projectId || !apiId) {
        throw new Error("Missing project, API, or session context.");
      }
      setSaving(true);
      try {
        const result = await putRequestInput(projectId, apiId, payload, accessToken);
        setDefinition(result);
        return result;
      } catch (err) {
        handleApiError(err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [accessToken, projectId, apiId, handleApiError],
  );

  return { definition, loading, error, saving, refetch, save };
}
