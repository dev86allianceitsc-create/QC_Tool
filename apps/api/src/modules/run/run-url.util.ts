// Server-side mirror of apps/web/src/features/apiEnvironment/runApi.util.ts
// buildPreviewUrl — kept in lockstep so the actual dispatched request always
// matches what the user previewed client-side.

export function buildQueryEntries(queryValues: Record<string, string>): [string, string][] {
  return Object.entries(queryValues).filter(([, value]) => value.trim() !== "");
}

export function buildActualUrl(fullUrl: string, pathValues: Record<string, string>, queryValues: Record<string, string>): string {
  const withPath = fullUrl.replace(/\{([^{}]+)\}/g, (token, name: string) => {
    const value = pathValues[name.trim()];
    return value && value.trim() !== "" ? encodeURIComponent(value) : token;
  });

  const queryEntries = buildQueryEntries(queryValues);
  if (queryEntries.length === 0) {
    return withPath;
  }

  const queryString = queryEntries.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join("&");
  return `${withPath}${withPath.includes("?") ? "&" : "?"}${queryString}`;
}
