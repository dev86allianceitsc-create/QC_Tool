import { useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Header } from "../../components/Header";
import type { Role } from "./projects.types";
import { useProjectDetail } from "./useProjectDetail";
import { useProjectsList } from "./useProjectsList";
import { Button } from "../../components/ui/Button";

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

const SETTINGS_TABS = [
  { key: "environments", label: "Environments", path: "/environments" },
  { key: "members", label: "Members", path: "/members" },
] as const;

const TAB_CLASS = "border-b-2 border-transparent px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50";
const TAB_ACTIVE_CLASS = "border-b-2 border-primary px-5 py-2.5 text-sm font-semibold text-gray-900";
const DISABLED_TAB_CLASS = "cursor-not-allowed border-b-2 border-transparent px-5 py-2.5 text-sm text-muted";

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
  const { projects } = useProjectsList(accessToken, onSessionExpired, onAccessDenied);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-white">
        <Header user={user} onLogout={onLogout} title="Loading..." onShowSessionExpired={onShowSessionExpired} />
        <div className="flex-1 p-5">
          <p className="text-sm text-muted">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project || !projectId) {
    return (
      <div className="flex h-full flex-col bg-white">
        <Header user={user} onLogout={onLogout} title="Project" onShowSessionExpired={onShowSessionExpired} />
        <div className="flex-1 p-5">
          <p className="text-sm text-error">{error ?? "Project not found."}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate("/projects")}>
            ← Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const basePath = `/projects/${projectId}`;
  const isSettingsPath = SETTINGS_TABS.some((tab) => location.pathname.startsWith(`${basePath}${tab.path}`));
  const activeTab: "overview" | "apis" | "runs" | "snapshots" | "settings" = isSettingsPath
    ? "settings"
    : location.pathname.startsWith(`${basePath}/apis`)
      ? "apis"
      : location.pathname.startsWith(`${basePath}/runs`)
        ? "runs"
        : location.pathname.startsWith(`${basePath}/snapshots`)
          ? "snapshots"
          : "overview";

  function goTo(path: string) {
    setSettingsOpen(false);
    navigate(`${basePath}${path}`);
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <Header
        user={user}
        onLogout={onLogout}
        title={project.projectName}
        onShowSessionExpired={onShowSessionExpired}
        projectSwitcher={{
          projects,
          currentProjectId: projectId,
          onSelect: (id) => navigate(`/projects/${id}`),
        }}
      />
      <div className="border-b border-border px-5 py-2.5">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          ← Back to Projects
        </Button>
      </div>
      <div className="flex border-b border-border">
        <button onClick={() => goTo("")} className={activeTab === "overview" ? TAB_ACTIVE_CLASS : TAB_CLASS}>
          Overview
        </button>
        <button onClick={() => goTo("/apis")} className={activeTab === "apis" ? TAB_ACTIVE_CLASS : TAB_CLASS}>
          APIs
        </button>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={activeTab === "settings" ? TAB_ACTIVE_CLASS : TAB_CLASS}
            style={{ fontWeight: activeTab === "settings" ? "bold" : "normal" }}
          >
            Project Settings ▾
          </button>
          {settingsOpen && (
            <div className="absolute left-0 top-full z-10 min-w-[160px] rounded-md border border-border bg-white shadow-lg">
              {SETTINGS_TABS.map((tab) => {
                const subActive = location.pathname.startsWith(`${basePath}${tab.path}`);
                return (
                  <button
                    key={tab.key}
                    onClick={() => goTo(tab.path)}
                    className={`block w-full px-5 py-2.5 text-left text-sm hover:bg-gray-50 ${subActive ? "font-semibold text-gray-900" : "text-gray-700"}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={() => goTo("/runs")} className={activeTab === "runs" ? TAB_ACTIVE_CLASS : TAB_CLASS}>
          Test Runs
        </button>
        <button onClick={() => goTo("/snapshots")} className={activeTab === "snapshots" ? TAB_ACTIVE_CLASS : TAB_CLASS}>
          Snapshots
        </button>
        <button disabled title="Coming later — not part of this release." className={DISABLED_TAB_CLASS}>
          Comparisons
        </button>
      </div>
      <div className="flex-1 overflow-auto">
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
