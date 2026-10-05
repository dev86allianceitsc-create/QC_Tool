import { useCallback, useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import { listEnvironments } from "../apiEnvironment/apiEnvironment.api"

import type { EnvironmentListItem } from "../apiEnvironment/apiEnvironment.types"

import { listProjectMembers } from "./projects.api"

const PAGE_SIZE = 100

export interface ProjectOverviewExtras {
  membersTotal: number

  adminCount: number

  userCount: number

  environments: EnvironmentListItem[]

  environmentsTotal: number
}

// Overview-tab-only summaries for Members and Environments — both are
// otherwise hidden behind the "Project Settings" dropdown, not a top-level
// tab. Calls the raw list endpoints directly (not useProjectMembers /
// useEnvironmentList) because those hooks discard totalItems.
export function useProjectOverviewExtras(
  projectId: string | null,

  accessToken: string | null,

  onSessionExpired: () => void,

  onAccessDenied: () => void,
) {
  const [data, setData] = useState<ProjectOverviewExtras | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return

    setLoading(true)

    setError(null)

    try {
      const [members, environments] = await Promise.all([
        listProjectMembers(projectId, { pageSize: PAGE_SIZE }, accessToken),
        listEnvironments(projectId, { pageSize: PAGE_SIZE }, accessToken),
      ])

      setData({
        membersTotal: members.totalItems,
        adminCount: members.items.filter((m) => m.systemRole === "ADMIN")
          .length,
        userCount: members.items.filter((m) => m.systemRole === "USER")
          .length,
        environments: environments.items,
        environmentsTotal: environments.totalItems,
      })
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load project overview.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error }
}
