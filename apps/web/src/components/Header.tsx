import { Button } from "./ui/Button";

// Extracted unchanged from App.tsx so it can be reused by the new
// features/projects screens without duplicating markup.
export function Header({
  user,
  onLogout,
  title,
  onShowSessionExpired,
  onNavigateAuditLogs,
  projectSwitcher,
}: {
  user: { email: string; role: string };
  onLogout: () => void;
  title: string;
  onShowSessionExpired?: () => void;
  // UI-SEC-07: presentation-only nav item — only passed by callers when
  // user.role === "ADMIN", so USER never sees this button.
  onNavigateAuditLogs?: () => void;
  // Only passed by ProjectLayout, so other Header callers (Project
  // Dashboard, Audit Log) are unaffected.
  projectSwitcher?: {
    projects: { projectId: string; projectName: string; projectStatus: "ACTIVE" | "INACTIVE" }[];
    currentProjectId: string;
    onSelect: (projectId: string) => void;
  };
}) {
  return (
    <div className="flex h-[60px] items-center justify-between border-b border-border bg-white px-5">
      <div className="flex items-center gap-2">
        {projectSwitcher ? (
          // The switcher's own selected option already names the Project —
          // showing `title` (also the Project name here) alongside it would
          // just repeat the same name twice.
          <>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Project</span>
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
      <div className="flex items-center gap-5">
        <span className="text-sm text-muted">
          {user.email} ({user.role})
        </span>
        {onNavigateAuditLogs && (
          <Button variant="secondary" size="sm" onClick={onNavigateAuditLogs}>
            Audit Logs
          </Button>
        )}
        {onShowSessionExpired && (
          <button onClick={onShowSessionExpired} className="cursor-pointer rounded-md border border-border bg-white px-2 py-1 text-[10px] text-muted">
            [Test Session Expired]
          </button>
        )}
        <Button variant="secondary" size="sm" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
