// Shared query-string builder for feature `.api.ts` files — every list
// endpoint (projects, members, audit logs) sends its filters this way so
// URL-encoding and undefined/null/empty-value dropping isn't duplicated.
export function buildQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | undefined | null>)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
