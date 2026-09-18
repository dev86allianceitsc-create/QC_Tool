import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Header } from "../../components/Header";
import type { Role } from "./projects.types";
import { useProjectDetail } from "./useProjectDetail";

export interface ProjectLayoutContext {
  user: { email: string; role: Role };
  projectId: string;
  projectName: string;
  projectStatus: "ACTIVE" | "INACTIVE";
  accessToken: string | null;
  onLogout: () => void;
  onShowSessionExpired?: () => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}

const TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "apis", label: "APIs", path: "/apis" },
  { key: "environments", label: "Environments", path: "/environments" },
  { key: "members", label: "Members", path: "/members" },
] as const;

// Persistent Project-level chrome (Header + tab bar) shared by Overview,
// APIs, Environments, Members and API Detail so the tabs never disappear
// when switching between Project-scoped sections.
export function ProjectLayout({
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
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { project, loading, error } = useProjectDetail(projectId ?? null, accessToken, onSessionExpired, onAccessDenied);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
        <Header user={user} onLogout={onLogout} title="Loading..." onShowSessionExpired={onShowSessionExpired} />
        <div style={{ flex: 1, padding: "20px" }}>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project || !projectId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
        <Header user={user} onLogout={onLogout} title="Project" onShowSessionExpired={onShowSessionExpired} />
        <div style={{ flex: 1, padding: "20px" }}>
          <p style={{ color: "red" }}>{error ?? "Project not found."}</p>
          <button onClick={() => navigate("/")} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const basePath = `/projects/${projectId}`;
  const activeTab = TABS.slice()
    .reverse()
    .find((tab) => location.pathname === `${basePath}${tab.path}` || (tab.path !== "" && location.pathname.startsWith(`${basePath}${tab.path}`)))
    ?.key ?? "overview";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#fff" }}>
      <Header user={user} onLogout={onLogout} title={project.projectName} onShowSessionExpired={onShowSessionExpired} />
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #ccc" }}>
        <button onClick={() => navigate("/")} style={{ padding: "6px 12px", border: "1px solid #000", backgroundColor: "#fff", cursor: "pointer" }}>
          ← Back to Projects
        </button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate(`${basePath}${tab.path}`)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #000" : "none",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <Outlet
          context={{
            user,
            projectId,
            projectName: project.projectName,
            projectStatus: project.projectStatus,
            accessToken,
            onLogout,
            onShowSessionExpired,
            onSessionExpired,
            onAccessDenied,
          } satisfies ProjectLayoutContext}
        />
      </div>
    </div>
  );
}
