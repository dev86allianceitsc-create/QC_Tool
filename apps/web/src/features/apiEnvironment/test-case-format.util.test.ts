import { describe, expect, it } from "vitest"

import { getInputSummaryFields } from "./test-case-format.util"

describe("getInputSummaryFields", () => {
  it("returns no fields when there is no input summary at all", () => {
    expect(getInputSummaryFields(null)).toEqual([])
  })

  it("returns no fields when every value is empty", () => {
    expect(
      getInputSummaryFields({
        pathValues: {},
        queryValues: {},
        headerValues: {},
        bodyValue: "",
      }),
    ).toEqual([])
  })

  it("renders Path/Query values as key/value fields", () => {
    expect(
      getInputSummaryFields({
        pathValues: { projectId: "123" },
        queryValues: { screen: "HOME" },
      }),
    ).toEqual([
      { key: "projectId", value: "123" },
      { key: "screen", value: "HOME" },
    ])
  })

  it("expands a JSON object body into key/value fields instead of raw JSON", () => {
    const fields = getInputSummaryFields({
      bodyValue: JSON.stringify({ UI_FirstID: "abc", UI_SecondID: "def" }),
    })

    expect(fields).toEqual([
      { key: "UI_FirstID", value: "abc" },
      { key: "UI_SecondID", value: "def" },
    ])
  })

  it("truncates long values from both Query and a JSON body", () => {
    const longValue = "x".repeat(50)

    const fields = getInputSummaryFields({
      queryValues: { token: longValue },
      bodyValue: JSON.stringify({ note: longValue }),
    })

    expect(fields).toEqual([
      { key: "token", value: `${"x".repeat(30)}…` },
      { key: "note", value: `${"x".repeat(30)}…` },
    ])
  })

  it("summarizes nested objects/arrays inside a JSON body as a placeholder, not raw JSON", () => {
    const fields = getInputSummaryFields({
      bodyValue: JSON.stringify({ filters: { a: 1 }, tags: [1, 2, 3] }),
    })

    expect(fields).toEqual([
      { key: "filters", value: "{…}" },
      { key: "tags", value: "[…]" },
    ])
  })

  it("falls back to a single truncated raw preview field for a non-JSON body", () => {
    const fields = getInputSummaryFields({ bodyValue: "username=a&password=b" })

    expect(fields).toEqual([{ key: "body", value: "username=a&password=b" }])
  })

  it("returns no fields for an empty JSON object body ('{}')", () => {
    expect(getInputSummaryFields({ bodyValue: "{}" })).toEqual([])
  })

  it("never includes headers in the fields", () => {
    expect(
      getInputSummaryFields({
        headerValues: { accept: "application/json" },
      }),
    ).toEqual([])
  })
})
