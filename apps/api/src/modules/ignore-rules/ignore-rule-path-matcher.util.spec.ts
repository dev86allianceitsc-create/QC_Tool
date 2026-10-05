import { compileIgnorePathPattern, filterIgnoredFindings, matchesIgnorePath } from "./ignore-rule-path-matcher.util";

describe("ignore-rule-path-matcher.util", () => {
  describe("matchesIgnorePath", () => {
    it("matches an exact nested literal path", () => {
      expect(matchesIgnorePath("$.Data.Status", "$.Data.Status")).toBe(true);
      expect(matchesIgnorePath("$.StartTime", "$.StartTime")).toBe(true);
    });

    it("does not match a path that merely shares a prefix", () => {
      expect(matchesIgnorePath("$.Data.Status", "$.Data.StatusCode")).toBe(false);
      expect(matchesIgnorePath("$.Status", "$.Data.Status")).toBe(false);
    });

    it("does not match a deeper or shallower path", () => {
      expect(matchesIgnorePath("$.Data.User.updatedAt", "$.Data.updatedAt")).toBe(false);
      expect(matchesIgnorePath("$.Data.updatedAt", "$.Data.User.updatedAt")).toBe(false);
    });

    it("matches a single-level array wildcard against any concrete numeric index", () => {
      expect(matchesIgnorePath("$.Data[*].updatedAt", "$.Data[0].updatedAt")).toBe(true);
      expect(matchesIgnorePath("$.Data[*].updatedAt", "$.Data[42].updatedAt")).toBe(true);
    });

    it("does not let the wildcard match a non-numeric or multi-segment path", () => {
      expect(matchesIgnorePath("$.Data[*].updatedAt", "$.Data.updatedAt")).toBe(false);
      expect(matchesIgnorePath("$.Data[*].updatedAt", "$.Data[0].User.updatedAt")).toBe(false);
    });

    it("escapes regex-special characters in literal segments so they are not treated as regex syntax", () => {
      expect(matchesIgnorePath("$.a.b(c)", "$.a.b(c)")).toBe(true);
      expect(matchesIgnorePath("$.a.b(c)", "$.a.bXc)")).toBe(false);
      expect(matchesIgnorePath("$.price+tax", "$.priceXtax")).toBe(false);
    });
  });

  describe("compileIgnorePathPattern", () => {
    it("anchors the compiled pattern to the full string", () => {
      const pattern = compileIgnorePathPattern("$.Data.Status");
      expect(pattern.source.startsWith("^")).toBe(true);
      expect(pattern.source.endsWith("$")).toBe(true);
    });
  });

  describe("filterIgnoredFindings", () => {
    const makeFinding = (overrides: Record<string, unknown> = {}) => ({
      component: "RESPONSE_BODY",
      locationPath: "$.StartTime",
      ...overrides,
    });

    it("returns all findings unchanged and no applied rules when there are no active rules", () => {
      const findings = [makeFinding()];

      const result = filterIgnoredFindings(findings, []);

      expect(result).toEqual({ remaining: findings, applied: [] });
    });

    it("returns empty remaining/applied when there are no findings", () => {
      const result = filterIgnoredFindings([], [{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" }]);

      expect(result).toEqual({ remaining: [], applied: [] });
    });

    it("suppresses a RESPONSE_BODY finding whose locationPath matches an active rule", () => {
      const findings = [makeFinding({ locationPath: "$.StartTime" })];

      const result = filterIgnoredFindings(findings, [{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" }]);

      expect(result.remaining).toEqual([]);
      expect(result.applied).toEqual([{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }]);
    });

    it("leaves a non-matching RESPONSE_BODY finding in remaining and records no applied rule for it", () => {
      const findings = [makeFinding({ locationPath: "$.Data.Status" })];

      const result = filterIgnoredFindings(findings, [{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" }]);

      expect(result.remaining).toEqual(findings);
      expect(result.applied).toEqual([]);
    });

    it("never suppresses a non-RESPONSE_BODY finding, even if its locationPath happens to match a rule", () => {
      const findings = [makeFinding({ component: "RESPONSE_HEADER", locationPath: "$.StartTime" }), makeFinding({ component: "HTTP_STATUS", locationPath: "$.StartTime" })];

      const result = filterIgnoredFindings(findings, [{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" }]);

      expect(result.remaining).toEqual(findings);
      expect(result.applied).toEqual([]);
    });

    it("never suppresses a RESPONSE_BODY finding with a null or undefined locationPath", () => {
      const findings = [makeFinding({ locationPath: null }), makeFinding({ locationPath: undefined })];

      const result = filterIgnoredFindings(findings, [{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" }]);

      expect(result.remaining).toEqual(findings);
      expect(result.applied).toEqual([]);
    });

    it("splits mixed findings: suppresses the matched ones, keeps the rest as remaining", () => {
      const findings = [
        makeFinding({ locationPath: "$.StartTime" }),
        makeFinding({ locationPath: "$.EndTime" }),
        makeFinding({ locationPath: "$.Data.Status" }),
      ];
      const rules = [
        { ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" },
        { ignoreRuleId: "r-2", scope: "API", path: "$.EndTime" },
      ];

      const result = filterIgnoredFindings(findings, rules);

      expect(result.remaining).toEqual([findings[2]]);
      expect(result.applied).toEqual(
        expect.arrayContaining([
          { ignoreRuleId: "r-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 },
          { ignoreRuleId: "r-2", scope: "API", path: "$.EndTime", suppressedFindingCount: 1 },
        ]),
      );
      expect(result.applied).toHaveLength(2);
    });

    it("aggregates suppressedFindingCount when multiple findings match the same rule (array wildcard)", () => {
      const findings = [
        makeFinding({ locationPath: "$.Data[0].updatedAt" }),
        makeFinding({ locationPath: "$.Data[1].updatedAt" }),
        makeFinding({ locationPath: "$.Data[2].updatedAt" }),
      ];

      const result = filterIgnoredFindings(findings, [{ ignoreRuleId: "r-1", scope: "PROJECT", path: "$.Data[*].updatedAt" }]);

      expect(result.remaining).toEqual([]);
      expect(result.applied).toEqual([{ ignoreRuleId: "r-1", scope: "PROJECT", path: "$.Data[*].updatedAt", suppressedFindingCount: 3 }]);
    });

    it("only produces an applied record for rules that actually suppressed something, never a rule that matched nothing", () => {
      const findings = [makeFinding({ locationPath: "$.StartTime" })];
      const rules = [
        { ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" },
        { ignoreRuleId: "r-2", scope: "API", path: "$.Unused" },
      ];

      const result = filterIgnoredFindings(findings, rules);

      expect(result.applied).toEqual([{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }]);
    });

    it("uses the first matching rule when multiple active rules could match the same finding", () => {
      const findings = [makeFinding({ locationPath: "$.StartTime" })];
      const rules = [
        { ignoreRuleId: "r-1", scope: "API", path: "$.StartTime" },
        { ignoreRuleId: "r-2", scope: "PROJECT", path: "$.StartTime" },
      ];

      const result = filterIgnoredFindings(findings, rules);

      expect(result.applied).toEqual([{ ignoreRuleId: "r-1", scope: "API", path: "$.StartTime", suppressedFindingCount: 1 }]);
    });
  });
});
