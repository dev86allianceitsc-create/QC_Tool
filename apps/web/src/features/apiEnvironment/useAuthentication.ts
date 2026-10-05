import { useCallback, useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { useApiErrorHandler } from "../shared/useApiErrorHandler"

import {
  deleteCredential,
  getAuthenticationConfiguration,
  putAuthenticationConfiguration,
  putCredential,
} from "./apiEnvironment.api"

import type {
  AuthenticationConfiguration,
  PutAuthenticationConfigurationPayload,
  PutCredentialPayload,
} from "./authentication.types"

// REVISION 3C-R02: canonical Authentication Configuration for one Environment,
// shared by every API in that Environment (Project Settings, not per-API). A
// previous Environment's draft/credentialStatus never leaks into the next one
// since `config` resets to null and re-fetches whenever projectId/environmentId
// changes. A failed mutation leaves `config` untouched, mirroring useRequestInput.ts.

export function useAuthentication(
  projectId: string | null,

  environmentId: string | null,

  accessToken: string | null,

  onSessionExpired: () => void,

  onAccessDenied: () => void,
) {
  const [config, setConfig] = useState<AuthenticationConfiguration | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const handleApiError = useApiErrorHandler(onSessionExpired, onAccessDenied)

  const refetch = useCallback(async () => {
    if (!accessToken || !projectId || !environmentId) return

    setLoading(true)

    setError(null)

    try {
      const result = await getAuthenticationConfiguration(
        projectId,
        environmentId,
        accessToken,
      )

      setConfig(result)
    } catch (err) {
      if (!handleApiError(err)) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load Authentication.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [accessToken, projectId, environmentId, handleApiError])

  useEffect(() => {
    setConfig(null)

    void refetch()
  }, [refetch])

  const saveConfiguration = useCallback(
    async (
      payload: PutAuthenticationConfigurationPayload,
    ): Promise<AuthenticationConfiguration> => {
      if (!accessToken || !projectId || !environmentId) {
        throw new Error("Missing project, Environment, or session context.")
      }

      setSaving(true)

      try {
        const result = await putAuthenticationConfiguration(
          projectId,
          environmentId,
          payload,
          accessToken,
        )

        setConfig(result)

        return result
      } catch (err) {
        handleApiError(err)

        throw err
      } finally {
        setSaving(false)
      }
    },

    [accessToken, projectId, environmentId, handleApiError],
  )

  const saveCredential = useCallback(
    async (
      payload: PutCredentialPayload,
    ): Promise<AuthenticationConfiguration> => {
      if (!accessToken || !projectId || !environmentId) {
        throw new Error("Missing project, Environment, or session context.")
      }

      setSaving(true)

      try {
        const result = await putCredential(
          projectId,
          environmentId,
          payload,
          accessToken,
        )

        setConfig(result)

        return result
      } catch (err) {
        handleApiError(err)

        throw err
      } finally {
        setSaving(false)
      }
    },

    [accessToken, projectId, environmentId, handleApiError],
  )

  const removeCredential =
    useCallback(async (): Promise<AuthenticationConfiguration> => {
      if (!accessToken || !projectId || !environmentId) {
        throw new Error("Missing project, Environment, or session context.")
      }

      setSaving(true)

      try {
        const result = await deleteCredential(
          projectId,
          environmentId,
          accessToken,
        )

        setConfig(result)

        return result
      } catch (err) {
        handleApiError(err)

        throw err
      } finally {
        setSaving(false)
      }
    }, [accessToken, projectId, environmentId, handleApiError])

  return {
    config,
    loading,
    error,
    saving,
    refetch,
    saveConfiguration,
    saveCredential,
    removeCredential,
  }
}
