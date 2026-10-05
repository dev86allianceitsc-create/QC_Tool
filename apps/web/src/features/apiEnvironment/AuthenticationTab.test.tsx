import { useState } from "react"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { describe, expect, it, vi } from "vitest"

import { ApiError } from "../../services/api-client"

import { AuthenticationTab } from "./AuthenticationTab"

import type { AuthenticationConfiguration } from "./authentication.types"

function config(
  overrides: Partial<AuthenticationConfiguration> = {},
): AuthenticationConfiguration {
  return {
    environmentId: "e1",

    authType: "NONE",

    credentialStatus: "NOT_REQUIRED",

    loginMode: null,

    loginUrl: null,

    usernameField: null,

    passwordField: null,

    importMethod: null,

    importUrl: null,

    importHeaders: null,

    importBodyFormat: null,

    importBodyFields: null,

    importUsernameLocation: null,

    importPasswordLocation: null,

    updatedAt: "2026-09-22T09:00:00.000Z",

    ...overrides,
  }
}

function renderTab(
  overrides: Partial<Parameters<typeof AuthenticationTab>[0]> = {},
) {
  const onSaveConfiguration = vi.fn(
    async (payload: { authType: AuthenticationConfiguration["authType"] }) =>
      config({
        authType: payload.authType,
        credentialStatus:
          payload.authType === "NONE" ? "NOT_REQUIRED" : "NOT_CONFIGURED",
      }),
  )

  const onSaveCredential = vi.fn(async () => config())

  const onRemoveCredential = vi.fn(async () => config())

  const props = {
    config: config(),

    readOnly: false,

    onSaveConfiguration,

    onSaveCredential,

    onRemoveCredential,

    ...overrides,
  } as Parameters<typeof AuthenticationTab>[0]

  render(<AuthenticationTab {...props} />)

  return { onSaveConfiguration, onSaveCredential, onRemoveCredential }
}

function selectType(value: string) {
  fireEvent.change(screen.getByLabelText("Type"), { target: { value } })
}

function selectLoginMode(value: string) {
  fireEvent.change(screen.getByLabelText("Login Form Mode"), {
    target: { value },
  })
}

describe("AuthenticationTab — Authentication Type change confirmation (AC-UI-3C-03)", () => {
  it("does not send the change until the confirmation is accepted", async () => {
    const { onSaveConfiguration } = renderTab({
      config: config({
        authType: "BEARER_TOKEN",
        credentialStatus: "CONFIGURED",
      }),
    })

    selectType("NONE")

    fireEvent.click(screen.getByText("Save"))

    expect(
      await screen.findByText("Change authentication type"),
    ).toBeInTheDocument()

    expect(onSaveConfiguration).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("Change type"))

    await waitFor(() =>
      expect(onSaveConfiguration).toHaveBeenCalledWith({ authType: "NONE" }),
    )
  })

  it("states that the previous type's configuration is kept, not removed", async () => {
    renderTab({
      config: config({
        authType: "BEARER_TOKEN",
        credentialStatus: "CONFIGURED",
      }),
    })

    selectType("NONE")

    fireEvent.click(screen.getByText("Save"))

    const message = await screen.findByText(
      /Bearer Token's configuration is kept/,
    )

    expect(message).toHaveTextContent("reappears if you switch back to it")
  })

  it("confirms every type change identically, regardless of credential status", async () => {
    const { onSaveConfiguration } = renderTab({
      config: config({ authType: "NONE", credentialStatus: "NOT_REQUIRED" }),
    })

    selectType("BEARER_TOKEN")

    fireEvent.click(screen.getByText("Save"))

    expect(
      await screen.findByText("Change authentication type"),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/None's configuration is kept/),
    ).toBeInTheDocument()

    expect(onSaveConfiguration).not.toHaveBeenCalled()
  })

  it("leaves the stored type and credential untouched when the confirmation is cancelled", async () => {
    const { onSaveConfiguration } = renderTab({
      config: config({
        authType: "BEARER_TOKEN",
        credentialStatus: "CONFIGURED",
      }),
    })

    selectType("NONE")

    fireEvent.click(screen.getByText("Save"))

    fireEvent.click(await screen.findByText("Cancel"))

    await waitFor(() =>
      expect(
        screen.queryByText("Change authentication type"),
      ).not.toBeInTheDocument(),
    )

    expect(onSaveConfiguration).not.toHaveBeenCalled()

    expect(screen.getByText("Configured")).toBeInTheDocument()
  })

  it("restores the saved type when 'Cancel changes' is used", () => {
    renderTab({
      config: config({
        authType: "BEARER_TOKEN",
        credentialStatus: "CONFIGURED",
      }),
    })

    selectType("LOGIN_FORM")

    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe(
      "LOGIN_FORM",
    )

    fireEvent.click(screen.getByText("Cancel changes"))

    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe(
      "BEARER_TOKEN",
    )
  })

  it("re-shows the previously-saved Imported draft after switching authType away and back, once the backend preserves it", async () => {
    const preservedImportFields = {
      loginMode: "IMPORTED" as const,
      importMethod: "POST",
      importUrl: "https://target.example.com/oauth/token",
      importHeaders: [],
      importBodyFormat: "FORM_URLENCODED" as const,
      importBodyFields: [{ name: "username", value: "" }],
      importUsernameLocation: { kind: "BODY" as const, name: "username" },
      importPasswordLocation: null,
    }

    const onSaveConfiguration = vi.fn(async () =>
      config({
        authType: "NONE",
        credentialStatus: "NOT_REQUIRED",
        ...preservedImportFields,
      }),
    )

    renderTab({
      config: config({
        authType: "LOGIN_FORM",
        credentialStatus: "NOT_CONFIGURED",
        ...preservedImportFields,
      }),
      onSaveConfiguration,
    })

    selectType("NONE")

    fireEvent.click(screen.getByText("Save"))

    fireEvent.click(await screen.findByText("Change type"))

    await waitFor(() => expect(onSaveConfiguration).toHaveBeenCalled())

    selectType("LOGIN_FORM")

    expect(await screen.findByLabelText("Login URL *")).toHaveValue(
      "https://target.example.com/oauth/token",
    )
  })

  it("clears the unsaved-changes flag once the save succeeds", async () => {
    const onDirtyChange = vi.fn()

    // Mirrors the real parent: useAuthentication stores what the backend

    // returned, so the tab re-renders on the saved configuration.

    function Harness() {
      const [current, setCurrent] = useState(config({ authType: "NONE" }))

      return (
        <AuthenticationTab
          config={current}
          onDirtyChange={onDirtyChange}
          onSaveConfiguration={async (payload) => {
            const saved = config({
              authType: payload.authType,
              credentialStatus: "NOT_CONFIGURED",
            })

            setCurrent(saved)

            return saved
          }}
          onSaveCredential={async () => current}
          onRemoveCredential={async () => current}
        />
      )
    }

    render(<Harness />)

    selectType("BEARER_TOKEN")

    expect(onDirtyChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(screen.getByText("Save"))

    fireEvent.click(await screen.findByText("Change type"))

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))

    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe(
      "BEARER_TOKEN",
    )
  })

  it("keeps the draft and reports the error when the save fails", async () => {
    const onSaveConfiguration = vi.fn(async () => {
      throw new ApiError(400, {
        errorCode: "VALIDATION_ERROR",

        message: "Authentication Type cannot be changed right now.",

        details: [],

        requestId: "req-1",
      })
    })

    render(
      <AuthenticationTab
        config={config({
          authType: "BEARER_TOKEN",
          credentialStatus: "CONFIGURED",
        })}
        onSaveConfiguration={onSaveConfiguration}
        onSaveCredential={async () => config()}
        onRemoveCredential={async () => config()}
      />,
    )

    selectType("NONE")

    fireEvent.click(screen.getByText("Save"))

    fireEvent.click(await screen.findByText("Change type"))

    expect(
      await screen.findByText(
        "Authentication Type cannot be changed right now.",
      ),
    ).toBeInTheDocument()

    // CL-3C-02: a failed save changes nothing — the stored credential is

    // still reported as Configured and the draft is still there to retry.

    expect(screen.getAllByText("Configured").length).toBeGreaterThan(0)

    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe(
      "NONE",
    )
  })
})

describe("AuthenticationTab — validation before the confirmation", () => {
  it("blocks an incomplete Login Form draft before any confirmation appears", () => {
    const { onSaveConfiguration } = renderTab({
      config: config({ authType: "NONE" }),
    })

    selectType("LOGIN_FORM")

    fireEvent.click(screen.getByText("Save"))

    expect(screen.getByText("Login URL is required.")).toBeInTheDocument()

    expect(
      screen.queryByText("Change authentication type"),
    ).not.toBeInTheDocument()

    expect(onSaveConfiguration).not.toHaveBeenCalled()
  })
})

describe("AuthenticationTab — read-only view (CL-3C-01)", () => {
  const readOnlyProps = {
    config: config({
      authType: "BEARER_TOKEN",
      credentialStatus: "CONFIGURED",
    }),

    readOnly: true,

    readOnlyReason:
      "Only an Admin can change the Authentication Type or credential for this API in this Environment.",
  }

  it("hides every mutation control but keeps the type and status visible", () => {
    renderTab(readOnlyProps)

    expect((screen.getByLabelText("Type") as HTMLSelectElement).disabled).toBe(
      true,
    )

    expect(screen.queryByText("Save")).not.toBeInTheDocument()

    expect(screen.queryByText("Cancel changes")).not.toBeInTheDocument()

    expect(screen.queryByText("Replace")).not.toBeInTheDocument()

    expect(screen.queryByText("Remove")).not.toBeInTheDocument()

    expect(screen.getAllByText("Configured").length).toBeGreaterThan(0)
  })

  it("states why the form is read-only", () => {
    renderTab(readOnlyProps)

    expect(screen.getByText(readOnlyProps.readOnlyReason)).toBeInTheDocument()
  })
})

describe("AuthenticationTab — safe metadata only (REQ-SEC-002)", () => {
  it("shows the Environment scope and last-updated time, never a secret field", () => {
    renderTab({
      config: config({
        authType: "LOGIN_FORM",

        credentialStatus: "CONFIGURED",

        loginUrl: "https://target.example.com/login",

        usernameField: "username",

        passwordField: "password",
      }),

      environmentName: "Staging",
    })

    expect(screen.getByText("Environment: Staging")).toBeInTheDocument()

    expect(screen.getByText(/^Last updated:/)).toBeInTheDocument()

    // Login Form's username/password now live on per-Environment Test

    // Accounts (a separate screen) — this tab never renders a secret field.

    // ("Password Field" is metadata about the field name, not a secret.)

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()

    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument()
  })

  it("asks for the type to be saved before its credential can be configured", () => {
    renderTab({ config: config({ authType: "NONE" }) })

    selectType("BEARER_TOKEN")

    expect(
      screen.getByText(
        "Save this Authentication Type before configuring its credential.",
      ),
    ).toBeInTheDocument()

    expect(screen.queryByLabelText("Token")).not.toBeInTheDocument()
  })

  // Regression: Login Form has non-secret config fields (unlike Bearer

  // Token), and those must be editable as soon as Login Form is selected —

  // otherwise validateLoginFormDraft can never be satisfied and the type can

  // never be saved as LOGIN_FORM in the first place.

  it("shows the Login Form config fields immediately once Manual mode is selected — Test Accounts (the actual credential) are managed on a separate screen, not gated here", () => {
    renderTab({ config: config({ authType: "NONE" }) })

    selectType("LOGIN_FORM")

    selectLoginMode("MANUAL")

    expect(screen.getByLabelText("Login URL")).toBeInTheDocument()

    expect(screen.getByLabelText("Username Field")).toBeInTheDocument()

    expect(screen.getByLabelText("Password Field")).toBeInTheDocument()

    expect(
      screen.queryByText(
        "Save this Authentication Type before configuring its credential.",
      ),
    ).not.toBeInTheDocument()

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()
  })

  it("lets a first-time Login Form selection be filled in and saved via Manual mode (regression for the Login URL required dead end)", async () => {
    const { onSaveConfiguration } = renderTab({
      config: config({ authType: "NONE" }),
    })

    selectType("LOGIN_FORM")

    selectLoginMode("MANUAL")

    fireEvent.change(screen.getByLabelText("Login URL"), {
      target: { value: "https://target.example.com/login" },
    })

    fireEvent.change(screen.getByLabelText("Username Field"), {
      target: { value: "username" },
    })

    fireEvent.change(screen.getByLabelText("Password Field"), {
      target: { value: "password" },
    })

    fireEvent.click(screen.getByText("Save"))

    fireEvent.click(await screen.findByText("Change type"))

    await waitFor(() =>
      expect(onSaveConfiguration).toHaveBeenCalledWith({
        authType: "LOGIN_FORM",

        loginMode: "MANUAL",

        loginUrl: "https://target.example.com/login",

        usernameField: "username",

        passwordField: "password",
      }),
    )
  })

  it("defaults a never-configured Login Form row to Import mode", () => {
    renderTab({ config: config({ authType: "NONE" }) })

    selectType("LOGIN_FORM")

    expect(
      (screen.getByLabelText("Login Form Mode") as HTMLSelectElement).value,
    ).toBe("IMPORTED")

    expect(
      screen.getByText("Paste a", { exact: false }),
    ).toBeInTheDocument()
  })

  it("keeps both drafts when toggling Login Form mode before Save", () => {
    renderTab({ config: config({ authType: "NONE" }) })

    selectType("LOGIN_FORM")

    selectLoginMode("MANUAL")

    fireEvent.change(screen.getByLabelText("Login URL"), {
      target: { value: "https://target.example.com/login" },
    })

    selectLoginMode("IMPORTED")

    expect(screen.getByText("Paste a", { exact: false })).toBeInTheDocument()

    selectLoginMode("MANUAL")

    expect(
      (screen.getByLabelText("Login URL") as HTMLInputElement).value,
    ).toBe("https://target.example.com/login")
  })

  it("enables Save and sends the new importUrl after editing the Login URL on an already-Imported config", async () => {
    const onSaveConfiguration = vi.fn(async (payload: any) =>
      config({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        credentialStatus: "NOT_REQUIRED",
        importMethod: payload.importMethod,
        importUrl: payload.importUrl,
        importHeaders: payload.importHeaders,
        importBodyFormat: payload.importBodyFormat,
        importBodyFields: payload.importBodyFields,
        importUsernameLocation: payload.importUsernameLocation,
        importPasswordLocation: payload.importPasswordLocation,
      }),
    )

    renderTab({
      config: config({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        credentialStatus: "NOT_REQUIRED",
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
      }),
      onSaveConfiguration,
    })

    const urlInput = screen.getByLabelText("Login URL *")

    fireEvent.change(urlInput, {
      target: { value: "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token" },
    })

    fireEvent.click(screen.getByText("Use this request"))

    await screen.findByText(/Request captured\. Click Save/)

    fireEvent.click(screen.getByText("Save"))

    await waitFor(() => expect(onSaveConfiguration).toHaveBeenCalled())

    expect(onSaveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        importUrl: "https://coshare-api-uat-ad.allianceitsc.com/oauth2/token",
      }),
    )
  })

  it("asks for a mode-change confirmation (not a credential-loss warning) when only loginMode changes", async () => {
    const { onSaveConfiguration } = renderTab({
      config: config({
        authType: "LOGIN_FORM",
        loginMode: "IMPORTED",
        credentialStatus: "CONFIGURED",
      }),
    })

    selectLoginMode("MANUAL")

    fireEvent.change(screen.getByLabelText("Login URL"), {
      target: { value: "https://target.example.com/login" },
    })

    fireEvent.change(screen.getByLabelText("Username Field"), {
      target: { value: "username" },
    })

    fireEvent.change(screen.getByLabelText("Password Field"), {
      target: { value: "password" },
    })

    fireEvent.click(screen.getByText("Save"))

    expect(
      await screen.findByText("Change Login Form mode"),
    ).toBeInTheDocument()

    expect(screen.queryByText(/credential saved for/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Change mode"))

    await waitFor(() =>
      expect(onSaveConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({ authType: "LOGIN_FORM", loginMode: "MANUAL" }),
      ),
    )
  })
})
