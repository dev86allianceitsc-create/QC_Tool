import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { deleteCredential, getAuthenticationConfiguration, putAuthenticationConfiguration, putCredential } from "./apiEnvironment.api";
import type { AuthenticationConfiguration, PutAuthenticationConfigurationPayload, PutCredentialPayload } from "./authentication.types";

// Group 3C: canonical Authentication Configuration for one (apiId,
// environmentId) pair. Scoped to the selected Environment, unlike Request
// Input (API-scoped only) — `config` resets to null and re-fetches whenever
// any of projectId/apiId/environmentId changes, so a previous Environment's
// draft/credentialStatus never leaks into the next one. A failed mutation
// leaves `config` untouched, mirroring useRequestInput.ts.
export function useAuthentication(
  projectId: string | null,
  apiId: string | null,
  environmentId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [config, setConfig] = useState<AuthenticationConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !apiId || !environmentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAuthenticationConfiguration(projectId, apiId, environmentId, accessToken);
      setConfig(result);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load Authentication.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, apiId, environmentId, handleApiError]);

  useEffect(() => {
    setConfig(null);
    void refetch();
  }, [refetch]);

  const saveConfiguration = useCallback(
    async (payload: PutAuthenticationConfigurationPayload): Promise<AuthenticationConfiguration> => {
      if (!accessToken || !projectId || !apiId || !environmentId) {
        throw new Error("Missing project, API, Environment, or session context.");
      }
      setSaving(true);
      try {
        const result = await putAuthenticationConfiguration(projectId, apiId, environmentId, payload, accessToken);
        setConfig(result);
        return result;
      } catch (err) {
        handleApiError(err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [accessToken, projectId, apiId, environmentId, handleApiError],
  );

  const saveCredential = useCallback(
    async (payload: PutCredentialPayload): Promise<AuthenticationConfiguration> => {
      if (!accessToken || !projectId || !apiId || !environmentId) {
        throw new Error("Missing project, API, Environment, or session context.");
      }
      setSaving(true);
      try {
        const result = await putCredential(projectId, apiId, environmentId, payload, accessToken);
        setConfig(result);
        return result;
      } catch (err) {
        handleApiError(err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [accessToken, projectId, apiId, environmentId, handleApiError],
  );

  const removeCredential = useCallback(async (): Promise<AuthenticationConfiguration> => {
    if (!accessToken || !projectId || !apiId || !environmentId) {
      throw new Error("Missing project, API, Environment, or session context.");
    }
    setSaving(true);
    try {
      const result = await deleteCredential(projectId, apiId, environmentId, accessToken);
      setConfig(result);
      return result;
    } catch (err) {
      handleApiError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [accessToken, projectId, apiId, environmentId, handleApiError]);

  return { config, loading, error, saving, refetch, saveConfiguration, saveCredential, removeCredential };
}
