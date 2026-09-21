// New primitive: no read-only/inactive banner exists elsewhere yet.
// Used for Project INACTIVE and Environment INACTIVE (UI-SHARED-01) — both
// mean "view-only, mutation actions disabled" per REQ-FUN-001/REQ-ENV-003.
export function InactiveBanner({ message }: { message: string }) {
  return <div className="border-b border-border bg-gray-100 px-5 py-2.5 text-[13px] text-muted">{message}</div>;
}
