# Group 3C — Authentication & Version — As-Built API Design

**Status: AS-BUILT / FOR REVIEW**
**Not APPROVED, not FROZEN.** This document describes the API as it is actually implemented in the repository today (controller + DTO + service code). It is produced for review against the approved Group 3C requirements and `API_Design_Standard_v2.0.docx`, and is not itself an approval or freeze of the contract. Unlike Group 3A (`AnD_API_API_Environment_Core_3A_FREEZE.docx`) and Group 3B (`AnD_API_Request_Input_3B_FINAL_FROZEN.docx`), **no approved AnD API contract document exists yet for Group 3C** — this is the first systematic capture of its API surface, reverse-engineered from code, not an existing frozen contract being restated.

- Scope: Group 3C — Authentication & Version (`REQ-SEC-002`, `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-AUTH-003`, `REQ-VER-001`)
- Sources read: `apps/api/src/modules/authentication/authentication.controller.ts`, `authentication.service.ts`, `authentication.module.ts`, `dto/put-authentication-configuration.dto.ts`, `dto/put-credential.dto.ts`, `authentication.service.spec.ts`; `apps/api/src/common/guards/{session,roles,project-access}.guard.ts`; `apps/api/src/common/exceptions/business.exception.ts`; `apps/api/src/common/filters/all-exceptions.filter.ts`; `apps/api/src/main.ts`; `apps/api/src/modules/api-environment/apis.service.ts` (`assertProjectActive`); `document/api/API_Design_Standard_v2.0.docx`; `document/requirement/03_API_Configuration/3C_Authentication_Version/*.docx`
- API IDs below (`API-AUTH-00x`) are assigned **by this document**, following the `API-<MODULE>-<NNN>` convention from `API_Design_Standard_v2.0.docx` §4, purely for internal traceability. They are not pre-existing frozen identifiers.
- No code, DTOs, or requirement documents were modified to produce this document.

---

## 1. Contract scope and boundary

Group 3C's implemented API surface is exactly **one resource, four operations**, all under a single controller (`AuthenticationController`), mounted at:

```
/api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication
```

(global prefix `api/v1` set in `main.ts` via `app.setGlobalPrefix("api/v1")`.)

- It **reads and mutates only** the `authentication_configurations` row for the given `(apiId, environmentId)` pair.
- It never touches the Full URL (`api_environment_configs`, Group 3A) or the Request Input Definition (`request_parameter_definitions`/`request_body_definitions`, Group 3B) — confirmed by `authentication.service.ts` having no import of, or write path into, either.
- It never exposes a decrypted Secret Credential Value (password or bearer token) — confirmed for every one of the four endpoints (§5).
- It has **no Run/execution endpoint** and **no Version endpoint** — see §12.
- `AuthenticationModule` (`authentication.module.ts`) only imports `AuditModule`; it does not import or depend on Request Input or Run modules, confirming Authentication Configuration is architecturally independent of them.

## 2. Common API Conventions actually implemented

| Concern | Implemented contract |
|---|---|
| Base path | `/api/v1` (global, `main.ts`) |
| Authentication | `Authorization: Bearer <opaque QC Tool session token>`, validated by `SessionGuard` (extracts via `extractBearerToken`, resolves via `SessionsService.resolveByToken`) |
| JSON naming | camelCase (`authType`, `loginUrl`, `usernameField`, …) |
| Datetime | `updatedAt` returned as a native `Date` (JSON-serialized ISO 8601 by Nest's default serializer); no other datetime field in this contract |
| Error envelope | Shared `AllExceptionsFilter` — `{ errorCode, message, details, requestId }` (§6) |
| Mass-assignment protection | Global `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })` (`main.ts`) — any body field not declared on the DTO is stripped/rejected, not silently accepted |
| Path parameter validation | `ParseUUIDPipe` on `projectId`, `apiId`, `environmentId` on every route — a malformed UUID never reaches the service, it is rejected by the pipe before the handler runs |
| Authorization order | `SessionGuard` (authentication) → `ProjectAccessGuard` **or** `RolesGuard` (authorization) → service-level business/lifecycle checks — matches `API_Design_Standard_v2.0.docx` §11's mandated flow |
| Swagger/OpenAPI | Live-generated via `@nestjs/swagger` `DocumentBuilder`/`SwaggerModule`, served at `/api/docs`, built directly from the same `@ApiOperation`/`@ApiResponse` decorators inspected in this document — not a hand-maintained separate spec |

## 3. API Registry

| API ID | Operation ID | Method | Endpoint | Purpose |
|---|---|---|---|---|
| API-AUTH-001 | `getAuthenticationConfiguration` | GET | `/api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication` | Read the current Authentication Configuration (type, status, safe metadata) for one API × Environment |
| API-AUTH-002 | `putAuthenticationConfiguration` | PUT | same base path | Set or replace the Authentication Type and its non-secret configuration; clears the previous type's credential when the type changes |
| API-AUTH-003 | `putAuthenticationCredential` | PUT | `.../authentication/credential` | Create or replace the Secret Credential Value (password or bearer token) for the currently configured Authentication Type |
| API-AUTH-004 | `removeAuthenticationCredential` | DELETE | `.../authentication/credential` | Remove the Secret Credential Value, reverting `credentialStatus` to `NOT_CONFIGURED`; idempotent |

No fifth endpoint exists. There is no `POST` (no separate "create" distinct from "replace" — `PUT` covers both via upsert), no list/search endpoint (the resource is a per-API×Environment singleton, not a collection), and no Version-related route at all (§12).

## 4. Endpoint-by-endpoint analysis

### API-AUTH-001 — `getAuthenticationConfiguration`

| Field | Value |
|---|---|
| Related Requirement | `REQ-SEC-002`, `REQ-AUTH-003` |
| Status | AS-BUILT (CONFIRMED behavior, not a frozen contract) |
| Actor | Any user with Project Access (ADMIN globally, or USER with current Project Membership) |
| Authentication | Required (`SessionGuard`, controller-level) |
| Authorization | `ProjectAccessGuard` — ADMIN bypasses membership check; USER must have a `project_memberships` row for `projectId` |
| Method + Endpoint | `GET /api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication` |
| Path parameters | `projectId`, `apiId`, `environmentId` — all UUID, all required, validated by `ParseUUIDPipe` |
| Query / Body | None |
| Business Processing | `findApiAndEnvironment` confirms the API (non-deleted, belongs to `projectId`) and the Environment (belongs to `projectId`) exist; then a single `findUnique` on `authentication_configurations` by `(apiId, environmentId)`; absent row is treated as `authType = "NONE"` (§5's `toResult`) rather than a 404 |
| DB Interaction | Read: `api_configurations`, `environments`, `authentication_configurations`. No write. |
| Success Response | 200, `AuthenticationConfigurationResult` (§5) |
| Error Cases | See consolidated Error Dictionary (§6) |
| Side Effects | None — read-only, no audit event written |
| Design Notes | **Does not check Project or Environment lifecycle status** (`assertProjectActive`/environment-ACTIVE checks are absent from `get()`) — reading the Authentication Configuration is allowed even when the Project or Environment is INACTIVE, consistent with the app-wide "reads stay available, only mutations freeze" pattern already used elsewhere (e.g. `InactiveBanner` view-only UX). This is an intentional asymmetry with the three mutating endpoints below, not an oversight — confirmed by its absence from every other 3C service method's shared validation path. |

### API-AUTH-002 — `putAuthenticationConfiguration`

| Field | Value |
|---|---|
| Related Requirement | `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-AUTH-003` BR-AUTH-003-01/09, `CL-3C-01`, `CL-3C-02` |
| Status | AS-BUILT |
| Actor | Admin only |
| Authentication | Required (`SessionGuard`) |
| Authorization | `RolesGuard` + `@Roles("ADMIN")` — requires `systemRole = ADMIN`; does **not** additionally run `ProjectAccessGuard` (see Design Notes) |
| Method + Endpoint | `PUT /api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication` |
| Path parameters | `projectId`, `apiId`, `environmentId` — UUID, required |
| Request Body | `PutAuthenticationConfigurationDto` — see Request Field Dictionary below |
| Business Processing | (1) `validateConfigDto(dto)` runs **before** the transaction opens — pure DTO-shape/business-rule checks with no DB access; (2) transaction: `assertProjectActive` (404 if Project missing/soft-deleted, 409 if not ACTIVE) → `findApiAndEnvironment` (404 if API/Environment missing) → reject 409 if Environment not ACTIVE → read existing row → compute `typeChanged` → `upsert` writing `authType` + LOGIN_FORM metadata (nulled for non-LOGIN_FORM types) → if `typeChanged`, additionally null all 6 secret columns in the same write → write audit event |
| DB Interaction | Read: `projects`, `api_configurations`, `environments`, `authentication_configurations`. Write: `authentication_configurations` (upsert), `audit_logs` (create) |
| Success Response | 200, `AuthenticationConfigurationResult` |
| Error Cases | See consolidated Error Dictionary (§6) |
| Side Effects | Audit event `AUTH_TYPE_CHANGED` (type differs from previous) or `AUTHENTICATION_CONFIGURATION_UPDATED` (type unchanged); may silently discard a previously configured credential (by design, `CL-3C-02`) |
| Design Notes | Validation-before-existence-check ordering means an Admin submitting an invalid LOGIN_FORM payload for a **nonexistent** API/Environment receives `400`/`422` (validation) rather than `404` — the DTO/business-rule layer is evaluated first, lifecycle/existence second. • Omitting `ProjectAccessGuard` from this route is not a gap in practice: `RolesGuard` already restricts the route to `systemRole = ADMIN`, and `ProjectAccessGuard` itself grants ADMIN unconditional access — so the two guards are functionally equivalent for this actor, and `assertProjectActive` still independently confirms the Project exists inside the service. |

**Request Field Dictionary — `PutAuthenticationConfigurationDto`:**

| Field | Location | Type | Required | Nullable | Source | Validation | Description |
|---|---|---|---|---|---|---|---|
| `authType` | Body | string enum | Y | N | Client | `@IsIn(["NONE","LOGIN_FORM","BEARER_TOKEN"])` | Target Authentication Type |
| `loginUrl` | Body | string | Y iff `authType=LOGIN_FORM` (service-enforced, not DTO-enforced) | N | Client | `@IsString @MaxLength(2048)`, trimmed; service additionally requires well-formed URL + `http:`/`https:` scheme | Login endpoint URL |
| `username` | Body | string | Y iff LOGIN_FORM | N | Client | `@IsString @MaxLength(255)`, trimmed | Login username |
| `usernameField` | Body | string | Y iff LOGIN_FORM | N | Client | `@IsString @MaxLength(100)`, trimmed; service requires ≠ `passwordField` | JSON property name for username in the login POST body |
| `passwordField` | Body | string | Y iff LOGIN_FORM | N | Client | `@IsString @MaxLength(100)`, trimmed; service requires ≠ `usernameField` | JSON property name for password in the login POST body |
| `tokenResponsePath` | Body | string | Y iff LOGIN_FORM | N | Client | `@IsString @MaxLength(200)`, trimmed; service requires match against `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$` | Dot-path into the login response JSON where the token is read |

All five LOGIN_FORM fields are `@IsOptional()` at the DTO/class-validator layer — the "required iff LOGIN_FORM" rule is enforced entirely in `validateConfigDto` (service layer), not expressible cleanly in class-validator per the DTO file's own comment.

### API-AUTH-003 — `putAuthenticationCredential`

| Field | Value |
|---|---|
| Related Requirement | `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-SEC-002` §14, `REQ-AUTH-003` BR-AUTH-003-08 |
| Status | AS-BUILT |
| Actor | Admin only |
| Authentication | Required (`SessionGuard`) |
| Authorization | `RolesGuard` + `@Roles("ADMIN")` (same composition/rationale as API-AUTH-002) |
| Method + Endpoint | `PUT /api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication/credential` |
| Path parameters | `projectId`, `apiId`, `environmentId` — UUID, required |
| Request Body | `PutCredentialDto` — see Request Field Dictionary below |
| Business Processing | Transaction: `assertProjectActive` → `findApiAndEnvironment` → reject 409 if Environment not ACTIVE → read existing row; if `authType = NONE` or no row exists, reject 409 `INVALID_STATE` ("no Authentication Type to attach a credential to"); branch on current `authType`: LOGIN_FORM requires `dto.password` (400 if absent) and encrypts it as-is; BEARER_TOKEN requires `dto.token` (400 if absent), strips a leading `Bearer ` prefix case-insensitively and trims, rejects 400 if empty after stripping, then encrypts the normalized value; `encryptSecret()` produces ciphertext/iv/authTag which is written to the matching column triple; audit event written |
| DB Interaction | Read: `projects`, `api_configurations`, `environments`, `authentication_configurations`. Write: `authentication_configurations` (update, one secret column triple only), `audit_logs` (create) |
| Success Response | 200, `AuthenticationConfigurationResult` (never echoes the submitted or stored secret) |
| Error Cases | See consolidated Error Dictionary (§6) |
| Side Effects | Audit event `CREDENTIAL_CONFIGURED` (first time) or `CREDENTIAL_REPLACED` (overwrite); overwrites the previous secret irreversibly (old ciphertext is not retained — no history/versioning) |
| Design Notes | Which of `password`/`token` is actually required is determined by the **stored** `authType`, not by any field the client sends in this call — the client cannot pick "treat this as a bearer token" independently of the Authentication Configuration already on record. • `409 INVALID_STATE` here is reused for two distinct conditions (Project/Environment not ACTIVE, and `authType = NONE`/no config yet) — same `errorCode`, different `message` text (§14 Deviations). |

**Request Field Dictionary — `PutCredentialDto`:**

| Field | Location | Type | Required | Nullable | Source | Validation | Description |
|---|---|---|---|---|---|---|---|
| `password` | Body | string | Y iff current `authType=LOGIN_FORM` (service-enforced) | N | Client | `@IsOptional @IsString @MaxLength(1024)` | Plaintext password, encrypted before storage, never logged/echoed |
| `token` | Body | string | Y iff current `authType=BEARER_TOKEN` (service-enforced) | N | Client | `@IsOptional @IsString @MaxLength(4096)`; service strips a leading `Bearer ` prefix and rejects empty-after-strip | Plaintext bearer token, encrypted before storage, never logged/echoed |

Both fields are optional at the DTO layer; the service picks exactly one based on the stored `authType` and rejects if the corresponding field is missing.

### API-AUTH-004 — `removeAuthenticationCredential`

| Field | Value |
|---|---|
| Related Requirement | `REQ-AUTH-003` BR-AUTH-003-08 |
| Status | AS-BUILT |
| Actor | Admin only |
| Authentication | Required (`SessionGuard`) |
| Authorization | `RolesGuard` + `@Roles("ADMIN")` |
| Method + Endpoint | `DELETE /api/v1/projects/{projectId}/apis/{apiId}/environment-configs/{environmentId}/authentication/credential` |
| Path parameters | `projectId`, `apiId`, `environmentId` — UUID, required |
| Request Body | None |
| Business Processing | Transaction: `assertProjectActive` → `findApiAndEnvironment` → reject 409 if Environment not ACTIVE → read existing row; **if no row or no secret present, return the current state as-is with no write and no audit event** (explicit idempotency); otherwise null all 6 secret columns (both LOGIN_FORM and BEARER_TOKEN pairs, regardless of which one was populated), write audit event |
| DB Interaction | Read: `projects`, `api_configurations`, `environments`, `authentication_configurations`. Write (conditional): `authentication_configurations` (update, only when a secret existed), `audit_logs` (create, only when a secret existed) |
| Success Response | 200, `AuthenticationConfigurationResult` — **not** 204, even though there is no meaningful body-less "deleted" state to report (the row and `authType` survive; only `credentialStatus` changes) |
| Error Cases | See consolidated Error Dictionary (§6) |
| Side Effects | Audit event `CREDENTIAL_REMOVED`, conditional (never written on the already-empty no-op path) |
| Design Notes | `authType` and the row itself are preserved — this is a "clear the secret" operation, not a row delete, despite the HTTP method being `DELETE`. This matches `API_Design_Standard_v2.0.docx` §6's guidance that `DELETE` should reflect true delete semantics only when that's the actual meaning — here it is a partial-clear, which is arguably a naming tension worth flagging (§14). |

## 5. Response Field Dictionary — `AuthenticationConfigurationResult`

Shared response shape returned by all four endpoints (200 on every success path):

| Field | Type | Nullable | Source | Description |
|---|---|---|---|---|
| `apiId` | string (UUID) | N | Path param, echoed | Identifies the API half of the isolation boundary |
| `environmentId` | string (UUID) | N | Path param, echoed | Identifies the Environment half of the isolation boundary |
| `authType` | string enum (`NONE`\|`LOGIN_FORM`\|`BEARER_TOKEN`) | N | DB (`"NONE"` when no row exists) | Current Authentication Type |
| `credentialStatus` | string enum (`NOT_REQUIRED`\|`CONFIGURED`\|`NOT_CONFIGURED`) | N | Derived — `NOT_REQUIRED` iff `authType=NONE`; else `CONFIGURED` iff a secret column pair is non-null, else `NOT_CONFIGURED` | Whether a usable Secret Credential Value currently exists — never the value itself |
| `loginUrl` | string | Y | DB | Present only when `authType=LOGIN_FORM`; `null` otherwise |
| `username` | string | Y | DB | Present only when `authType=LOGIN_FORM`; `null` otherwise |
| `usernameField` | string | Y | DB | Present only when `authType=LOGIN_FORM`; `null` otherwise |
| `passwordField` | string | Y | DB | Present only when `authType=LOGIN_FORM`; `null` otherwise |
| `tokenResponsePath` | string | Y | DB | Present only when `authType=LOGIN_FORM`; `null` otherwise |
| `updatedAt` | Date / ISO 8601 string | Y | DB (`null` when no row exists yet) | Last-modified timestamp of the row |

**No field for the Secret Credential Value exists in this shape, and no code path constructs one.** `password`, `token`, `passwordCiphertext`, `bearerTokenCiphertext`, and every IV/auth-tag column are absent from every response of every endpoint — confirmed directly from `toResult()`'s fixed field list, which is the single construction point used by all four handlers.

## 6. Error Dictionary (consolidated)

Every error response uses the shared envelope from `AllExceptionsFilter`:

```json
{ "errorCode": "VALIDATION_ERROR", "message": "...", "details": [], "requestId": "..." }
```

| HTTP | errorCode | Condition | Endpoint(s) | Source |
|---|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed UUID in a path parameter | all 4 | `ParseUUIDPipe` → generic status→errorCode map (no explicit `BusinessException`) |
| 400 | `VALIDATION_ERROR` | Body fails class-validator rules (e.g. `authType` not one of the enum, a string exceeds its `MaxLength`) | API-AUTH-002, 003 | global `ValidationPipe` |
| 400 | `VALIDATION_ERROR` | LOGIN_FORM-required field (`loginUrl`/`username`/`usernameField`/`passwordField`/`tokenResponsePath`) missing | API-AUTH-002 | `validateConfigDto` (explicit `BusinessException`) |
| 400 | `VALIDATION_ERROR` | `password` missing while current type is LOGIN_FORM, or `token` missing/empty-after-Bearer-strip while current type is BEARER_TOKEN | API-AUTH-003 | service |
| 401 | `SESSION_INVALID` | Missing/malformed Bearer credential, or session token not found | all 4 | `SessionGuard` |
| 401 | `SESSION_EXPIRED` | Session token found but expired | all 4 | `SessionGuard` |
| 401 | `SESSION_REVOKED` | Session token found but revoked | all 4 | `SessionGuard` |
| 403 | `ACCOUNT_NOT_ALLOWED` | Session valid but the owning account is not `ACTIVE` | all 4 | `SessionGuard` — **not documented in any route's `@ApiResponse` list** (§14) |
| 403 | `PROJECT_ACCESS_DENIED` | Caller is a `USER` with no current Project Membership | API-AUTH-001 only | `ProjectAccessGuard` (only route with this guard); also writes a `PROJECT_ACCESS_DENIED` audit row |
| 403 | `ROLE_NOT_ASSIGNED` | Caller has no `systemRole` assigned | API-AUTH-002, 003, 004 | `RolesGuard` |
| 403 | `ACCESS_DENIED` | Caller's `systemRole` is not `ADMIN` (or the user record can't be resolved) | API-AUTH-002, 003, 004 | `RolesGuard` — **not documented in any route's `@ApiResponse` list** (§14) |
| 403 | `INVALID_SYSTEM_ROLE` | Caller's `systemRole` fails the DB's own allowed-value check (defensive branch) | API-AUTH-002, 003, 004 | `RolesGuard` — **not documented** (§14) |
| 404 | `NOT_FOUND` | Project does not exist or is soft-deleted | API-AUTH-002, 003, 004 | `assertProjectActive` |
| 404 | `NOT_FOUND` | API does not exist (wrong id, or soft-deleted, or belongs to a different Project) | all 4 | `findApiAndEnvironment` |
| 404 | `NOT_FOUND` | Environment does not exist (wrong id, or belongs to a different Project) | all 4 | `findApiAndEnvironment` |
| 409 | `INVALID_STATE` | Project exists but is not `ACTIVE` | API-AUTH-002, 003, 004 | `assertProjectActive` |
| 409 | `INVALID_STATE` | Environment exists but is not `ACTIVE` | API-AUTH-002, 003, 004 | service |
| 409 | `INVALID_STATE` | `PUT credential` called while `authType=NONE` or no configuration row exists yet | API-AUTH-003 | service |
| 422 | `SEMANTIC_VALIDATION_ERROR` | `loginUrl` is a well-formed URL but not `http:`/`https:` scheme | API-AUTH-002 | `validateLoginUrl` |
| 422 | `SEMANTIC_VALIDATION_ERROR` | `usernameField === passwordField` | API-AUTH-002 | `validateConfigDto` |
| 422 | `SEMANTIC_VALIDATION_ERROR` | `tokenResponsePath` does not match the dot-path pattern | API-AUTH-002 | `validateConfigDto` |

## 7. Authentication & Authorization model

Per `API_Design_Standard_v2.0.docx` §11's mandated flow (Validate Authentication → Resolve Current User → Read authoritative state/role → Evaluate Authorization → Allow/Deny), every route in this controller is composed from independent, re-orderable guards:

| Guard | Applies to | What it checks | Backend-authoritative? |
|---|---|---|---|
| `SessionGuard` | All 4 routes (`@UseGuards(SessionGuard)` at controller level) | Bearer token resolves to a session that is not `NOT_FOUND`/`EXPIRED`/`REVOKED`, **and** the session's owning `user.accountStatus` is freshly re-read as `ACTIVE` on every request | Yes — session state and account status are both read fresh from the DB, never trusted from the token/client |
| `ProjectAccessGuard` | GET only | ADMIN bypasses; USER must have a current `project_memberships` row for the path's `projectId`, re-read fresh every request | Yes |
| `RolesGuard` | PUT config, PUT credential, DELETE credential (`@Roles("ADMIN")`) | `systemRole` is re-read fresh from the DB by `userId`; only `ADMIN` passes | Yes |

**Actor summary per operation:**

| Operation | ADMIN | USER (Project Member) | USER (no membership) |
|---|---|---|---|
| GET (API-AUTH-001) | Allowed | Allowed | 403 `PROJECT_ACCESS_DENIED` |
| PUT config (API-AUTH-002) | Allowed | 403 `ROLE_NOT_ASSIGNED`/`ACCESS_DENIED` | same |
| PUT credential (API-AUTH-003) | Allowed | same | same |
| DELETE credential (API-AUTH-004) | Allowed | same | same |

This is the code-level enforcement of `CL-3C-01` ("Only an Admin may change the Authentication Type, the Login metadata or the credential; Users see the same safe metadata and status read-only") — confirmed structurally (guard composition), not just behaviorally.

No route in this controller ever reads role, permission, or actor identity from the request body or a custom header — `actorUserId` for every audit write comes from `@CurrentUser()`, which resolves from `request.userId`, itself set only by `SessionGuard` after DB-backed session resolution. This satisfies `API_Design_Standard_v2.0.docx` §3 (API-STD-03, "Backend authoritative").

## 8. Validation layering (observed, mapped to API-STD §12)

| Layer (API-STD §12) | Where implemented | Example |
|---|---|---|
| Syntactic/Input | `ParseUUIDPipe` (path), class-validator DTO decorators (body) | Malformed `apiId`; `authType` not in the enum; a string over its `MaxLength` |
| Business | `validateConfigDto` (service, before the transaction), `putCredential`'s password/token branching | LOGIN_FORM missing `loginUrl`; `BEARER_TOKEN` credential call with an empty `token` |
| Semantic (`SEMANTIC_VALIDATION_ERROR`, 422) | `validateLoginUrl`, `usernameField ≠ passwordField` check, `tokenResponsePath` pattern check | `loginUrl` uses `ftp:` scheme; `tokenResponsePath = "1abc"` |
| Authorization | Guards (§7) | Non-Admin calling `PUT` |
| Conflict/Lifecycle/State | `assertProjectActive`, Environment-ACTIVE check, `authType=NONE` credential-attach check | Project INACTIVE; Environment INACTIVE; crediting a credential to `NONE` |

The DTO-shape/business layer for API-AUTH-002 runs **before** any existence/lifecycle check (§4 Design Notes) — this is an implementation ordering fact worth preserving for QA test design, not itself a standard violation (the standard defines the layers but does not mandate their execution order).

## 9. Idempotency & Retry (API-STD §17)

| Operation | HTTP semantics expected | Actual behavior |
|---|---|---|
| GET (API-AUTH-001) | Idempotent | Idempotent — pure read |
| PUT config (API-AUTH-002) | Idempotent (full replacement) | Idempotent — same DTO submitted twice produces the same stored row both times (the `typeChanged` branch is false on the second call, so no secret-clearing side effect recurs); the audit event type differs (`AUTHENTICATION_CONFIGURATION_UPDATED` vs `AUTH_TYPE_CHANGED`) only on the first call that actually changes the type, which is itself the expected one-time transition, not a violation of idempotency of the resulting *state* |
| PUT credential (API-AUTH-003) | Idempotent (full replacement) | Idempotent at the DB-state level (re-submitting the same secret re-encrypts and re-writes it, ending in an equivalent decrypted value), but **not idempotent for the audit trail** — a retried identical call is still recorded as `CREDENTIAL_REPLACED` a second time, and produces a fresh IV/ciphertext each time (by design, per `credential-crypto.ts`) |
| DELETE credential (API-AUTH-004) | Idempotent | Explicitly idempotent — verified directly in code: a second call with nothing to remove returns 200 with the unchanged state and performs no write, no audit event |

No idempotency key mechanism exists or is needed — every mutating operation here is a deterministic replace/clear keyed by the URL path, not a create-with-side-effect that risks duplication on retry (the API-STD §17 concern that applies to things like `create-run`).

## 10. Auditability (API-STD §19)

| Endpoint | Event type | Written when |
|---|---|---|
| API-AUTH-002 | `AUTH_TYPE_CHANGED` | `dto.authType` differs from the stored value |
| API-AUTH-002 | `AUTHENTICATION_CONFIGURATION_UPDATED` | `dto.authType` matches the stored value (metadata-only change) |
| API-AUTH-003 | `CREDENTIAL_CONFIGURED` | No secret existed before this call |
| API-AUTH-003 | `CREDENTIAL_REPLACED` | A secret already existed |
| API-AUTH-004 | `CREDENTIAL_REMOVED` | A secret existed and was cleared |
| API-AUTH-001 | — | Never audited (read-only) |
| API-AUTH-001 (denial path) | `PROJECT_ACCESS_DENIED` | Written by `ProjectAccessGuard`, not the service, when a non-Admin without membership is denied |

Every audit entry's `beforeData`/`afterData` for this module is restricted to `{ authType, credentialConfigured: boolean }` — confirmed both by direct code inspection of all three mutating service methods and by `authentication.service.spec.ts` assertions that the submitted plaintext and stored ciphertext never appear in the audit payload (`JSON.stringify(auditCall)` checks). `actorUserId` always comes from the DB-resolved session identity (§7), never from client input, satisfying API-STD §19's "Actor phải lấy từ Backend authentication context".

## 11. Version metadata API status

**No API endpoint exists for API Version or Database Version (`REQ-VER-001`).** Checked directly:

- `AuthenticationController` has exactly the four routes in §3 — no fifth route for Version.
- No other controller in `apps/api/src/modules` exposes a Version-related route (no `version.controller.ts`, no route path containing `version`).
- No DTO for a Version payload exists anywhere in the API layer.

This is the API-layer counterpart of the database finding already documented in `Group_3C_AsBuilt_Database_Design.md` §10: since there is no `authentication_configurations`-adjacent or Run-adjacent table to persist a Version value into, there is correspondingly no backend endpoint to accept one. Version metadata is captured and displayed entirely in the frontend Run API area (`RunVersionMetadataPanel.tsx`, `version.util.ts`) and never crosses the network to this API layer — confirmed by the existing frontend test `RunApiArea.test.tsx`'s "never calls fetch during any interaction across any step" assertion, which exercises the Version Metadata step specifically.

## 12. Mapping to Group 3C requirements

| Requirement | Implemented API element | Status |
|---|---|---|
| `REQ-SEC-002` §5 — credential scope = API + Environment | Every route is scoped by `(apiId, environmentId)` path params; no cross-API/Environment read or write path exists | Implemented |
| `REQ-SEC-002` §14 — Secret Credential Value never returned in plaintext by any endpoint | `AuthenticationConfigurationResult` (§5) has no secret field, confirmed across all 4 endpoints | Implemented |
| `REQ-AUTH-001` — Fixed Login Form fields, server-side validated | API-AUTH-002's `validateConfigDto`/`validateLoginUrl` (§4, §8) | Implemented |
| `REQ-AUTH-002` — Bearer Token direct entry, no login call | API-AUTH-003's BEARER_TOKEN branch (strip `Bearer ` prefix, encrypt, store) | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-01 — at most one active config per API×Environment | Enforced structurally by `upsert` keyed on the composite unique `(apiId, environmentId)` — no create-a-second-row path exists | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-08 — Remove reverts to Not configured, keeps the record | API-AUTH-004 nulls secret columns only, row/`authType` survive | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-09 / `CL-3C-02` — type change discards old credential in the same mutation | API-AUTH-002's `typeChanged` branch, same transaction as the type write | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-11 — no mutation while Project/Environment inactive | `assertProjectActive` + Environment-ACTIVE check on API-AUTH-002/003/004 (not API-AUTH-001, by design — §4) | Implemented |
| `CL-3C-01` — Admin-only mutation, User view-only | `RolesGuard`+`@Roles("ADMIN")` on API-AUTH-002/003/004 vs. `ProjectAccessGuard` (any member) on API-AUTH-001 | Implemented |
| `REQ-AUTH-003` §14 — audit records only safe metadata, never secret bytes | §10 | Implemented |
| `REQ-VER-001` (any API surface) | None | **Not implemented — no endpoint exists (§11)** |

## 13. Deviations from API Design Standard v2.0

| Standard section | Rule | Observation |
|---|---|---|
| §4 Naming | Resource path lowercase plural noun; path param camelCase named for its entity | `authentication` (singular, not plural) is used as the final path segment, naming the sub-resource itself rather than a collection — this is defensible as a singleton sub-resource (there is exactly one Authentication Configuration per API×Environment, never a collection to enumerate), which the standard doesn't explicitly address for singleton resources, but it is a literal deviation from "plural noun" as written. `credential` (also singular) under it has the same characteristic and the same justification. Path params (`projectId`, `apiId`, `environmentId`) are camelCase and entity-named — compliant. |
| §6 HTTP Method Standard — "DELETE chỉ dùng khi semantics thực sự là delete" | — | API-AUTH-004 is `DELETE` but does not delete the `authentication_configurations` row — it clears 6 columns and leaves the row (and `authType`) intact (§4 Design Notes). This is the clearest deviation found: the standard explicitly warns against using `DELETE` for what is semantically a partial clear/reset rather than a true delete. A `PATCH .../credential` with an explicit "clear" semantic, or a differently-named action, would align more literally with §6 — though `DELETE` is arguably still the most intuitive verb from a client's perspective for "remove the credential", and the response body/status already makes the surviving-row behavior visible to any caller who reads the contract. |
| §15 Error Response & Error Dictionary — "Không dùng message text làm machine contract"; one errorCode should map to one clear condition | — | `409 INVALID_STATE` is reused for three distinct conditions across API-AUTH-002/003/004 (Project inactive, Environment inactive, and — API-AUTH-003 only — "no Authentication Type/config to attach a credential to"). All three are legitimately state conflicts, so this isn't a misuse of the `errorCode` per se, but a client cannot distinguish the three cases without parsing `message` text, which §15 explicitly says not to rely on. A more granular `errorCode` (e.g. `CREDENTIAL_NOT_APPLICABLE` for the third case) would better match the standard's own "one errorCode, one condition" spirit. |
| §22 OpenAPI/Swagger Contract Standard — "Request/response requiredness... phải phản ánh API AnD đã freeze" | — | The Swagger `@ApiResponse` annotations on every mutating route list only `ROLE_NOT_ASSIGNED` for 403, omitting the `ACCESS_DENIED` and `INVALID_SYSTEM_ROLE` codes `RolesGuard` can also throw; similarly every route's 401 list omits `ACCOUNT_NOT_ALLOWED` (which `SessionGuard` throws as 403, not 401 — also worth noting the annotation groups it under 401 conceptually but the guard actually returns 403). Since Group 3C has no frozen AnD API contract to compare Swagger against, this can't be called a Swagger/AnD *inconsistency* yet — but it is an incompleteness in the generated OpenAPI contract relative to actual guard behavior, worth fixing before any future freeze. |
| §17 Idempotency | PUT/DELETE must be idempotent | State-level idempotency holds for all three mutating routes (§9); audit-trail "idempotency" does not (a retried identical `PUT credential` writes a second `CREDENTIAL_REPLACED` event) — the standard doesn't address audit-log idempotency directly, so this is a minor observation, not a clear violation. |
| §16 HTTP Status Code Standard | — | All observed status codes (200/400/401/403/404/409/422) match the standard's defined meanings for their conditions. No deviation found here. |
| §9 Request Body & Field Semantics — mass assignment protection | — | Global `whitelist: true, forbidNonWhitelisted: true` ValidationPipe enforces this project-wide; both 3C DTOs declare an explicit closed field list — compliant, no deviation. |

No deviation was found in URL versioning, datetime handling (only one datetime field exists and it needs no special formatting logic beyond Nest's default), pagination (not applicable — this resource is never listed), or CORS/security header handling.

## 14. Unapproved design decisions or open questions

1. **`DELETE .../credential` is semantically a "clear secret", not a resource delete** (§13) — an open naming/contract-shape question, not a functional defect. Whether to keep `DELETE` for developer-intuitiveness or rename per strict REST-delete semantics is undecided by any requirement or design document reviewed.
2. **`409 INVALID_STATE` conflates three distinct conflict conditions** (§13) — whether to split it into more granular `errorCode`s is undecided; no requirement or AnD document specifies the required granularity.
3. **Swagger/OpenAPI `@ApiResponse` coverage is incomplete relative to actual guard behavior** (§13) — `ACCESS_DENIED`, `INVALID_SYSTEM_ROLE`, and `ACCOUNT_NOT_ALLOWED` are real, reachable responses that aren't documented on any route. Not itself a functional bug, but a gap that would surface as a Swagger/behavior mismatch once this contract is reviewed for freeze.
4. **No response-shape difference between "row never existed" and "row exists with `authType=NONE`"** — both produce an identical `AuthenticationConfigurationResult` (`authType: "NONE"`, `updatedAt: null` only in the never-existed case). Whether a client ever needs to distinguish these two states is not addressed by any requirement document read.
5. **`REQ-AUTH-003` ODC-05 (Login URL / SSRF policy) has no API-layer control** — `validateLoginUrl` performs syntax/scheme validation only (§4, matching the DB doc's finding that this was a deliberate, documented scope decision, not an oversight).
6. **No rate limiting or brute-force protection is visible on `PUT credential`** — an Admin (or a compromised Admin session) can attempt an unlimited number of credential writes with no throttling observed in the guard chain. Not flagged as required by any Group 3C requirement document, but worth surfacing as an open question given the sensitivity of the endpoint.
7. **All items already flagged as open in the As-Built Database Design document** (`Group_3C_AsBuilt_Database_Design.md` §13) — key rotation, concurrent-replace consistency, and the entirety of Version persistence — apply identically at the API layer, since the API surface has no mechanism of its own to address any of them independently of the database.

---

*End of document. Status: AS-BUILT / FOR REVIEW.*
