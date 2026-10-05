import { BusinessException } from "../../common/exceptions/business.exception";
import { composeUrlFromBase, resolveEffectiveUrl, validateOriginOnlyUrl } from "./full-url-resolution.util";

describe("validateOriginOnlyUrl", () => {
  it("accepts a bare origin with no trailing slash", () => {
    expect(() => validateOriginOnlyUrl("https://api.example.com")).not.toThrow();
  });

  it("accepts a bare origin with a trailing slash", () => {
    expect(() => validateOriginOnlyUrl("https://api.example.com/")).not.toThrow();
  });

  it("accepts http as well as https", () => {
    expect(() => validateOriginOnlyUrl("http://internal.example.com")).not.toThrow();
  });

  it("rejects a non-well-formed URL", () => {
    expect(() => validateOriginOnlyUrl("not-a-url")).toThrow(BusinessException);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(() => validateOriginOnlyUrl("ftp://example.com")).toThrow(BusinessException);
  });

  it("rejects a URL with a path", () => {
    expect(() => validateOriginOnlyUrl("https://api.example.com/widgets")).toThrow(BusinessException);
  });

  it("rejects a URL with a query", () => {
    expect(() => validateOriginOnlyUrl("https://api.example.com?x=1")).toThrow(BusinessException);
  });

  it("rejects a URL with a fragment", () => {
    expect(() => validateOriginOnlyUrl("https://api.example.com#frag")).toThrow(BusinessException);
  });
});

describe("composeUrlFromBase", () => {
  it("concatenates a base with no trailing slash and a path", () => {
    expect(composeUrlFromBase("https://api.example.com", "/widgets/{id}")).toBe("https://api.example.com/widgets/{id}");
  });

  it("strips exactly one trailing slash from the base before concatenating", () => {
    expect(composeUrlFromBase("https://api.example.com/", "/widgets/{id}")).toBe("https://api.example.com/widgets/{id}");
  });
});

describe("resolveEffectiveUrl", () => {
  it("prefers the override when both an override and a baseUrl are present", () => {
    const result = resolveEffectiveUrl("https://override.example.com/widgets/{id}", "https://domain.example.com", "/widgets/{id}");
    expect(result).toEqual({ url: "https://override.example.com/widgets/{id}", source: "OVERRIDE" });
  });

  it("falls back to the Environment's baseUrl + apiPath when there is no override", () => {
    const result = resolveEffectiveUrl(null, "https://domain.example.com", "/widgets/{id}");
    expect(result).toEqual({ url: "https://domain.example.com/widgets/{id}", source: "ENVIRONMENT_DOMAIN" });
  });

  it("treats an undefined override the same as null", () => {
    const result = resolveEffectiveUrl(undefined, "https://domain.example.com", "/widgets/{id}");
    expect(result).toEqual({ url: "https://domain.example.com/widgets/{id}", source: "ENVIRONMENT_DOMAIN" });
  });

  it("resolves to NOT_CONFIGURED when neither an override nor a baseUrl is set", () => {
    const result = resolveEffectiveUrl(null, null, "/widgets/{id}");
    expect(result).toEqual({ url: null, source: "NOT_CONFIGURED" });
  });

  it("treats an empty-string override as absent, not as a literal URL", () => {
    const result = resolveEffectiveUrl("", "https://domain.example.com", "/widgets/{id}");
    expect(result).toEqual({ url: "https://domain.example.com/widgets/{id}", source: "ENVIRONMENT_DOMAIN" });
  });
});
