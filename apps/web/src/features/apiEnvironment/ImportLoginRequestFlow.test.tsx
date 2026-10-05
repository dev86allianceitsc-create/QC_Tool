import { fireEvent, render, screen } from "@testing-library/react"

import { describe, expect, it, vi } from "vitest"

import { ImportLoginRequestFlow } from "./ImportLoginRequestFlow"

const CURL_SAMPLE = [
  "curl 'https://target.example.com/oauth/token'",
  "  -H 'Content-Type: application/x-www-form-urlencoded'",
  "  -d 'grant_type=password&app_name=CoShareAdmin&username=alice&password=s3cret'",
].join(" \\\n")

function pasteAndParse(raw: string) {
  fireEvent.change(screen.getByLabelText("Pasted command"), {
    target: { value: raw },
  })

  fireEvent.click(screen.getByText("Parse"))
}

describe("ImportLoginRequestFlow", () => {
  it("parses a curl login request and pre-fills the review form with detected fields", () => {
    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={vi.fn()} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    expect(screen.getByText("Review Import")).toBeInTheDocument()
    expect(screen.getByLabelText("Method *")).toHaveValue("POST")
    expect(screen.getByLabelText("Login URL *")).toHaveValue(
      "https://target.example.com/oauth/token",
    )

    expect(screen.getByDisplayValue("grant_type")).toBeInTheDocument()
    expect(screen.getByDisplayValue("app_name")).toBeInTheDocument()
    expect(screen.getByDisplayValue("username")).toBeInTheDocument()
    // "password" appears twice: the body field named "password" and the
    // grant_type field's value "password".
    expect(screen.getAllByDisplayValue("password").length).toBe(2)

    expect(screen.getByLabelText("Username field *")).toHaveValue("BODY:username")
    expect(screen.getByLabelText("Password field *")).toHaveValue("BODY:password")

    expect(
      screen.getAllByText("Detected automatically — change it if this isn't right.")
        .length,
    ).toBe(2)
  })

  it("lets the admin override the detected username/password selection before saving", () => {
    const onSave = vi.fn()

    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={onSave} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    fireEvent.change(screen.getByLabelText("Username field *"), {
      target: { value: "BODY:app_name" },
    })

    fireEvent.click(screen.getByText("Use this request"))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        httpMethod: "POST",
        url: "https://target.example.com/oauth/token",
        bodyFormat: "FORM_URLENCODED",
        usernameLocation: { kind: "BODY", name: "app_name" },
        passwordLocation: { kind: "BODY", name: "password" },
      }),
    )
  })

  // Regression: clicking "Use this request" gave no visible feedback at all
  // — it silently stayed on the same review screen, so an Admin had no way
  // to tell the click had done anything short of scrolling up to notice the
  // page-level Save button had become enabled.
  it("shows a captured confirmation pointing at the page-level Save after 'Use this request'", () => {
    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={vi.fn()} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    expect(
      screen.queryByText(/Request captured\. Click Save/),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Use this request"))

    expect(
      screen.getByText(
        "Request captured. Click Save at the top of the page to save this Authentication configuration.",
      ),
    ).toBeInTheDocument()
  })

  it("hides the captured confirmation again once a field is edited after capturing", () => {
    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={vi.fn()} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    fireEvent.click(screen.getByText("Use this request"))

    expect(screen.getByText(/Request captured\./)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Login URL *"), {
      target: { value: "https://target.example.com/oauth/token-v2" },
    })

    expect(screen.queryByText(/Request captured\./)).not.toBeInTheDocument()
  })

  it("blocks Save and reports the error when the imported body format is unsupported", () => {
    const onSave = vi.fn()

    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={onSave} onCancel={vi.fn()} />,
    )

    pasteAndParse(
      [
        "curl 'https://target.example.com/login'",
        "  -H 'Content-Type: text/xml'",
        "  -d '<xml>nope</xml>'",
      ].join(" \\\n"),
    )

    expect(
      screen.getByText(
        "This request's body isn't JSON or form-urlencoded, so its fields couldn't be imported. Use Manual configuration instead.",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText("Use this request"))

    expect(
      screen.getByText(
        "The imported body format isn't supported for Import Login Request. Use Manual configuration instead.",
      ),
    ).toBeInTheDocument()

    expect(onSave).not.toHaveBeenCalled()
  })

  it("shows a friendly inline error and does not advance for unrecognized input", () => {
    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={vi.fn()} onCancel={vi.fn()} />,
    )

    pasteAndParse("just some random text")

    expect(screen.queryByText("Review Import")).not.toBeInTheDocument()
  })

  it("opens straight to the review step when an existing imported draft is provided", () => {
    render(
      <ImportLoginRequestFlow
        initialDraft={{
          httpMethod: "POST",
          url: "https://target.example.com/oauth/token",
          headerFields: [],
          bodyFields: [
            { name: "grant_type", value: "password" },
            { name: "username", value: "" },
            { name: "password", value: "" },
          ],
          bodyFormat: "FORM_URLENCODED",
          usernameLocation: { kind: "BODY", name: "username" },
          passwordLocation: { kind: "BODY", name: "password" },
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText("Review Import")).toBeInTheDocument()
    expect(screen.getByLabelText("Login URL *")).toHaveValue(
      "https://target.example.com/oauth/token",
    )
  })

  it("hides every mutation control in read-only mode", () => {
    render(
      <ImportLoginRequestFlow
        initialDraft={{
          httpMethod: "POST",
          url: "https://target.example.com/oauth/token",
          headerFields: [],
          bodyFields: [{ name: "username", value: "" }],
          bodyFormat: "FORM_URLENCODED",
          usernameLocation: { kind: "BODY", name: "username" },
          passwordLocation: null,
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        readOnly
      />,
    )

    expect(screen.getByLabelText("Login URL *")).toBeDisabled()
    expect(screen.queryByText("Use this request")).not.toBeInTheDocument()
    expect(screen.queryByText("Back")).not.toBeInTheDocument()
    expect(screen.queryByText("+ Add Header")).not.toBeInTheDocument()
    expect(screen.queryByText("+ Add Body Field")).not.toBeInTheDocument()
  })

  // Regression: the captured curl/fetch snippet only reflects what the
  // browser happened to send — some real login endpoints reject a request
  // missing a header the browser adds automatically (e.g. Origin,
  // User-Agent) that never made it into "Copy as fetch"/"Copy as cURL"
  // output. The admin needs a way to add such a header by hand instead of
  // being stuck with only what was auto-detected from the pasted text.
  it("lets the admin manually add a header row not present in the pasted request", () => {
    const onSave = vi.fn()

    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={onSave} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    fireEvent.click(screen.getByText("+ Add Header"))

    // The new row starts out empty (name and value both ""), which
    // distinguishes its two inputs from every pre-filled row on the page.
    const emptyInputs = screen
      .getAllByRole("textbox")
      .filter((el) => (el as HTMLInputElement).value === "")
    expect(emptyInputs).toHaveLength(2)
    fireEvent.change(emptyInputs[0], { target: { value: "Origin" } })
    fireEvent.change(emptyInputs[1], {
      target: { value: "https://target.example.com" },
    })

    fireEvent.click(screen.getByText("Use this request"))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        headerFields: expect.arrayContaining([
          { name: "Origin", value: "https://target.example.com" },
        ]),
      }),
    )
  })

  it("lets the admin manually add a body field row not present in the pasted request", () => {
    const onSave = vi.fn()

    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={onSave} onCancel={vi.fn()} />,
    )

    pasteAndParse(CURL_SAMPLE)

    fireEvent.click(screen.getByText("+ Add Body Field"))

    const emptyInputs = screen
      .getAllByRole("textbox")
      .filter((el) => (el as HTMLInputElement).value === "")
    expect(emptyInputs).toHaveLength(2)
    fireEvent.change(emptyInputs[0], { target: { value: "client_id" } })
    fireEvent.change(emptyInputs[1], { target: { value: "admin-portal" } })

    fireEvent.click(screen.getByText("Use this request"))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyFields: expect.arrayContaining([
          { name: "client_id", value: "admin-portal" },
        ]),
      }),
    )
  })

  it("does not offer + Add Body Field when the imported body format is unsupported", () => {
    render(
      <ImportLoginRequestFlow initialDraft={null} onSave={vi.fn()} onCancel={vi.fn()} />,
    )

    pasteAndParse(
      [
        "curl 'https://target.example.com/login'",
        "  -H 'Content-Type: text/xml'",
        "  -d '<xml>nope</xml>'",
      ].join(" \\\n"),
    )

    expect(screen.queryByText("+ Add Body Field")).not.toBeInTheDocument()
  })
})
