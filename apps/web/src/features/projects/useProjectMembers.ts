import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api-client";
import { useApiErrorHandler } from "../shared/useApiErrorHandler";
import {
  addProjectMember as addProjectMemberRequest,
  listProjectMembers,
  removeProjectMember as removeProjectMemberRequest,
} from "./projects.api";
import type { ProjectMemberView } from "./projects.types";

const PAGE_SIZE = 100;

export function useProjectMembers(
  projectId: string | null,
  accessToken: string | null,
  search: string,
  accountStatus: string | undefined,
  onSessionExpired: () => void,
  onAccessDenied: () => void,
) {
  const [members, setMembers] = useState<ProjectMemberView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied);

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listProjectMembers(projectId, { pageSize: PAGE_SIZE, search, accountStatus }, accessToken);
      setMembers(result.items);
    } catch (err) {
      if (!handleApiError(err)) {
        setError(err instanceof ApiError ? err.message : "Unable to load members.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, search, accountStatus, handleApiError]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const addMember = useCallback(
    async (email: string) => {
      if (!accessToken || !projectId) return;
      await addProjectMemberRequest(projectId, email, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!accessToken || !projectId) return;
      await removeProjectMemberRequest(projectId, userId, accessToken);
      await refetch();
    },
    [accessToken, projectId, refetch],
  );

  return { members, loading, error, refetch, addMember, removeMember };
}
