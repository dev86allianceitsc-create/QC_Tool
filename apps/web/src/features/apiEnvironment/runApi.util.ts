// REVISION 3C-R01 — Run API / Request Preview. Builds a preview URL from the
// already-configured Full URL (Group 3A/3C, §11 FROZEN contract: absolute
// HTTP/HTTPS, optional {name} Path Parameter tokens, no query/fragment
// stored) plus this Run's manual Path/Query values (REQ-INP-004). Preview
// only — never sent anywhere, never assumes a Base URL + Path shape the
// backend never defined.
export function buildPreviewUrl(fullUrl: string | null, pathValues: Record<string, string>, queryValues: Record<string, string>): string | null {
  if (!fullUrl) return null;

  // Only substitute a placeholder once its Run value is actually filled in —
  // an unfilled {name} stays visible rather than being replaced with a blank,
  // so the preview never looks like a runnable URL it is not.
  const withPath = fullUrl.replace(/\{([^{}]+)\}/g, (token, name: string) => {
    const value = pathValues[name.trim()];
    return value && value.trim() !== "" ? encodeURIComponent(value) : token;
  });

  const queryEntries = Object.entries(queryValues).filter(([, value]) => value.trim() !== "");
  if (queryEntries.length === 0) return withPath;

  const queryString = queryEntries.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join("&");
  return `${withPath}${withPath.includes("?") ? "&" : "?"}${queryString}`;
}
