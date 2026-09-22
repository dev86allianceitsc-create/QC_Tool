import { describe, expect, it } from "vitest";
import { MAX_VERSION_LENGTH, UNKNOWN_VERSION, displayVersion, normalizeVersion, validateVersion } from "./version.util";

// REQ-VER-001 / VER-OD-01..03.
describe("version.util", () => {
  describe("normalizeVersion", () => {
    it("trims surrounding whitespace but preserves the declared text exactly", () => {
      expect(normalizeVersion("  v2.3.1-rc1  ")).toBe("v2.3.1-rc1");
      expect(normalizeVersion("release 2024 Q3")).toBe("release 2024 Q3");
    });

    it("treats empty and whitespace-only input as nothing declared", () => {
      expect(normalizeVersion("")).toBeNull();
      expect(normalizeVersion("   ")).toBeNull();
      expect(normalizeVersion("\t\n")).toBeNull();
    });

    it("does not enforce SemVer or reshape a free-form version (VER-OD-01)", () => {
      expect(normalizeVersion("not-a-semver")).toBe("not-a-semver");
      expect(normalizeVersion("1")).toBe("1");
    });
  });

  describe("displayVersion", () => {
    it("renders a declared version as-is", () => {
      expect(displayVersion(" 1.0.0 ")).toBe("1.0.0");
    });

    it("renders an undeclared version with the single canonical UNKNOWN token (VER-OD-02)", () => {
      expect(displayVersion("")).toBe(UNKNOWN_VERSION);
      expect(displayVersion("   ")).toBe(UNKNOWN_VERSION);
      expect(UNKNOWN_VERSION).toBe("UNKNOWN");
    });

    it("does not treat a literal 'UNKNOWN' typed by the user as a separate state", () => {
      expect(displayVersion("UNKNOWN")).toBe(UNKNOWN_VERSION);
    });
  });

  describe("validateVersion", () => {
    it("accepts blank input — both fields are optional and independent", () => {
      expect(validateVersion("", "API Version")).toBeNull();
      expect(validateVersion("   ", "Database Version")).toBeNull();
    });

    it("accepts any free-form value within the length cap", () => {
      expect(validateVersion("build-2026.09.22+abc", "API Version")).toBeNull();
      expect(validateVersion("x".repeat(MAX_VERSION_LENGTH), "API Version")).toBeNull();
    });

    it("reports — rather than truncates — a value over the length cap", () => {
      expect(validateVersion("x".repeat(MAX_VERSION_LENGTH + 1), "API Version")).toBe(
        `API Version must be ${MAX_VERSION_LENGTH} characters or fewer.`,
      );
      expect(validateVersion("x".repeat(MAX_VERSION_LENGTH + 1), "Database Version")).toBe(
        `Database Version must be ${MAX_VERSION_LENGTH} characters or fewer.`,
      );
    });

    it("measures the trimmed value, so padding alone never fails validation", () => {
      expect(validateVersion(`   ${"x".repeat(MAX_VERSION_LENGTH)}   `, "API Version")).toBeNull();
    });
  });
});
