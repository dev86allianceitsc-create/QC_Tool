import { useCallback, useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import {
  createTestAccount as createTestAccountRequest,
  listTestAccounts,
  removeTestAccount as removeTestAccountRequest,
  updateTestAccount as updateTestAccountRequest,
} from "./apiEnvironment.api"

import type {
  CreateTestAccountPayload,
  TestAccount,
  UpdateTestAccountPayload,
} from "./authentication.types"

// REVISION 3C-R02: Login Form Test Accounts, scoped per Environment (shared
// by every API in it, chosen per-Run). Shaped after useEnvironmentList.ts.

export function useTestAccounts(
  projectId: string | null,

  environmentId: string | null,

  accessToken: string | null,

  onSessionExpired: () => void,

  onAccessDenied: () => void,
) {
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !environmentId) return

    setLoading(true)

    setError(null)

    try {
      const result = await listTestAccounts(
        projectId,
        environmentId,
        accessToken,
      )

      setTestAccounts(result)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError ? err.message : "Unable to load Test Accounts.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, environmentId, handleApiError])

  useEffect(() => {
    setTestAccounts([])

    void refetch()
  }, [refetch])

  const createTestAccount = useCallback(
    async (input: CreateTestAccountPayload) => {
      if (!accessToken || !projectId || !environmentId) return

      await createTestAccountRequest(projectId, environmentId, input, accessToken)

      await refetch()
    },

    [accessToken, projectId, environmentId, refetch],
  )

  const updateTestAccount = useCallback(
    async (testAccountId: string, input: UpdateTestAccountPayload) => {
      if (!accessToken || !projectId || !environmentId) return

      await updateTestAccountRequest(
        projectId,
        environmentId,
        testAccountId,
        input,
        accessToken,
      )

      await refetch()
    },

    [accessToken, projectId, environmentId, refetch],
  )

  const removeTestAccount = useCallback(
    async (testAccountId: string) => {
      if (!accessToken || !projectId || !environmentId) return

      await removeTestAccountRequest(
        projectId,
        environmentId,
        testAccountId,
        accessToken,
      )

      await refetch()
    },

    [accessToken, projectId, environmentId, refetch],
  )

  return {
    testAccounts,
    loading,
    error,
    refetch,
    createTestAccount,
    updateTestAccount,
    removeTestAccount,
  }
}
