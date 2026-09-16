import { describe, expect, it } from "vitest";
import { buildQueryString } from "./query-string";

describe("buildQueryString", () => {
  it("returns an empty string when there are no params", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("drops undefined, null and empty-string values", () => {
    expect(buildQueryString({ a: undefined, b: null, c: "", d: "keep" })).toBe("?d=keep");
  });

  it("URL-encodes keys and values", () => {
    expect(buildQueryString({ search: "a b&c" })).toBe("?search=a+b%26c");
  });

  it("stringifies number values", () => {
    expect(buildQueryString({ page: 2, pageSize: 20 })).toBe("?page=2&pageSize=20");
  });
});
