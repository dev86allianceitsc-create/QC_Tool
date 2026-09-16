import { useCallback, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import { getAuditLog } from "./audit.api";
import type { AuditLogDetail } from "./audit.types";

export function useAuditLogDetail(accessToken: string | null, onSessionExpired: () => void, onAccessDenied: () => void) {
  const [auditId, setAuditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const open = useCallback(
    async (id: string) => {
      setAuditId(id);
      setDetail(null);
      setError(null);
      if (!accessToken) return;
      setLoading(true);
      try {
        setDetail(await getAuditLog(id, accessToken));
      } catch (err) {
        if (!handleApiError(err)) {
          setError(err instanceof ApiError ? err.message : "Unable to load audit log detail.");
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, handleApiError],
  );

  const close = useCallback(() => {
    setAuditId(null);
    setDetail(null);
    setError(null);
  }, []);

  return { auditId, detail, loading, error, open, close };
}
