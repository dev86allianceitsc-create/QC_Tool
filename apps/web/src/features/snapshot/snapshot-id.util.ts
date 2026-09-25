// Snapshot IDs are UUIDs — the real primary key, used as-is for every API
// call, selection state, and React key. This only derives a short *display*
// form (first UUID segment, prefixed) so long ids don't dominate list rows;
// it is a plain substring of the real id, not a fabricated/sequential code,
// so it never needs a stored counter or a backend change. Callers must keep
// showing the full id too (e.g. via a title tooltip) rather than replacing it.
export function formatSnapshotShortId(snapshotId: string): string {
  return `SNP-${snapshotId.slice(0, 8).toUpperCase()}`;
}
