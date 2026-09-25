import { useCallback, useState } from "react";
import { ApiError } from "../../services/api-client";
import { invalidateSnapshot } from "./snapshot.api";
import type { InvalidateSnapshotResult } from "./snapshot.types";

export type InvalidateSubmitState = "idle" | "submitting" | "error";

// API-SNP-004, ADMIN-only (enforced both by the controller's RolesGuard and
// by SnapshotDetailScreen's own isAdmin check before it even shows the
// action). Deliberately does NOT route errors through useApiErrorHandler's
// global Session Expired/Access Denied redirects: an Admin submitting this
// dialog is already authenticated and already authorized to be on this page,
// so a failure here (validation, a 409 SNAPSHOT_ALREADY_INVALIDATED race, or
// a transport error) is shown inline in the dialog per AnD UI §5 Failure,
// keeping the entered reason instead of bouncing the whole screen.
export function useInvalidateSnapshot(projectId: string, snapshotId: string, accessToken: string | null) {
  const [state, setState] = useState<InvalidateSubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (reason: string): Promise<InvalidateSnapshotResult | null> => {
      if (!accessToken) return null;
      setState("submitting");
      setError(null);
      try {
        const result = await invalidateSnapshot(projectId, snapshotId, reason, accessToken);
        setState("idle");
        return result;
      } catch (err) {
        setState("error");
        setError(err instanceof ApiError ? err.message : "Unable to invalidate this Snapshot.");
        return null;
      }
    },
    [projectId, snapshotId, accessToken],
  );

  const resetError = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  return { state, error, submit, resetError };
}
