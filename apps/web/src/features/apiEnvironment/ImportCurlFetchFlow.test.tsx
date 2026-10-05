import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { describe, expect, it, vi } from "vitest"

import { ImportCurlFetchFlow } from "./ImportCurlFetchFlow"

const CURL_SAMPLE = [
  "curl 'https://api.example.com/widgets/123?status=active'",
  "  -H 'Authorization: Bearer abc123'",
  "  -H 'Accept: application/json'",
].join(" \\\n")

function pasteAndParse(raw: string) {
  fireEvent.change(screen.getByLabelText("Pasted command"), {
    target: { value: raw },
  })

  fireEvent.click(screen.getByText("Parse"))
}

describe("ImportCurlFetchFlow", () => {
  it("parses a curl command and pre-fills the review form, excluding the Authorization header", () => {
    render(
      <ImportCurlFetchFlow onImport={vi.fn()} onImported={vi.fn()} onClose={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    expect(screen.getByText("Review Import")).toBeInTheDocument()
    expect(screen.getByLabelText("API Name *")).toHaveValue("GET /widgets/123")
    expect(screen.getByLabelText("Method *")).toHaveValue("GET")
    expect(screen.getByLabelText("Path *")).toHaveValue("/widgets/123")

    expect(screen.getByDisplayValue("status")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Accept")).toBeInTheDocument()

    expect(screen.queryByDisplayValue("Authorization")).not.toBeInTheDocument()
    expect(screen.getByText(/Authorization'.*reserved/)).toBeInTheDocument()
  })

  it("submits the edited path and detected parameters as the import payload", async () => {
    const created = {
      apiId: "api-1",
      projectId: "project-1",
      apiName: "GET /widgets/123",
      httpMethod: "GET",
      path: "/widgets/{id}",
      description: null,
      creationSource: "CURL_FETCH_IMPORT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    const onImport = vi.fn().mockResolvedValue(created)
    const onImported = vi.fn()
    const onClose = vi.fn()

    render(
      <ImportCurlFetchFlow onImport={onImport} onImported={onImported} onClose={onClose} />,
    )

    pasteAndParse(CURL_SAMPLE)

    fireEvent.change(screen.getByLabelText("Path *"), {
      target: { value: "/widgets/{id}" },
    })

    fireEvent.click(screen.getByText("Create API"))

    await waitFor(() => expect(onImport).toHaveBeenCalled())

    expect(onImport).toHaveBeenCalledWith({
      apiName: "GET /widgets/123",
      httpMethod: "GET",
      path: "/widgets/{id}",
      description: null,
      queryParameters: [{ name: "status", required: false }],
      headerParameters: [{ name: "Accept", required: false }],
      requestBody: null,
    })

    await waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(onImported).toHaveBeenCalledWith(created, {
      pathValues: { id: "123" },
      queryValues: { status: "active" },
      headerValues: { Accept: "application/json" },
      bodyValue: "",
    })
    expect(onClose).toHaveBeenCalled()
  })

  it("shows a friendly inline error and does not advance for unrecognized input", () => {
    render(
      <ImportCurlFetchFlow onImport={vi.fn()} onImported={vi.fn()} onClose={vi.fn()} />,
    )

    pasteAndParse("just some random text")

    expect(screen.queryByText("Review Import")).not.toBeInTheDocument()
    expect(
      screen.getByText(/Couldn't recognize this as a curl command/),
    ).toBeInTheDocument()
  })
})
