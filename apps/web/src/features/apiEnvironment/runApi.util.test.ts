import { describe, expect, it } from "vitest";
import { buildPreviewUrl } from "./runApi.util";

// REVISION 3C-R01 — Run API / Request Preview. buildPreviewUrl only ever
// substitutes into the already-configured Full URL (§11 FROZEN contract:
// absolute HTTP/HTTPS, optional {name} Path Parameter tokens, no stored
// query/fragment) — it never assumes a Base URL + Path shape.
describe("buildPreviewUrl", () => {
  it("returns null when no Full URL is configured", () => {
    expect(buildPreviewUrl(null, {}, {})).toBeNull();
  });

  it("returns the Full URL unchanged when there are no placeholders or query values", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets", {}, {})).toBe("https://api.example.com/widgets");
  });

  it("substitutes a filled Path Parameter placeholder, URL-encoded", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets/{id}", { id: "a b" }, {})).toBe("https://api.example.com/widgets/a%20b");
  });

  it("leaves an unfilled Path Parameter placeholder visible", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets/{id}", {}, {})).toBe("https://api.example.com/widgets/{id}");
  });

  it("leaves a blank-valued Path Parameter placeholder visible", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets/{id}", { id: "   " }, {})).toBe("https://api.example.com/widgets/{id}");
  });

  it("excludes empty and blank Query values", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets", {}, { status: "", name: "  " })).toBe("https://api.example.com/widgets");
  });

  it("appends non-empty Query values, URL-encoded and joined with &", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets", {}, { status: "active", "q 1": "a&b" })).toBe(
      "https://api.example.com/widgets?status=active&q%201=a%26b",
    );
  });

  it("combines Path substitution and Query values together", () => {
    expect(buildPreviewUrl("https://api.example.com/widgets/{id}", { id: "42" }, { status: "active" })).toBe(
      "https://api.example.com/widgets/42?status=active",
    );
  });
});
