import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { IgnoreFieldsConfirmDialog } from "./IgnoreFieldsConfirmDialog"

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body))

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderDialog(
  overrides: Partial<{
    paths: string[]
    onCancel: () => void
    onSuccess: (result: { created: unknown[]; skippedCount: number }) => void
  }> = {},
) {
  const onCancel = overrides.onCancel ?? vi.fn()
  const onSuccess = overrides.onSuccess ?? vi.fn()

  render(
    <IgnoreFieldsConfirmDialog
      paths={overrides.paths ?? ["$.StartTime", "$.EndTime", "$.TotalMilli"]}
      projectId="p1"
      apiId="a1"
      accessToken="token-1"
      onCancel={onCancel}
      onSuccess={onSuccess}
    />,
  )

  return { onCancel, onSuccess }
}

describe("IgnoreFieldsConfirmDialog", () => {
  it("renders the selected paths list and the field count in the title", () => {
    stubFetch({ created: [], skippedCount: 0 }, 201)

    renderDialog()

    expect(screen.getByText("Ignore 3 fields")).toBeInTheDocument()
    expect(screen.getByText("$.StartTime")).toBeInTheDocument()
    expect(screen.getByText("$.EndTime")).toBeInTheDocument()
    expect(screen.getByText("$.TotalMilli")).toBeInTheDocument()
  })

  it("defaults scope to This API", () => {
    stubFetch({ created: [], skippedCount: 0 }, 201)

    renderDialog()

    const apiRadio = screen.getByRole("radio", {
      name: "This API (Only this API)",
    }) as HTMLInputElement
    const projectRadio = screen.getByRole("radio", {
      name: "Entire Project (All APIs in this project)",
    }) as HTMLInputElement

    expect(apiRadio.checked).toBe(true)
    expect(projectRadio.checked).toBe(false)
  })

  it("confirms with the API scope by default, sending apiId", async () => {
    const fetchMock = stubFetch({ created: [], skippedCount: 0 }, 201)

    renderDialog({ paths: ["$.StartTime"] })

    fireEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0]

    expect(String(url)).toContain("/projects/p1/ignore-rules/bulk")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(
      JSON.stringify({ scope: "API", apiId: "a1", paths: ["$.StartTime"] }),
    )
  })

  it("switches to Entire Project scope and sends no apiId", async () => {
    const fetchMock = stubFetch({ created: [], skippedCount: 0 }, 201)

    renderDialog({ paths: ["$.StartTime"] })

    fireEvent.click(
      screen.getByRole("radio", {
        name: "Entire Project (All APIs in this project)",
      }),
    )

    fireEvent.click(screen.getByText("Confirm"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]

    expect(init.body).toBe(
      JSON.stringify({ scope: "PROJECT", paths: ["$.StartTime"] }),
    )
  })

  it("calls onSuccess with the bulk create result", async () => {
    stubFetch({ created: [{ ignoreRuleId: "r1" }], skippedCount: 1 }, 201)

    const { onSuccess } = renderDialog({ paths: ["$.StartTime"] })

    fireEvent.click(screen.getByText("Confirm"))

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        created: [{ ignoreRuleId: "r1" }],
        skippedCount: 1,
      }),
    )
  })

  it("calls onCancel when Cancel is clicked", () => {
    stubFetch({ created: [], skippedCount: 0 }, 201)

    const { onCancel } = renderDialog()

    fireEvent.click(screen.getByText("Cancel"))

    expect(onCancel).toHaveBeenCalled()
  })

  it("shows the API error message on failure", async () => {
    stubFetch(
      { errorCode: "VALIDATION_ERROR", message: "Path is invalid", details: [], requestId: "r" },
      400,
    )

    renderDialog({ paths: ["$.StartTime"] })

    fireEvent.click(screen.getByText("Confirm"))

    expect(await screen.findByText("Path is invalid")).toBeInTheDocument()
  })
})
