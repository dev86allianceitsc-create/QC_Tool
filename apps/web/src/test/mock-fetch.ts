// Test-only helper for mocking the HTTP boundary (global fetch) — the only
// place production auth code talks to the backend/Google.
export function mockJsonResponse(status: number, body?: unknown): Response {
  const hasBody = body !== undefined;
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: "",
    headers: {
      get: (name: string) => (hasBody && name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: async () => body,
  } as unknown as Response;
}
