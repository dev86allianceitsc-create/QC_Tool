import { Outlet } from "react-router-dom";
import { GlobalSidebar } from "./GlobalSidebar";

// Layout route wrapping Dashboard, Projects, Project Workspace, and Audit
// Log behind the fixed Global Sidebar. /access-denied stays outside this
// shell (unwrapped), matching the existing minimal-chrome error interstitial.
export function AppShell({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex h-screen bg-white">
      <GlobalSidebar isAdmin={isAdmin} />
      <div className="flex h-full flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
