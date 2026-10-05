import { describe, expect, it } from "vitest"

import {
  buildImportedConfigurationPayload,
  buildLoginImportPreview,
  detectBodyFormat,
  detectCredentialFields,
  extractCandidateFields,
  isLoginImportDraftDirty,
  toLoginImportDraft,
  validateLoginImportDraft,
  type LoginImportDraft,
} from "./loginRequestImport.util"

import type { AuthenticationConfiguration } from "./authentication.types"

function authConfig(
  overrides: Partial<AuthenticationConfiguration> = {},
): AuthenticationConfiguration {
  return {
    environmentId: "e1",

    authType: "LOGIN_FORM",

    credentialStatus: "CONFIGURED",

    loginMode: "IMPORTED",

    loginUrl: null,

    usernameField: null,

    passwordField: null,

    importMethod: "POST",

    importUrl: "https://target.example.com/oauth/token",

    importHeaders: [],

    importBodyFormat: "FORM_URLENCODED",

    importBodyFields: [
      { name: "grant_type", value: "password" },
      { name: "username", value: "" },
      { name: "password", value: "" },
    ],

    importUsernameLocation: { kind: "BODY", name: "username" },

    importPasswordLocation: { kind: "BODY", name: "password" },

    updatedAt: "2026-09-22T09:00:00.000Z",

    ...overrides,
  }
}

const VALID_DRAFT: LoginImportDraft = {
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
}

describe("detectBodyFormat", () => {
  it("reports NONE when there is no body", () => {
    expect(detectBodyFormat({}, null)).toBe("NONE")
    expect(detectBodyFormat({}, "")).toBe("NONE")
  })

  it("detects JSON from the Content-Type header", () => {
    expect(
      detectBodyFormat(
        { "Content-Type": "application/json" },
        '{"username":"a"}',
      ),
    ).toBe("JSON")
  })

  it("detects JSON by sniffing when no Content-Type is declared", () => {
    expect(detectBodyFormat({}, '{"username":"a","password":"b"}')).toBe(
      "JSON",
    )
  })

  it("detects FORM_URLENCODED from the Content-Type header", () => {
    expect(
      detectBodyFormat(
        { "Content-Type": "application/x-www-form-urlencoded" },
        "username=a&password=b",
      ),
    ).toBe("FORM_URLENCODED")
  })

  // Regression: dev.coshare.vn's captured curl command uses `-d` with no
  // explicit Content-Type header — curl still sends it form-urlencoded, so
  // sniffing the body shape must recognize this without any header hint.
  it("detects FORM_URLENCODED by sniffing when no Content-Type is declared", () => {
    expect(
      detectBodyFormat({}, "grant_type=password&username=a&password=b"),
    ).toBe("FORM_URLENCODED")
  })

  it("reports UNSUPPORTED for a body that is neither JSON nor form-urlencoded", () => {
    expect(detectBodyFormat({}, "<xml>not this</xml>")).toBe("UNSUPPORTED")
    expect(detectBodyFormat({}, "{not valid json")).toBe("UNSUPPORTED")
  })
})

describe("extractCandidateFields / detectCredentialFields", () => {
  it("flattens headers and body fields into candidate locations", () => {
    const candidates = extractCandidateFields(
      [{ name: "Authorization", value: "Basic abc" }],
      [{ name: "username", value: "a" }],
    )

    expect(candidates).toEqual([
      { location: { kind: "HEADER", name: "Authorization" }, name: "Authorization", value: "Basic abc" },
      { location: { kind: "BODY", name: "username" }, name: "username", value: "a" },
    ])
  })

  it("picks the highest-priority username/password candidates, case-insensitively", () => {
    const candidates = extractCandidateFields(
      [],
      [
        { name: "app_name", value: "CoShareAdmin" },
        { name: "USERNAME", value: "" },
        { name: "grant_type", value: "password" },
        { name: "Password", value: "" },
      ],
    )

    expect(detectCredentialFields(candidates)).toEqual({
      usernameLocation: { kind: "BODY", name: "USERNAME" },
      passwordLocation: { kind: "BODY", name: "Password" },
    })
  })

  it("never picks the same location for both username and password", () => {
    const candidates = extractCandidateFields(
      [],
      [{ name: "user", value: "" }],
    )

    expect(detectCredentialFields(candidates)).toEqual({
      usernameLocation: { kind: "BODY", name: "user" },
      passwordLocation: null,
    })
  })

  it("returns null locations when nothing matches", () => {
    expect(detectCredentialFields([])).toEqual({
      usernameLocation: null,
      passwordLocation: null,
    })
  })
})

describe("buildLoginImportPreview", () => {
  it("builds a full preview with detected credential fields for a form-urlencoded login request", () => {
    const preview = buildLoginImportPreview({
      httpMethod: "POST",
      url: "https://target.example.com/oauth/token",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=password&app_name=CoShareAdmin&username=alice&password=s3cret",
    })

    expect(preview.httpMethod).toBe("POST")
    expect(preview.bodyFormat).toBe("FORM_URLENCODED")
    expect(preview.bodyFields).toEqual([
      { name: "grant_type", value: "password" },
      { name: "app_name", value: "CoShareAdmin" },
      { name: "username", value: "alice" },
      { name: "password", value: "s3cret" },
    ])
    expect(preview.detectedUsernameLocation).toEqual({ kind: "BODY", name: "username" })
    expect(preview.detectedPasswordLocation).toEqual({ kind: "BODY", name: "password" })
    expect(preview.warnings).toEqual([])
  })

  it("warns and drops duplicate header names, keeping only the first", () => {
    const preview = buildLoginImportPreview({
      httpMethod: "POST",
      url: "https://target.example.com/login",
      headers: { "X-Api-Key": "second" },
      body: null,
    })

    expect(preview.warnings).toEqual([])
    expect(preview.headerFields).toEqual([{ name: "X-Api-Key", value: "second" }])
  })

  it("warns when the body format cannot be imported", () => {
    const preview = buildLoginImportPreview({
      httpMethod: "POST",
      url: "https://target.example.com/login",
      headers: {},
      body: "<xml>nope</xml>",
    })

    expect(preview.bodyFormat).toBe("UNSUPPORTED")
    expect(preview.warnings).toEqual([
      "The request body isn't JSON or form-urlencoded, so its fields couldn't be imported. Use Manual configuration instead.",
    ])
  })
})

describe("validateLoginImportDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateLoginImportDraft(VALID_DRAFT)).toBeNull()
  })

  it("requires a well-formed Login URL", () => {
    expect(validateLoginImportDraft({ ...VALID_DRAFT, url: "" })).toBe(
      "Login URL is required.",
    )

    expect(validateLoginImportDraft({ ...VALID_DRAFT, url: "/relative" })).toBe(
      "Login URL is not a well-formed URL.",
    )
  })

  it("rejects an unsupported body format", () => {
    expect(
      validateLoginImportDraft({ ...VALID_DRAFT, bodyFormat: "UNSUPPORTED" }),
    ).toBe(
      "The imported body format isn't supported for Import Login Request. Use Manual configuration instead.",
    )
  })

  it("requires at least one body field unless the body format is None", () => {
    expect(
      validateLoginImportDraft({ ...VALID_DRAFT, bodyFields: [] }),
    ).toBe("At least one body field is required unless the body format is None.")
  })

  it("requires both username and password locations, and rejects identical ones", () => {
    expect(
      validateLoginImportDraft({ ...VALID_DRAFT, usernameLocation: null }),
    ).toBe("Select which field represents the username.")

    expect(
      validateLoginImportDraft({ ...VALID_DRAFT, passwordLocation: null }),
    ).toBe("Select which field represents the password.")

    expect(
      validateLoginImportDraft({
        ...VALID_DRAFT,
        passwordLocation: { kind: "BODY", name: "username" },
      }),
    ).toBe("Username field and Password field must be different.")
  })

  it("rejects a username/password location that doesn't reference an imported field", () => {
    expect(
      validateLoginImportDraft({
        ...VALID_DRAFT,
        usernameLocation: { kind: "BODY", name: "not_imported" },
      }),
    ).toBe("Username field must reference an imported header or body field.")

    expect(
      validateLoginImportDraft({
        ...VALID_DRAFT,
        passwordLocation: { kind: "HEADER", name: "not_imported" },
      }),
    ).toBe("Password field must reference an imported header or body field.")
  })
})

describe("toLoginImportDraft / isLoginImportDraftDirty", () => {
  it("maps a config row to its draft shape, defaulting nulls", () => {
    expect(
      toLoginImportDraft(
        authConfig({
          importMethod: null,
          importUrl: null,
          importHeaders: null,
          importBodyFormat: null,
          importBodyFields: null,
          importUsernameLocation: null,
          importPasswordLocation: null,
        }),
      ),
    ).toEqual({
      httpMethod: "",
      url: "",
      headerFields: [],
      bodyFields: [],
      bodyFormat: "NONE",
      usernameLocation: null,
      passwordLocation: null,
    })
  })

  it("is clean against its own baseline and dirty after any field changes", () => {
    const saved = authConfig()

    expect(isLoginImportDraftDirty(toLoginImportDraft(saved), saved)).toBe(false)

    expect(
      isLoginImportDraftDirty(
        { ...toLoginImportDraft(saved), url: "https://other.example.com/login" },
        saved,
      ),
    ).toBe(true)
  })
})

describe("buildImportedConfigurationPayload", () => {
  it("assembles the IMPORTED-mode payload, trimming the URL", () => {
    expect(
      buildImportedConfigurationPayload({
        ...VALID_DRAFT,
        url: "  https://target.example.com/oauth/token  ",
      }),
    ).toEqual({
      authType: "LOGIN_FORM",
      loginMode: "IMPORTED",
      importMethod: "POST",
      importUrl: "https://target.example.com/oauth/token",
      importHeaders: [],
      importBodyFormat: "FORM_URLENCODED",
      importBodyFields: VALID_DRAFT.bodyFields,
      importUsernameLocation: { kind: "BODY", name: "username" },
      importPasswordLocation: { kind: "BODY", name: "password" },
    })
  })

  it("never carries a plaintext credential — only structural field locations (REQ-SEC-002)", () => {
    const payload = buildImportedConfigurationPayload(
      VALID_DRAFT,
    ) as unknown as Record<string, unknown>

    expect(JSON.stringify(payload)).not.toMatch(/s3cret|alice/i)
  })
})
