import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { formatTimestamp } from "../apiEnvironment/ExecutionResultView";
import { useApiList } from "../apiEnvironment/useApiList";
import { useEnvironmentList } from "../apiEnvironment/useEnvironmentList";
import { formatSnapshotShortId } from "./snapshot-id.util";
import { DocumentIcon, SearchIcon } from "./snapshotIcons";
import { SnapshotSelectedPanel } from "./SnapshotSelectedPanel";
import { SnapshotStatusBadge } from "./SnapshotStatusBadge";
import type { SnapshotListItem } from "./snapshot.types";
import { useSnapshotList } from "./useSnapshotList";

const METHOD_BADGE_CLASSES: Record<string, string> = {
  GET: "bg-blue-600 text-white",
  POST: "bg-green-600 text-white",
  PUT: "bg-amber-600 text-white",
  PATCH: "bg-amber-600 text-white",
  DELETE: "bg-red-600 text-white",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded px-2 py-1 font-mono text-xs font-bold ${
        METHOD_BADGE_CLASSES[method] ?? "bg-gray-500 text-white"
      }`}
    >
      {method}
    </span>
  );
}

interface ApiGroupView {
  apiId: string;
  apiName: string;
  snapshotCount: number;
  httpMethod: string | null;
  path: string | null;
  description: string | null;
}

// One row in the left accordion — a collapsible API section header, and the
// primary visual anchor of the whole screen (API is the main subject; the
// right-hand panel only ever summarizes one of its Snapshots). apiGroups
// (from useSnapshotList) only ever carries apiId/apiName/snapshotCount, so
// SnapshotHistoryScreen joins it against useApiList's ApiListItem[] by apiId
// to get method/path; a group whose API can't be found (e.g. deleted since)
// just omits the badge/path and shows apiName alone.
function ApiGroupRow({ group, isOpen, onClick }: { group: ApiGroupView; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ${
        isOpen ? "border-gray-300 bg-gray-50 shadow-sm" : "border-border bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {group.httpMethod && <MethodBadge method={group.httpMethod} />}
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-gray-900">{group.apiName}</p>
          {group.path && <p className="m-0 truncate font-mono text-xs text-muted">{group.path}</p>}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          {group.snapshotCount} {group.snapshotCount === 1 ? "Snapshot" : "Snapshots"}
        </span>
        <span className="text-sm text-muted">{isOpen ? "▾" : "▸"}</span>
      </div>
    </button>
  );
}

// One Snapshot row inside an open group — whole row is the click target
// (selects it for the right-hand panel), no separate "View" button.
// Deliberately quieter than ApiGroupRow (no border when unselected, a soft
// tint when selected) so the API header stays the first focal point; API/DB
// version moves to the summary panel instead of repeating here.
function SnapshotRow({ item, isSelected, onClick }: { item: SnapshotListItem; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-left ${
        isSelected ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50"
      }`}
    >
      <DocumentIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-gray-900" title={item.snapshotId}>
            {formatSnapshotShortId(item.snapshotId)}
          </span>
          <SnapshotStatusBadge status={item.snapshotStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
          <span>{formatTimestamp(item.createdAt)}</span>
          <span>·</span>
          <span>{item.environmentName}</span>
        </div>
      </div>
    </button>
  );
}

// UI-SNP-001 Snapshot History — master-detail layout with the API as the
// primary subject (~2/3 width): a left accordion of APIs (one open group =
// filters.apiId, the only way "expand a group" can work against the real
// list endpoint — apiGroups is always project-wide/filter-independent, see
// useSnapshotList) expanding to that API's Snapshot rows, and a right-hand
// panel (~1/3 width) that only ever summarizes whichever row is selected —
// full request/response and saved body data live on SnapshotDetailScreen,
// not here. Filters are deliberately reduced to just a search-by-API text
// box and an Environment select — Status and Date-range stay supported
// inside useSnapshotList but are unused here.
export function SnapshotHistoryScreen({
  projectId,
  accessToken,
  onViewSnapshot,
  onSessionExpired,
  onAccessDenied,
}: {
  projectId: string;
  accessToken: string | null;
  onViewSnapshot: (snapshotId: string) => void;
  onSessionExpired: () => void;
  onAccessDenied: () => void;
}) {
  const { filters, updateFilters, page, setPage, items, apiGroups, totalItems, totalPages, loading, error, refetch } = useSnapshotList(
    projectId,
    accessToken,
    onSessionExpired,
    onAccessDenied,
  );
  const { environments } = useEnvironmentList(projectId, accessToken, onSessionExpired, onAccessDenied);
  const { apis } = useApiList(projectId, accessToken, onSessionExpired, onAccessDenied);

  const [searchText, setSearchText] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const hasOpenGroup = filters.apiId !== "";
  const hasAutoOpenedRef = useRef(false);

  function openGroup(apiId: string) {
    setSelectedSnapshotId(null);
    updateFilters({ apiId });
  }

  // A group header click toggles: clicking the already-open group closes the
  // accordion back to "nothing open" instead of expand being one-way.
  function toggleGroup(apiId: string) {
    if (filters.apiId === apiId) {
      setSelectedSnapshotId(null);
      updateFilters({ apiId: "" });
    } else {
      openGroup(apiId);
    }
  }

  // Auto-open the first API group once groups load — guarded by a ref (not
  // filters.apiId === "") so a manual close via toggleGroup sticks instead
  // of being immediately reopened by this effect.
  useEffect(() => {
    if (!hasAutoOpenedRef.current && apiGroups.length > 0) {
      hasAutoOpenedRef.current = true;
      openGroup(apiGroups[0].apiId);
    }
  }, [apiGroups]);

  // Keep the selection valid as the open group/page changes; auto-select the
  // first row so the right panel is only ever empty when the group itself is.
  useEffect(() => {
    if (loading) return;
    if (items.length === 0) {
      setSelectedSnapshotId(null);
      return;
    }
    setSelectedSnapshotId((prev) => (prev && items.some((i) => i.snapshotId === prev) ? prev : items[0].snapshotId));
  }, [items, loading]);

  const apiInfoById = useMemo(() => new Map(apis.map((a) => [a.apiId, a])), [apis]);
  const groupViews: ApiGroupView[] = useMemo(
    () =>
      apiGroups.map((g) => {
        const info = apiInfoById.get(g.apiId);
        return {
          apiId: g.apiId,
          apiName: g.apiName,
          snapshotCount: g.snapshotCount,
          httpMethod: info?.httpMethod ?? null,
          path: info?.path ?? null,
          description: info?.description ?? null,
        };
      }),
    [apiGroups, apiInfoById],
  );

  const filteredGroups = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return groupViews;
    return groupViews.filter(
      (g) =>
        g.apiName.toLowerCase().includes(q) ||
        (g.path ?? "").toLowerCase().includes(q) ||
        (g.httpMethod ?? "").toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q),
    );
  }, [groupViews, searchText]);

  const totalSnapshotCount = apiGroups.reduce((sum, g) => sum + g.snapshotCount, 0);
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, totalItems);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="m-0 text-lg font-semibold text-gray-900">Snapshots</h2>
          <p className="m-0 mt-1 text-xs text-muted">
            {apiGroups.length} {apiGroups.length === 1 ? "API" : "APIs"} · {totalSnapshotCount} {totalSnapshotCount === 1 ? "Snapshot" : "Snapshots"}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search APIs…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-md border border-border py-1.5 pl-8 pr-2.5 text-xs text-gray-900"
            />
          </div>
          <select
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-gray-900"
            value={filters.environmentId}
            onChange={(e) => updateFilters({ environmentId: e.target.value })}
          >
            <option value="">All Environments</option>
            {environments.map((env) => (
              <option key={env.environmentId} value={env.environmentId}>
                {env.environmentName}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-sm text-error">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!error && loading && apiGroups.length === 0 && <p className="m-0 text-sm text-muted">Loading…</p>}

        {!error && !loading && apiGroups.length === 0 && <p className="m-0 text-sm text-muted">No Snapshots yet.</p>}

        {!error && apiGroups.length > 0 && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-col gap-3 lg:w-2/3">
              {filteredGroups.length === 0 && <p className="m-0 text-sm text-muted">No APIs match your search.</p>}

              {filteredGroups.map((group) => {
                const isOpen = filters.apiId === group.apiId;
                return (
                  <div key={group.apiId} className="flex flex-col gap-2">
                    <ApiGroupRow group={group} isOpen={isOpen} onClick={() => toggleGroup(group.apiId)} />
                    {isOpen && (
                      <div className="flex flex-col gap-1.5 border-l-2 border-border py-1 pl-4">
                        {loading && <p className="m-0 text-xs text-muted">Loading…</p>}
                        {!loading && items.length === 0 && <p className="m-0 text-xs text-muted">No Snapshots for this API yet.</p>}
                        {!loading &&
                          items.map((item) => (
                            <SnapshotRow
                              key={item.snapshotId}
                              item={item}
                              isSelected={selectedSnapshotId === item.snapshotId}
                              onClick={() => setSelectedSnapshotId(item.snapshotId)}
                            />
                          ))}
                        {!loading && totalPages > 1 && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-muted">
                              {rangeStart}–{rangeEnd} of {totalItems}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button variant="ghost" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                                Prev
                              </Button>
                              <span className="text-[11px] text-muted">
                                {page}/{totalPages}
                              </span>
                              <Button variant="ghost" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="min-w-0 lg:w-1/3">
              <SnapshotSelectedPanel
                projectId={projectId}
                snapshotId={hasOpenGroup ? selectedSnapshotId : null}
                accessToken={accessToken}
                onViewSnapshot={onViewSnapshot}
                onSessionExpired={onSessionExpired}
                onAccessDenied={onAccessDenied}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
