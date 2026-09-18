import { describe, expect, it } from "vitest";
import { derivePathParameters, isDuplicateName, isReservedHeaderName, validateParameterNameFormat } from "./requestInput.util";

describe("derivePathParameters", () => {
  it("extracts a single {placeholder} as a Required, Auto-detected Path parameter", () => {
    expect(derivePathParameters("/widgets/{id}")).toEqual([{ name: "id", required: true, source: "AUTO_DETECTED" }]);
  });

  it("extracts multiple placeholders in order and dedups repeats", () => {
    expect(derivePathParameters("/orgs/{orgId}/widgets/{id}/{orgId}")).toEqual([
      { name: "orgId", required: true, source: "AUTO_DETECTED" },
      { name: "id", required: true, source: "AUTO_DETECTED" },
    ]);
  });

  it("returns an empty list when the path has no placeholders", () => {
    expect(derivePathParameters("/widgets")).toEqual([]);
  });
});

describe("isReservedHeaderName", () => {
  it("flags Authorization and Content-Type case-insensitively", () => {
    expect(isReservedHeaderName("Authorization")).toBe(true);
    expect(isReservedHeaderName("AUTHORIZATION")).toBe(true);
    expect(isReservedHeaderName("content-type")).toBe(true);
    expect(isReservedHeaderName("Content-Type")).toBe(true);
  });

  it("does not flag an unrelated header name", () => {
    expect(isReservedHeaderName("X-Client-ID")).toBe(false);
  });
});

describe("validateParameterNameFormat", () => {
  it("rejects an empty/whitespace name", () => {
    expect(validateParameterNameFormat("", "QUERY")).toBeTruthy();
    expect(validateParameterNameFormat("   ", "HEADER")).toBeTruthy();
  });

  it("rejects a QUERY name containing reserved delimiter characters", () => {
    expect(validateParameterNameFormat("a=b", "QUERY")).toBeTruthy();
    expect(validateParameterNameFormat("a&b", "QUERY")).toBeTruthy();
    expect(validateParameterNameFormat("a b", "QUERY")).toBeTruthy();
  });

  it("accepts a well-formed QUERY name", () => {
    expect(validateParameterNameFormat("status", "QUERY")).toBeNull();
  });

  it("rejects a HEADER name containing an invalid character", () => {
    expect(validateParameterNameFormat("X Client", "HEADER")).toBeTruthy();
  });

  it("accepts a well-formed HEADER name", () => {
    expect(validateParameterNameFormat("X-Client-ID", "HEADER")).toBeNull();
  });
});

describe("isDuplicateName", () => {
  it("is case-sensitive for QUERY", () => {
    expect(isDuplicateName("status", ["status"], "QUERY")).toBe(true);
    expect(isDuplicateName("Status", ["status"], "QUERY")).toBe(false);
  });

  it("is case-insensitive for HEADER", () => {
    expect(isDuplicateName("X-Client-ID", ["x-client-id"], "HEADER")).toBe(true);
    expect(isDuplicateName("X-CLIENT-ID", ["x-client-id"], "HEADER")).toBe(true);
  });
});
