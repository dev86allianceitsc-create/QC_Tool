import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getSnapshot } from "./snapshot.api";
import type { SnapshotDetail } from "./snapshot.types";

// UI-SNP-002 Snapshot Detail — GET /projects/:projectId/snapshots/:snapshotId
// (API-SNP-002). No polling: a Snapshot is immutable once saved, aside from
// the one-time Invalidate decision — callers refetch explicitly after that
// mutation succeeds instead of polling for it.
export function useSnapshotDetail(
  projectId: string | null,
  snapshotId: string | null,
  accessToken: string | null,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [snapshot, setSnapshot] = useState<SnapshotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !snapshotId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await getSnapshot(projectId, snapshotId, accessToken);
      setSnapshot(result);
    } catch (err) {
      if (!handleApiError(err)) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Unable to load this Snapshot.");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, snapshotId, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { snapshot, loading, error, notFound, refetch };
}
