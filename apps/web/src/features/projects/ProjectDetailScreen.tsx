import { useEffect, useState } from "react"

import { ApiError } from "../../services/api-client"

import { InactiveBanner } from "../apiEnvironment/InactiveBanner"

import { ConfirmDialog } from "./ConfirmDialog"

import type { Role } from "./projects.types"

import { StatusBadge } from "./StatusBadge"

import { useProjectDetail } from "./useProjectDetail"

import { useProjectOverviewExtras } from "./useProjectOverviewExtras"

import { Badge } from "../../components/ui/Badge"

import { Button } from "../../components/ui/Button"

import { Card } from "../../components/ui/Card"

import { Input, Textarea } from "../../components/ui/Input"

import { Modal } from "../../components/ui/Modal"

const ENVIRONMENTS_DISPLAY_LIMIT = 5

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

// UI-PRJ-03/04/05/06: display fields for both roles; Edit/Activate-Deactivate/

// Delete are ADMIN-only actions surfaced here (not on the List screen).

// Project-level Header/Back/tabs live in ProjectLayout, which renders this as

// the Overview tab's content.

export function ProjectDetailScreen({
  user,

  projectId,

  accessToken,

  onBack,

  onSessionExpired,

  onAccessDenied,

  onNavigateToMembers,

  onNavigateToEnvironments,
}: {
  user: { email: string; role: Role }

  projectId: string

  accessToken: string | null

  onBack: () => void

  onSessionExpired: () => void

  onAccessDenied: () => void

  onNavigateToMembers: () => void

  onNavigateToEnvironments: () => void
}) {
  const isAdmin = user.role === "ADMIN"

  const { project, loading, error, update, remove } = useProjectDetail(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  )

  const { data: overview, loading: overviewLoading } =
    useProjectOverviewExtras(
      projectId,
      accessToken,
      onSessionExpired,
      onAccessDenied,
    )

  const [showEditModal, setShowEditModal] = useState(false)

  const [editName, setEditName] = useState("")

  const [editDescription, setEditDescription] = useState("")

  const [editError, setEditError] = useState<string | null>(null)

  const [showStatusConfirm, setShowStatusConfirm] = useState(false)

  const [statusError, setStatusError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (project) {
      setEditName(project.projectName)

      setEditDescription(project.description ?? "")
    }
  }, [project])

  if (loading) {
    return (
      <div className="p-5">
        <p className="text-sm text-muted">Loading project...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-5">
        <p className="text-sm text-error">{error ?? "Project not found."}</p>
      </div>
    )
  }

  function openEditModal() {
    setEditName(project!.projectName)

    setEditDescription(project!.description ?? "")

    setEditError(null)

    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      setEditError("Project Name is required")

      return
    }

    try {
      await update({
        projectName: editName.trim(),
        description: editDescription.trim() || null,
      })

      setShowEditModal(false)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : "Unable to save project.",
      )
    }
  }

  async function handleToggleStatus() {
    try {
      await update({ projectStatus: isDeactivating ? "INACTIVE" : "ACTIVE" })

      setShowStatusConfirm(false)
    } catch (err) {
      setStatusError(
        err instanceof ApiError
          ? err.message
          : "Unable to update project status.",
      )
    }
  }

  async function handleDelete() {
    try {
      await remove()

      setShowDeleteConfirm(false)

      onBack()
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Unable to delete project.",
      )
    }
  }

  const isDeactivating = project.projectStatus === "ACTIVE"

  return (
    <div>
      {project.projectStatus === "INACTIVE" && (
        <InactiveBanner message="This Project is INACTIVE. It is view-only — Edit, Activate, and Delete are unavailable until it is reactivated." />
      )}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted">
            Project Overview
          </p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <h1 className="m-0 text-xl font-semibold text-gray-900">
              {project.projectName}
            </h1>
            <StatusBadge status={project.projectStatus} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {project.description || "No description provided."}
          </p>
          <p className="mt-2 text-xs text-muted">
            Created {formatDateTime(project.createdAt)}
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={openEditModal}
              disabled={project.projectStatus === "INACTIVE"}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatusError(null)

                setShowStatusConfirm(true)
              }}
            >
              {isDeactivating ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteError(null)

                setShowDeleteConfirm(true)
              }}
              disabled={project.projectStatus === "INACTIVE"}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-sm font-semibold text-gray-900">Team</h3>
            <Button variant="ghost" size="sm" onClick={onNavigateToMembers}>
              Manage →
            </Button>
          </div>
          {overviewLoading ? (
            <p className="mt-3 text-sm text-muted">Loading...</p>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold text-gray-900">
                {overview?.membersTotal ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {overview
                  ? `${overview.adminCount} Admin · ${overview.userCount} User`
                  : "Unable to load members."}
              </p>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-sm font-semibold text-gray-900">
              Environments
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToEnvironments}
            >
              Manage →
            </Button>
          </div>
          {overviewLoading ? (
            <p className="mt-3 text-sm text-muted">Loading...</p>
          ) : overview && overview.environments.length > 0 ? (
            <>
              <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                {overview.environments
                  .slice(0, ENVIRONMENTS_DISPLAY_LIMIT)
                  .map((env) => (
                    <li
                      key={env.environmentId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-gray-900">
                        {env.environmentName}
                      </span>
                      <Badge
                        tone={env.allowRun ? "success" : "neutral"}
                        label={env.allowRun ? "Run allowed" : "Run disabled"}
                      />
                    </li>
                  ))}
              </ul>
              {overview.environmentsTotal > ENVIRONMENTS_DISPLAY_LIMIT && (
                <p className="mt-2 text-xs text-muted">
                  +{overview.environmentsTotal - ENVIRONMENTS_DISPLAY_LIMIT}{" "}
                  more
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {overview
                ? "No environments configured yet."
                : "Unable to load environments."}
            </p>
          )}
        </Card>
      </div>

      {showEditModal && (
        <Modal title="Edit Project">
          <div className="mb-3">
            <Input
              label="Project Name *"
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value)

                setEditError(null)
              }}
            />
          </div>
          <div className="mb-3">
            <Textarea
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          {editError && <p className="text-xs text-error">{editError}</p>}
          <div className="mt-4 flex gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSaveEdit}
            >
              Save
            </Button>
          </div>
        </Modal>
      )}

      {showStatusConfirm && (
        <ConfirmDialog
          title={isDeactivating ? "Deactivate Project" : "Activate Project"}
          message={
            (isDeactivating
              ? `Are you sure you want to deactivate "${project.projectName}"? The project will be marked INACTIVE.`
              : `Are you sure you want to activate "${project.projectName}"? The project will be marked ACTIVE.`) +
            (statusError ? `\n${statusError}` : "")
          }
          confirmLabel={isDeactivating ? "Deactivate" : "Activate"}
          onConfirm={handleToggleStatus}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={
            `This will delete "${project.projectName}". It will no longer appear in project lists, but its historical data will be retained.` +
            (deleteError ? `\n${deleteError}` : "")
          }
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
