import { useEffect, useState } from "react";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getApi, getAuthenticationConfiguration, getRequestInput, listApiEnvironmentConfigs } from "./apiEnvironment.api";
import type { ApiDetail, ApiEnvironmentConfigListItem } from "./apiEnvironment.types";
import type { AuthenticationConfiguration } from "./authentication.types";
import type { RequestInputDefinition } from "./requestInput.types";

export interface BatchApiContext {
  api: ApiDetail;
  config: ApiEnvironmentConfigListItem | null;
  definition: RequestInputDefinition;
  authConfig: AuthenticationConfiguration | null;
}

// Group Run — Batch Run Preparation (UI-RUN-04) needs the same per-API data
// useApiDetail/useAuthentication/useRequestInput already fetch for Single Run,
// but for N selected APIs at once. Those are hooks and cannot be called in a
// loop (Rules of Hooks), so this calls their underlying raw API functions
// directly in one parallel wave, keyed by apiId — mirrors the fetch strategy
// already used by useApiListReadiness for the same reason.
export function useBatchApiContext(
  projectId: string | null,
  apiIds: string[],
  environmentId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
): { contextByApiId: Record<string, BatchApiContext>; loading: boolean; error: string | null } {
  const [contextByApiId, setContextByApiId] = useState<Record<string, BatchApiContext>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);
  const apiIdsKey = apiIds.join(",");

  useEffect(() => {
    if (!projectId || !accessToken || !environmentId || apiIds.length === 0) {
      setContextByApiId({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      let sessionOrAccessIssue = false;
      const entries = await Promise.all(
        apiIds.map(async (apiId): Promise<[string, BatchApiContext] | null> => {
          try {
            const [api, configResult, definition, authConfig] = await Promise.all([
              getApi(projectId, apiId, accessToken),
              listApiEnvironmentConfigs(projectId, apiId, accessToken),
              getRequestInput(projectId, apiId, accessToken),
              getAuthenticationConfiguration(projectId, apiId, environmentId, accessToken),
            ]);
            const config = configResult.items.find((c) => c.environmentId === environmentId) ?? null;
            return [apiId, { api, config, definition, authConfig }];
          } catch (err) {
            if (handleApiError(err)) sessionOrAccessIssue = true;
            return null;
          }
        }),
      );
      if (cancelled) return;
      if (sessionOrAccessIssue) {
        setLoading(false);
        return;
      }
      const map: Record<string, BatchApiContext> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setContextByApiId(map);
      if (entries.some((e) => e === null)) {
        setError("Some API details could not be loaded. You can still continue with the ones shown below.");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, apiIdsKey, environmentId, accessToken, handleApiError]);

  return { contextByApiId, loading, error };
}
