import { useCallback, useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import {
  bulkCreateIgnoreRules as bulkCreateIgnoreRulesRequest,
  createIgnoreRule as createIgnoreRuleRequest,
  listIgnoreRules,
  removeIgnoreRule as removeIgnoreRuleRequest,
  updateIgnoreRule as updateIgnoreRuleRequest,
} from "./ignoreRules.api"

import type {
  BulkCreateIgnoreRulesRequest,
  BulkCreateIgnoreRulesResult,
  CreateIgnoreRuleRequest,
  IgnoreRuleResult,
} from "./ignoreRules.types"

export function useIgnoreRules(
  projectId: string | null,

  accessToken: string | null,

  onSessionExpired: () => void,

  onAccessDenied: () => void,
) {
  const [rules, setRules] = useState<IgnoreRuleResult[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId) return

    setLoading(true)

    setError(null)

    try {
      const result = await listIgnoreRules(projectId, {}, accessToken)

      setRules(result)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError ? err.message : "Unable to load Ignore Rules.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, handleApiError])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createRule = useCallback(
    async (input: CreateIgnoreRuleRequest) => {
      if (!accessToken || !projectId) return

      await createIgnoreRuleRequest(projectId, input, accessToken)

      await refetch()
    },

    [accessToken, projectId, refetch],
  )

  const bulkCreateRules = useCallback(
    async (
      input: BulkCreateIgnoreRulesRequest,
    ): Promise<BulkCreateIgnoreRulesResult> => {
      if (!accessToken || !projectId) throw new Error("Not ready")

      const result = await bulkCreateIgnoreRulesRequest(
        projectId,
        input,
        accessToken,
      )

      await refetch()

      return result
    },

    [accessToken, projectId, refetch],
  )

  const updateRule = useCallback(
    async (ignoreRuleId: string, enabled: boolean) => {
      if (!accessToken || !projectId) return

      await updateIgnoreRuleRequest(
        projectId,
        ignoreRuleId,
        { enabled },
        accessToken,
      )

      await refetch()
    },

    [accessToken, projectId, refetch],
  )

  const removeRule = useCallback(
    async (ignoreRuleId: string) => {
      if (!accessToken || !projectId) return

      await removeIgnoreRuleRequest(projectId, ignoreRuleId, accessToken)

      await refetch()
    },

    [accessToken, projectId, refetch],
  )

  return {
    rules,
    loading,
    error,
    refetch,
    createRule,
    bulkCreateRules,
    updateRule,
    removeRule,
  }
}
