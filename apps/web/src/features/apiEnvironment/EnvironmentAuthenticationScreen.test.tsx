import { fireEvent, render, screen, within } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { EnvironmentAuthenticationScreen } from "./EnvironmentAuthenticationScreen"

const ENVIRONMENT = {
  environmentId: "e1",

  projectId: "p1",

  environmentName: "UAT",

  classification: "NON_PRODUCTION",

  allowRun: true,

  environmentStatus: "ACTIVE",

  baseUrl: null,

  createdAt: "t",

  updatedAt: "t",
}

// Already LOGIN_FORM/IMPORTED with a saved import, so ImportLoginRequestFlow
// opens straight to its "review" step — the exact screen state the user was
// on when they edited the Login URL and hit "Use this request".
const AUTH_CONFIG = {
  environmentId: "e1",

  authType: "LOGIN_FORM",

  credentialStatus: "NOT_REQUIRED",

  loginMode: "IMPORTED",

  loginUrl: null,

  usernameField: null,

  passwordField: null,

  importMethod: "POST",

  importUrl: "https://coshare-api-dev-ad.allianceitsc.com/oauth2/token",

  importHeaders: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }],

  importBodyFormat: "FORM_URLENCODED",

  importBodyFields: [
    { name: "username", value: "" },
    { name: "password", value: "" },
  ],

  importUsernameLocation: { kind: "BODY", name: "username" },

  importPasswordLocation: { kind: "BODY", name: "password" },

  updatedAt: "2026-01-01T00:00:00Z",
}

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const }

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/authentication/test-accounts")) {
      return Promise.resolve(mockJsonResponse(200, []))
    }

    if (url.includes("/authentication")) {
      if (init?.method === "PUT" || init?.method === "DELETE") {
        const payload = init.body ? JSON.parse(init.body as string) : {}

        return Promise.resolve(mockJsonResponse(200, { ...AUTH_CONFIG, ...payload }))
      }

      return Promise.resolve(mockJsonResponse(200, AUTH_CONFIG))
    }

    if (url.includes("/environments/")) {
      return Promise.resolve(mockJsonResponse(200, ENVIRONMENT))
    }

    return Promise.resolve(mockJsonResponse(404, {}))
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderScreen(onBack = vi.fn()) {
  render(
    <EnvironmentAuthenticationScreen
      user={ADMIN}
      projectId="p1"
      projectStatus="ACTIVE"
      environmentId="e1"
      accessToken="token-1"
      onBack={onBack}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  )

  return onBack
}

async function editLoginUrlAndCapture(nextUrl: string) {
  const urlInput = await screen.findByLabelText("Login URL *")

  fireEvent.change(urlInput, { target: { value: nextUrl } })

  fireEvent.click(screen.getByText("Use this request"))

  await screen.findByText(/Request captured\. Click Save/)
}

describe("EnvironmentAuthenticationScreen — unsaved changes guard", () => {
  // Regression: editing the Login URL and clicking "Use this request" did
  // capture the edit locally (see ImportLoginRequestFlow.test.tsx), but
  // EnvironmentAuthenticationScreen never wired AuthenticationTab's
  // onDirtyChange into any navigation guard, so clicking "Environments"
  // right after silently discarded the captured edit with no warning.
  it("blocks the Environments back-link with a confirmation after an unsaved Login URL edit", async () => {
    stubFetch()

    const onBack = renderScreen()

    await editLoginUrlAndCapture(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Environments"))

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You have unsaved changes on this Authentication Configuration. Leave and discard them?",
      ),
    ).toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
  })

  it("navigates back once the Admin confirms leaving with unsaved changes", async () => {
    stubFetch()

    const onBack = renderScreen()

    await editLoginUrlAndCapture(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )

    fireEvent.click(screen.getByText("Environments"))

    fireEvent.click(screen.getByText("Leave"))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("dismisses the confirmation and keeps the unsaved edit when the Admin cancels", async () => {
    stubFetch()

    const onBack = renderScreen()

    await editLoginUrlAndCapture(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )

    fireEvent.click(screen.getByText("Environments"))

    const dialogTitle = screen.getByText("Unsaved changes")

    // Scoped to the "Unsaved changes" dialog itself — the review step
    // underneath it also has its own unrelated "Cancel" button (discards the
    // whole import draft back to the saved config), so an unscoped query
    // would match both.
    fireEvent.click(
      within(dialogTitle.closest(".w-full") as HTMLElement).getByText("Cancel"),
    )

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Login URL *")).toHaveValue(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )
  })

  it("navigates immediately with no confirmation when there are no unsaved changes", async () => {
    stubFetch()

    const onBack = renderScreen()

    await screen.findByLabelText("Login URL *")

    fireEvent.click(screen.getByText("Environments"))

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe("EnvironmentAuthenticationScreen — saving an edited Login URL end-to-end", () => {
  // Regression for a user report that editing the Login URL, clicking "Use
  // this request", then clicking the page-level Save did not persist the
  // change and gave no visible confirmation. Exercises the full stack (this
  // screen -> AuthenticationTab -> ImportLoginRequestFlow -> useAuthentication
  // -> fetch) rather than AuthenticationTab in isolation, since that's the
  // path the report described.
  it("sends the PUT with the new importUrl and reflects the saved value", async () => {
    const fetchMock = stubFetch()

    renderScreen()

    await editLoginUrlAndCapture(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )

    fireEvent.click(screen.getByText("Save"))

    await screen.findByText("Saved.")

    const putCall = fetchMock.mock.calls.find((call: any[]) => {
      const [url, init] = call as [string, RequestInit?]
      return url.includes("/authentication") && init?.method === "PUT"
    })

    expect(putCall).toBeTruthy()

    const body = JSON.parse((putCall as any[])[1].body as string)
    expect(body.importUrl).toBe(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )

    expect(screen.getByLabelText("Login URL *")).toHaveValue(
      "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
    )
  })
})
