import { useNavigate } from "react-router-dom";
import { Header } from "../../components/Header";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { Role } from "../projects/projects.types";
import { StatusBadge } from "../projects/StatusBadge";
import { useProjectsList } from "../projects/useProjectsList";

const RECENT_PROJECTS_LIMIT = 5;

// New landing page after login (replaces the old behavior where "/" rendered
// the Project List directly). Uses only real, already-fetched data
// (useProjectsList) — no decorative API/Environment counts are shown since
// there is no existing aggregate data source for those without adding new
// calls purely for display.
export function DashboardScreen({
  user,
  accessToken,
  onLogout,
  onShowSessionExpired,
  onSessionExpired,
  onAccessDenied,
}: {
  user: { email: string; role: Role };
  accessToken: string | null;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const isAdmin = user.role === "ADMIN";
  const navigate = useNavigate();
  const { projects, loading, error } = useProjectsList(accessToken, onSessionExpired, onAccessDenied);
  const recentProjects = projects.slice(0, RECENT_PROJECTS_LIMIT);

  return (
    <div className="flex h-full flex-col bg-white">
      <Header user={user} onLogout={onLogout} title="Dashboard" onShowSessionExpired={onShowSessionExpired} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="m-0 text-xl font-semibold text-gray-900">Welcome back, {user.email}</h1>
          <p className="mt-1 text-sm text-muted">{isAdmin ? "Administrator" : "Member"} workspace overview.</p>
        </div>

        <Card className="mb-6 w-fit">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{loading ? "—" : projects.length}</p>
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-gray-900">Your Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
            View all → Projects
          </Button>
        </div>

        {loading && <p className="text-sm text-muted">Loading projects...</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <Card className="mb-6 text-center">
            <p className="text-sm text-gray-900">You do not have any projects yet.</p>
            <p className="mt-1 text-sm text-muted">
              {isAdmin ? "Create a project to get started." : "Ask an admin to add you to a project."}
            </p>
            {isAdmin && (
              <Button variant="primary" className="mt-3" onClick={() => navigate("/projects")}>
                + Create Project
              </Button>
            )}
          </Card>
        )}

        {!loading && !error && recentProjects.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentProjects.map((p) => (
              <Card key={p.projectId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-medium text-gray-900">{p.projectName}</p>
                  <div className="mt-1">
                    <StatusBadge status={p.projectStatus} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${p.projectId}`)}>
                  Open
                </Button>
              </Card>
            ))}
          </div>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Quick Access</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate("/projects")}>
              Browse Projects
            </Button>
            {isAdmin && (
              <Button variant="secondary" onClick={() => navigate("/audit-log")}>
                Audit Logs
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
