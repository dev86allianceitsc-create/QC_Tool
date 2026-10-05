import { useEffect, useRef, useState } from "react"

import { Button } from "./ui/Button"

// Extracted unchanged from App.tsx so it can be reused by the new

// features/projects screens without duplicating markup.

export function Header({
  user,

  onLogout,

  title,

  onShowSessionExpired,

  onNavigateAuditLogs,

  projectSwitcher,

  // UI-SEC-07: presentation-only nav item — only passed by callers when

  // user.role === "ADMIN", so USER never sees this button.

  // Only passed by ProjectLayout, so other Header callers (Project

  // Dashboard, Audit Log) are unaffected.
}: {
  user: { email: string; role: string }

  onLogout: () => void

  title: string

  onShowSessionExpired?: () => void

  onNavigateAuditLogs?: () => void

  projectSwitcher?: {
    projects: {
      projectId: string
      projectName: string
      projectStatus: "ACTIVE" | "INACTIVE"
    }[]

    currentProjectId: string

    onSelect: (projectId: string) => void
  }
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  const initial = user.email.trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="flex h-[60px] items-center justify-between border-b border-border bg-white px-5">
      <div className="flex items-center gap-2">
        {projectSwitcher ? (
          // The switcher's own selected option already names the Project —

          // showing `title` (also the Project name here) alongside it would

          // just repeat the same name twice.

          <>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Project
            </span>
            <select
              aria-label="Switch project"
              value={projectSwitcher.currentProjectId}
              onChange={(e) => projectSwitcher.onSelect(e.target.value)}
              className="rounded-md border border-border bg-white px-2 py-1 text-[13px] font-semibold text-gray-900 focus:border-gray-400 focus:outline-none"
            >
              {projectSwitcher.projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                  {p.projectStatus === "INACTIVE" ? " (INACTIVE)" : ""}
                </option>
              ))}
            </select>
          </>
        ) : (
          <h2 className="m-0 text-lg font-semibold text-gray-900">{title}</h2>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onNavigateAuditLogs && (
          <Button variant="secondary" size="sm" onClick={onNavigateAuditLogs}>
            Audit Logs
          </Button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
          >
            {initial}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-border bg-white py-1 shadow-sm"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="m-0 truncate text-sm font-medium text-gray-900">
                  {user.email}
                </p>
                <p className="m-0 mt-0.5 text-xs text-muted">{user.role}</p>
              </div>

              {onShowSessionExpired && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onShowSessionExpired()
                  }}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-xs text-muted hover:bg-gray-50"
                >
                  [Dev] Test Session Expired
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onLogout()
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
