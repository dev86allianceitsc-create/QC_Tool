import { render, screen } from "@testing-library/react"

import { afterEach, describe, expect, it, vi } from "vitest"

import { mockJsonResponse } from "../../test/mock-fetch"

import { BatchRunPreparationScreen } from "./BatchRunPreparationScreen"

import { saveRunRequestValuesDraft } from "./runRequestValuesDraft.util"

const ENVIRONMENT = {
  environmentId: "e1",
  environmentName: "DEV",
  classification: "NON_PRODUCTION",
  allowRun: true,
  environmentStatus: "ACTIVE",
  baseUrl: null,
  createdAt: "t",
  updatedAt: "t",
}

const API = {
  apiId: "a1",
  projectId: "p1",
  apiName: "List",
  httpMethod: "POST",
  path: "/api/v1/ConfigAppScreen/List",
  description: null,
  creationSource: "MANUAL",
  createdAt: "t",
  updatedAt: "t",
}

const CONFIG = {
  environmentId: "e1",
  environmentName: "DEV",
  classification: "NON_PRODUCTION",
  environmentStatus: "ACTIVE",
  allowRun: true,
  urlStatus: "CONFIGURED",
  fullUrl: "https://coshare-api-dev.allianceitsc.com/api/v1/ConfigAppScreen/List",
  environmentBaseUrl: null,
  effectiveUrl: "https://coshare-api-dev.allianceitsc.com/api/v1/ConfigAppScreen/List",
  effectiveUrlSource: "FULL_URL",
  credentialStatus: "NOT_REQUIRED",
}

const DEFINITION = {
  apiId: "a1",
  httpMethod: "POST",
  path: "/api/v1/ConfigAppScreen/List",
  pathParameters: [],
  queryParameters: [],
  headerParameters: [
    { name: "accept", required: false },
    { name: "origin", required: false },
  ],
  requestBody: null,
}

const AUTH_CONFIG = {
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
  updatedAt: "t",
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/authentication")) {
      return Promise.resolve(mockJsonResponse(200, AUTH_CONFIG))
    }

    if (url.includes("/environments")) {
      return Promise.resolve(
        mockJsonResponse(200, {
          items: [ENVIRONMENT],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        }),
      )
    }

    if (url.includes("/request-input")) {
      return Promise.resolve(mockJsonResponse(200, DEFINITION))
    }

    if (url.includes("/environment-configs")) {
      return Promise.resolve(
        mockJsonResponse(200, { apiId: "a1", items: [CONFIG] }),
      )
    }

    if (url.includes("/apis/a1")) {
      return Promise.resolve(mockJsonResponse(200, API))
    }

    return Promise.resolve(mockJsonResponse(404, {}))
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function renderScreen() {
  render(
    <BatchRunPreparationScreen
      projectId="p1"
      projectStatus="ACTIVE"
      apiIds={["a1"]}
      environmentId="e1"
      accessToken="token-1"
      onBack={vi.fn()}
      onOpenConfiguration={vi.fn()}
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
      onExecuted={vi.fn()}
    />,
  )
}

// Regression: a user reported that the Header fields on this screen's
// Request Values panel (accept, accept-language, origin, ...) were always
// empty, while the same fields come pre-filled when running that API
// individually via Run API (RunApiArea.tsx seeds from
// runRequestValuesDraft.util.ts's localStorage draft on mount). Batch Run
// Preparation never read that draft at all — it only ever started every
// API's values from EMPTY_VALUES.
describe("BatchRunPreparationScreen — Request Values auto-fill from the Run API draft", () => {
  it("pre-fills a selected API's Header values from its saved Run API draft", async () => {
    saveRunRequestValuesDraft("a1", "e1", {
      pathValues: {},
      queryValues: {},
      headerValues: { accept: "application/json", origin: "https://app.example.com" },
      bodyValue: "",
    })

    stubFetch()

    renderScreen()

    expect(await screen.findByLabelText("accept")).toHaveValue(
      "application/json",
    )
    expect(screen.getByLabelText("origin")).toHaveValue(
      "https://app.example.com",
    )
  })

  it("leaves Header values blank when no draft was ever saved for that API+Environment", async () => {
    stubFetch()

    renderScreen()

    expect(await screen.findByLabelText("accept")).toHaveValue("")
    expect(screen.getByLabelText("origin")).toHaveValue("")
  })
})
