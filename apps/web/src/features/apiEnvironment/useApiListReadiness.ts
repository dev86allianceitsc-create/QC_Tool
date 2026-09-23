import { useEffect, useState } from "react";
import { getRequestInput, listApiEnvironmentConfigs } from "./apiEnvironment.api";
import type { ApiListItem } from "./apiEnvironment.types";

export type ApiConfigurationStatus = "ALLOW_RUN_OFF" | "MISSING_URL" | "MISSING_CREDENTIAL" | "CONFIGURED";

export interface ApiReadiness {
  configurationStatus: ApiConfigurationStatus;
  requiredInputCount: number;
}

// UI-RUN-01 (RS-RUN-001-06,08): per-API x selected-Environment readiness for
// the API List's Configuration/Required Input columns. This is an early,
// non-blocking hint only — Batch Run Preparation performs the real gating.
// Reuses the existing per-API API-APIENV-001 and Request Input endpoints
// (no new bulk endpoint) via one parallel wave per visible API; acceptable
// at this tool's scale given useApiList's flat, unpaginated fetch.
export function useApiListReadiness(
  projectId: string | null,
  apis: ApiListItem[],
  environmentId: string | null,
  environmentAllowRun: boolean | null,
  accessToken: string | null,
): { readinessByApiId: Record<string, ApiReadiness>; loading: boolean } {
  const [readinessByApiId, setReadinessByApiId] = useState<Record<string, ApiReadiness>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !accessToken || !environmentId || apis.length === 0) {
      setReadinessByApiId({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const entries = await Promise.all(
        apis.map(async (api): Promise<[string, ApiReadiness] | null> => {
          try {
            const [configResult, inputDefinition] = await Promise.all([
              listApiEnvironmentConfigs(projectId, api.apiId, accessToken),
              getRequestInput(projectId, api.apiId, accessToken),
            ]);
            const config = configResult.items.find((c) => c.environmentId === environmentId) ?? null;
            const configurationStatus: ApiConfigurationStatus =
              environmentAllowRun === false
                ? "ALLOW_RUN_OFF"
                : !config || config.urlStatus !== "CONFIGURED"
                  ? "MISSING_URL"
                  : config.credentialStatus === "NOT_CONFIGURED"
                    ? "MISSING_CREDENTIAL"
                    : "CONFIGURED";
            const requiredInputCount =
              inputDefinition.pathParameters.length +
              inputDefinition.queryParameters.filter((p) => p.required).length +
              inputDefinition.headerParameters.filter((p) => p.required).length;
            return [api.apiId, { configurationStatus, requiredInputCount }];
          } catch {
            return null;
          }
        }),
      );

      if (!cancelled) {
        const map: Record<string, ApiReadiness> = {};
        for (const entry of entries) {
          if (entry) map[entry[0]] = entry[1];
        }
        setReadinessByApiId(map);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, apis, environmentId, environmentAllowRun, accessToken]);

  return { readinessByApiId, loading };
}
