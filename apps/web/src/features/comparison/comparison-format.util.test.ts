import { describe, expect, it } from "vitest"

import {
  formatFindingLocation,
  formatLatencyDeltaMs,
  formatLatencyMs,
  getAvailabilityReasonMessage,
  getClassificationDisplay,
  getFindingPresenceLabel,
  getInputCheckOutcomeLabel,
  getProcessingStatusDisplay,
  getResultDisplay,
  getSourceKindLabel,
  getVersionChangedDisplay,
  isFindingTypeMismatch,
} from "./comparison-format.util"

describe("getProcessingStatusDisplay", () => {
  it("maps QUEUED to Pending/neutral", () => {
    expect(getProcessingStatusDisplay("QUEUED", null)).toEqual({
      label: "Pending",
      tone: "neutral",
    })
  })

  it("maps RUNNING to Comparing/info", () => {
    expect(getProcessingStatusDisplay("RUNNING", null)).toEqual({
      label: "Comparing",
      tone: "info",
    })
  })

  it("maps FAILED to Comparison failed/danger", () => {
    expect(getProcessingStatusDisplay("FAILED", null)).toEqual({
      label: "Comparison failed",
      tone: "danger",
    })
  })

  it("maps COMPLETED to Completed/success", () => {
    expect(getProcessingStatusDisplay("COMPLETED", null)).toEqual({
      label: "Completed",
      tone: "success",
    })
  })

  it("maps BLOCKED/INPUT_MISMATCH to Input incompatible", () => {
    expect(getProcessingStatusDisplay("BLOCKED", "INPUT_MISMATCH")).toEqual({
      label: "Input incompatible",
      tone: "warning",
    })
  })

  it.each(["CONTEXT_MISMATCH", "ENVIRONMENT_MISMATCH", "AUTH_CONTEXT_UNKNOWN"])(
    "maps BLOCKED/%s (eligibility) to Pair not eligible",
    (reasonCode) => {
      expect(getProcessingStatusDisplay("BLOCKED", reasonCode)).toEqual({
        label: "Pair not eligible",
        tone: "warning",
      })
    },
  )

  it.each([
    "SNAPSHOT_INVALIDATED",
    "SNAPSHOT_INCOMPLETE",
    "UNSUPPORTED_FORMAT",
    "UNSUPPORTED_ENCODING",
    "PAYLOAD_UNAVAILABLE",
  ])(
    "maps BLOCKED/%s (data unavailable) to Cannot compare fully",
    (reasonCode) => {
      expect(getProcessingStatusDisplay("BLOCKED", reasonCode)).toEqual({
        label: "Cannot compare fully",
        tone: "warning",
      })
    },
  )

  it("falls back to Blocked/warning when reasonCode is null", () => {
    expect(getProcessingStatusDisplay("BLOCKED", null)).toEqual({
      label: "Blocked",
      tone: "warning",
    })
  })

  it("falls back to Blocked/warning for an unrecognized reasonCode", () => {
    expect(getProcessingStatusDisplay("BLOCKED", "SOME_FUTURE_CODE")).toEqual({
      label: "Blocked",
      tone: "warning",
    })
  })
})

describe("getResultDisplay", () => {
  it("renders SAME/success once COMPLETED", () => {
    expect(getResultDisplay("COMPLETED", "SAME")).toEqual({
      label: "SAME",
      tone: "success",
    })
  })

  it("renders DIFFERENT/danger once COMPLETED", () => {
    expect(getResultDisplay("COMPLETED", "DIFFERENT")).toEqual({
      label: "DIFFERENT",
      tone: "danger",
    })
  })

  it("returns null when COMPLETED but result is still null", () => {
    expect(getResultDisplay("COMPLETED", null)).toBeNull()
  })

  it("returns null for BLOCKED even if a stale result value is present", () => {
    expect(getResultDisplay("BLOCKED", "SAME")).toBeNull()
  })

  it("returns null for QUEUED", () => {
    expect(getResultDisplay("QUEUED", null)).toBeNull()
  })

  it("returns null for RUNNING", () => {
    expect(getResultDisplay("RUNNING", null)).toBeNull()
  })

  it("returns null for FAILED", () => {
    expect(getResultDisplay("FAILED", null)).toBeNull()
  })
})

describe("getClassificationDisplay", () => {
  it("defaults to Not marked/neutral", () => {
    expect(getClassificationDisplay(null)).toEqual({
      label: "Not marked",
      tone: "neutral",
    })
  })

  it("renders EXPECTED as Expected/success", () => {
    expect(getClassificationDisplay("EXPECTED")).toEqual({
      label: "Expected",
      tone: "success",
    })
  })

  it("renders UNEXPECTED as Unexpected/warning", () => {
    expect(getClassificationDisplay("UNEXPECTED")).toEqual({
      label: "Unexpected",
      tone: "warning",
    })
  })
})

describe("getSourceKindLabel", () => {
  it("labels AUTO_EXECUTION as Automatic", () => {
    expect(getSourceKindLabel("AUTO_EXECUTION", null)).toBe("Automatic")
  })

  it("labels MANUAL_PAIR as Two Snapshots", () => {
    expect(getSourceKindLabel("MANUAL_PAIR", null)).toBe("Two Snapshots")
  })

  it("labels BASELINE_LATEST as Baseline vs latest", () => {
    expect(getSourceKindLabel("BASELINE_LATEST", null)).toBe(
      "Baseline vs latest",
    )
  })

  it("labels CHAIN_PAIR with its ordinal", () => {
    expect(getSourceKindLabel("CHAIN_PAIR", 3)).toBe("Chain #3")
  })

  it("labels CHAIN_PAIR without an ordinal as bare Chain", () => {
    expect(getSourceKindLabel("CHAIN_PAIR", null)).toBe("Chain")
  })
})

describe("formatLatencyMs", () => {
  it("renders null as No data, never 0", () => {
    expect(formatLatencyMs(null)).toBe("No data")
  })

  it("renders zero latency as 0 ms, distinct from missing data", () => {
    expect(formatLatencyMs(0)).toBe("0 ms")
  })

  it("renders a positive latency with unit suffix", () => {
    expect(formatLatencyMs(120)).toBe("120 ms")
  })
})

describe("formatLatencyDeltaMs", () => {
  it("renders null as an empty string, never 0", () => {
    expect(formatLatencyDeltaMs(null)).toBe("")
  })

  it("renders a zero delta as 0 ms without a plus sign", () => {
    expect(formatLatencyDeltaMs(0)).toBe("0 ms")
  })

  it("renders a positive delta with a leading plus sign", () => {
    expect(formatLatencyDeltaMs(50)).toBe("+50 ms")
  })

  it("renders a negative delta with its own minus sign, not doubled", () => {
    expect(formatLatencyDeltaMs(-50)).toBe("-50 ms")
  })
})

describe("getVersionChangedDisplay", () => {
  it("treats null as undetermined, never confirmed-equal", () => {
    expect(getVersionChangedDisplay(null)).toEqual({ kind: "undetermined" })
  })

  it("treats true as changed", () => {
    expect(getVersionChangedDisplay(true)).toEqual({ kind: "changed" })
  })

  it("treats false as unchanged", () => {
    expect(getVersionChangedDisplay(false)).toEqual({ kind: "unchanged" })
  })
})

describe("getAvailabilityReasonMessage", () => {
  it("describes NO_LATEST_SNAPSHOT", () => {
    expect(getAvailabilityReasonMessage("NO_LATEST_SNAPSHOT")).toBe(
      "No latest Snapshot in the selected scope yet.",
    )
  })

  it("describes NO_BASELINE", () => {
    expect(getAvailabilityReasonMessage("NO_BASELINE")).toBe(
      "The latest Snapshot's Execution has no baseline yet.",
    )
  })

  it("describes BASELINE_INVALIDATED", () => {
    expect(getAvailabilityReasonMessage("BASELINE_INVALIDATED")).toBe(
      "The baseline has been invalidated; the system won't automatically choose another one.",
    )
  })
})

describe("getInputCheckOutcomeLabel", () => {
  it("renders null as Not yet determined", () => {
    expect(getInputCheckOutcomeLabel(null)).toBe("Not yet determined")
  })

  it("renders COMPATIBLE as Compatible", () => {
    expect(getInputCheckOutcomeLabel("COMPATIBLE")).toBe("Compatible")
  })

  it("renders MISMATCH as Mismatch", () => {
    expect(getInputCheckOutcomeLabel("MISMATCH")).toBe("Mismatch")
  })
})

describe("getFindingPresenceLabel", () => {
  it("labels ABSENT as Does not exist", () => {
    expect(getFindingPresenceLabel("ABSENT", "object")).toBe("Does not exist")
  })

  it("labels NULL as JSON null", () => {
    expect(getFindingPresenceLabel("NULL", "null")).toBe("JSON null")
  })

  it("labels EMPTY+array distinctly as Empty array", () => {
    expect(getFindingPresenceLabel("EMPTY", "array")).toBe("Empty array")
  })

  it("labels EMPTY+string distinctly as Empty string", () => {
    expect(getFindingPresenceLabel("EMPTY", "string")).toBe("Empty string")
  })

  it("labels EMPTY of any other display kind as bare Empty", () => {
    expect(getFindingPresenceLabel("EMPTY", "object")).toBe("Empty")
  })

  it("labels VALUE as Has value", () => {
    expect(getFindingPresenceLabel("VALUE", "string")).toBe("Has value")
  })
})

describe("isFindingTypeMismatch", () => {
  it("is false when both sides share a display kind", () => {
    expect(
      isFindingTypeMismatch({ displayKind: "string" }, {
        displayKind: "string",
      }),
    ).toBe(false)
  })

  it("is true when display kinds differ across sides", () => {
    expect(
      isFindingTypeMismatch({ displayKind: "string" }, {
        displayKind: "number",
      }),
    ).toBe(true)
  })
})

describe("formatFindingLocation", () => {
  it("returns null when there is no location at all", () => {
    expect(formatFindingLocation(null)).toBeNull()
  })

  it("returns the JSON path verbatim for a path-shaped location", () => {
    expect(formatFindingLocation({ path: "$.foo" })).toBe("$.foo")
  })

  it("returns null when a byte-range location has no offsets on either side", () => {
    expect(
      formatFindingLocation({
        aByteOffset: null,
        aByteLength: null,
        bByteOffset: null,
        bByteLength: null,
      }),
    ).toBeNull()
  })

  it("renders only side A when only A has offsets", () => {
    expect(
      formatFindingLocation({
        aByteOffset: "10",
        aByteLength: "20",
        bByteOffset: null,
        bByteLength: null,
      }),
    ).toBe("A: offset 10, length 20")
  })

  it("renders only side B when only B has offsets", () => {
    expect(
      formatFindingLocation({
        aByteOffset: null,
        aByteLength: null,
        bByteOffset: "5",
        bByteLength: "15",
      }),
    ).toBe("B: offset 5, length 15")
  })

  it("joins both sides with a middle dot when both have offsets", () => {
    expect(
      formatFindingLocation({
        aByteOffset: "10",
        aByteLength: "20",
        bByteOffset: "5",
        bByteLength: "15",
      }),
    ).toBe("A: offset 10, length 20 · B: offset 5, length 15")
  })

  it("falls back to a question mark for a partial byte-range", () => {
    expect(
      formatFindingLocation({
        aByteOffset: "10",
        aByteLength: null,
        bByteOffset: null,
        bByteLength: null,
      }),
    ).toBe("A: offset 10, length ?")
  })
})
