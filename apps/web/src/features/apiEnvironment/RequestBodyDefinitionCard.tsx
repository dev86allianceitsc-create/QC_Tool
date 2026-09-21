// UI-INP-05: Body is an optional capability of the API (BR-INP-003-16/17).
// MVP Body Type is JSON only (UI-DP-3B-02, FROZEN) — no other type is ever
// rendered as a selectable option. No payload editor here: JSON payload is
// entered manually for each Run (REQ-INP-005), not stored in the Definition.
export function RequestBodyDefinitionCard({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => void }) {
  return (
    <div>
      <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900">Request Body</h4>
      <label className="flex items-center gap-2 text-sm text-gray-900">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        Use request body
      </label>
      {enabled && (
        <div className="mt-2.5">
          <span className="mb-1.5 block text-xs font-semibold text-gray-900">Body Type</span>
          <input type="text" value="JSON" disabled readOnly className="w-40 rounded-md border border-border bg-gray-100 px-3 py-2 text-sm font-mono text-gray-900" />
          <p className="mt-1.5 text-xs text-muted">JSON payload is entered manually for each Run.</p>
        </div>
      )}
    </div>
  );
}
