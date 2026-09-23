import { Link, useLocation } from "react-router-dom";
import allianceLogo from "../assets/alliance-logo.png";

// Level-1 Global Navigation — persistent across Dashboard, Projects, Project
// Workspace, and API Workspace. Deliberately visually distinct from
// StepSidebar (no numbered circles) so the two rails never read as the same
// navigation system. "Users & Roles" is intentionally absent: that feature
// does not exist anywhere in this app, so it gets no nav item at all.
const ITEM_BASE = "block rounded-md px-3 py-2 text-sm font-medium transition-colors";
const ITEM_ACTIVE = "bg-primary-light text-gray-900";
const ITEM_INACTIVE = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

export function GlobalSidebar({
  isAdmin,
  collapsed,
  onToggle,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();

  const items = [
    { key: "dashboard", label: "Dashboard", to: "/", active: location.pathname === "/" },
    { key: "projects", label: "Projects", to: "/projects", active: location.pathname.startsWith("/projects") },
    ...(isAdmin
      ? [{ key: "audit-log", label: "Audit Logs", to: "/audit-log", active: location.pathname.startsWith("/audit-log") }]
      : []),
  ];

  if (collapsed) {
    return (
      <nav aria-label="Global" className="flex h-full w-12 shrink-0 flex-col border-r border-border bg-white">
        <div className="flex h-[60px] shrink-0 items-center justify-center border-b border-border">
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="cursor-pointer rounded-md border-none bg-transparent p-1.5 text-base leading-none text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            »
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Global" className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-5">
        <img src={allianceLogo} alt="Alliance" className="h-7 w-auto" />
        <button
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="cursor-pointer rounded-md border-none bg-transparent p-1 text-base leading-none text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          «
        </button>
      </div>
      <ul className="flex flex-col gap-1 p-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link to={item.to} aria-current={item.active ? "page" : undefined} className={`${ITEM_BASE} ${item.active ? ITEM_ACTIVE : ITEM_INACTIVE}`}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
