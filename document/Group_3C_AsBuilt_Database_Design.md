# Group 3C — Authentication & Version — As-Built Database Design

**Status: AS-BUILT / FOR REVIEW**
**Not APPROVED.** This document describes the database as it exists in the repository today (schema + migration + service code). It is produced for review against the approved Group 3C requirements and `Database_Standard_v2.0.docx`, and is not itself an approval of the design.

- Scope: Group 3C — Authentication & Version (`REQ-SEC-002`, `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-AUTH-003`, `REQ-VER-001`)
- Sources read: `prisma/schema.prisma`; `prisma/migrations/20260921120000_add_authentication_3c/migration.sql`; `apps/api/src/modules/authentication/*`; `apps/api/src/common/utils/credential-crypto.ts` (+ spec); `document/requirement/03_API_Configuration/3C_Authentication_Version/REQ-SEC-002.docx`, `REQ-AUTH-001.docx`, `REQ-AUTH-002.docx`, `REQ-AUTH-003.docx`, `REQ-VER-001.docx`; `document/database/Database_Standard_v2.0.docx`; `document/api/AnD_API_User_Authentication.docx`; `document/ui/AnD_UI_Authentication_Version_3C.docx`, `UI_Requirement_Mapping_Authentication_Version_3C.docx`
- No code, migrations, or approved requirement documents were modified to produce this document.

---

## 1. Database scope and affected entities

Group 3C's implemented database footprint is a single new table:

- `authentication_configurations`

It has foreign keys into two Group 3A tables, which are unmodified by Group 3C:

- `api_configurations` (via `api_id`)
- `environments` (via `environment_id`)

No other table is touched. In particular:

- **`api_environment_configs`** (Full URL, Group 3A) is unmodified. Authentication is a separate row keyed the same way (`api_id` + `environment_id`), not a column added to this table.
- **`request_parameter_definitions`** / **`request_body_definitions`** (Group 3B) are unmodified — Group 3C's own service code never reads or writes them, matching `BR-AUTH-001-05` ("never store Username/Password inside the Request Input Definition or a 3B Run Value").
- **`audit_logs`** (Phase C) is unmodified in schema; Group 3C *writes to* it (see §8) but adds no new column or table for audit.
- **No table exists for API Version / Database Version** (`REQ-VER-001`). See §10 — Version metadata has no backing table, column, or migration anywhere in the schema.
- **No table exists for Run, Run Result, Snapshot, or Comparison.** This matches the migration's own header comment and Task B's explicit exclusion of Run execution/Snapshot/Comparison/Run History from this phase.

## 2. New tables introduced by Group 3C

### 2.1 `authentication_configurations`

One row per (API, Environment) pair that has ever had an Authentication Configuration saved. Absence of a row means `auth_type = NONE` implicitly — the same "no row = default state" convention already used by `api_environment_configs` (Group 3A).

**Table Dictionary** (per Database Standard §23 Data Dictionary Template):

| Field | Value |
|---|---|
| Table Name | `authentication_configurations` |
| Entity Purpose | The Authentication Configuration (type + non-secret login/token metadata + encrypted secret) for one API in one Environment |
| Owner Module | `authentication` (`apps/api/src/modules/authentication`) |
| Table Type | Entity (configuration row), not catalog/snapshot/audit |
| Lifecycle | Created on first `PUT` of the configuration or credential for an API×Environment pair; updated in place thereafter (upsert). No delete path exists in the service layer — Remove Credential clears the secret columns but keeps the row (`BR-AUTH-003-08`) |
| Retention | No retention/purge policy implemented or specified; row persists indefinitely alongside its API/Environment |
| Sensitivity | **Secret** — six columns (`password_ciphertext/iv/auth_tag`, `bearer_token_ciphertext/iv/auth_tag`) hold encrypted Secret Credential Value bytes; `username`, `login_url` are safe metadata but still sensitive-adjacent (see §7) |
| Expected Volume | Bounded by (number of APIs) × (number of Environments per Project) — same order of magnitude as `api_environment_configs` |
| Main Access Pattern | Point lookup by composite PK `(api_id, environment_id)`; list-by-environment via the `environment_id` index |
| Requirement Basis | `REQ-SEC-002` (CONFIRMED), `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-AUTH-003` (REVISED DRAFT per the migration's own header comment) |

## 3. Existing tables modified by Group 3C

None. Group 3C adds no column to any pre-existing table. `api_configurations` and `environments` each gain a new *relation* (`authConfigs`) in the Prisma schema, but this is an ORM-level back-reference only — it does not change either table's physical column set.

## 4. Field dictionary

### 4.1 `authentication_configurations`

| Column | Data type | Nullable | Default | PK/FK | Unique | Description | Related requirement |
|---|---|---|---|---|---|---|---|
| `api_id` | UUID | No | — | PK (composite, 1/2) · FK → `api_configurations.api_id` | — | Identifies the API half of the credential-isolation boundary | `REQ-SEC-002` §5 |
| `environment_id` | UUID | No | — | PK (composite, 2/2) · FK → `environments.environment_id` | — | Identifies the Environment half of the credential-isolation boundary | `REQ-SEC-002` §5 |
| `auth_type` | VARCHAR(20) | No | — (Initial Business Value `"NONE"` set by the service when creating a row, not a SQL `DEFAULT`) | — | — | One of `NONE`, `LOGIN_FORM`, `BEARER_TOKEN`. Enforced by raw `CHECK ck_authentication_configurations_auth_type` (Prisma cannot express this declaratively) | `REQ-AUTH-003` BR-AUTH-003-01 |
| `login_url` | VARCHAR(2048) | Yes | NULL | — | — | Login endpoint URL. Populated only when `auth_type = LOGIN_FORM`; forced to `NULL` for `NONE`/`BEARER_TOKEN` by the service | `REQ-AUTH-001` (Fixed Login Contract) |
| `username` | VARCHAR(255) | Yes | NULL | — | — | Login username. Same LOGIN_FORM-only population rule as `login_url` | `REQ-AUTH-001` |
| `username_field` | VARCHAR(100) | Yes | NULL | — | — | Root-level JSON property name the username is sent under in the login POST body | `REQ-AUTH-001` (Mapping) |
| `password_field` | VARCHAR(100) | Yes | NULL | — | — | Root-level JSON property name the password is sent under; service enforces it differs from `username_field` (422 if equal) | `REQ-AUTH-001` (Mapping) |
| `token_response_path` | VARCHAR(200) | Yes | NULL | — | — | Dot-separated path into the login response JSON where the token is read (e.g. `access_token`, `data.access_token`); validated server-side against `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$` | `REQ-AUTH-001` |
| `password_ciphertext` | BYTEA | Yes | NULL | — | — | AES-256-GCM ciphertext of the LOGIN_FORM password. Populated only when `auth_type = LOGIN_FORM` and a password has been saved | `REQ-SEC-002` §14; `REQ-AUTH-001` |
| `password_iv` | BYTEA | Yes | NULL | — | — | AES-256-GCM initialization vector (12 bytes) paired with `password_ciphertext` | credential-crypto.ts |
| `password_auth_tag` | BYTEA | Yes | NULL | — | — | AES-256-GCM authentication tag paired with `password_ciphertext`, used to detect tampering on decrypt | credential-crypto.ts |
| `bearer_token_ciphertext` | BYTEA | Yes | NULL | — | — | AES-256-GCM ciphertext of the BEARER_TOKEN secret. Populated only when `auth_type = BEARER_TOKEN` and a token has been saved | `REQ-SEC-002` §14; `REQ-AUTH-002` |
| `bearer_token_iv` | BYTEA | Yes | NULL | — | — | IV paired with `bearer_token_ciphertext` | credential-crypto.ts |
| `bearer_token_auth_tag` | BYTEA | Yes | NULL | — | — | Auth tag paired with `bearer_token_ciphertext` | credential-crypto.ts |
| `created_at` | TIMESTAMPTZ | No | `CURRENT_TIMESTAMP` | — | — | Row creation time | Database Standard §18 |
| `updated_at` | TIMESTAMPTZ | No | — (Prisma `@updatedAt`, application-set on every write) | — | — | Last-modified time | Database Standard §18 |
| `note` | TEXT | Yes | NULL | — | — | Free-text operator note. Present but unused by any read/write path found in the service or DTOs | consistent with `note` on every other Group 3A/3B/3C table |

**Constraints beyond the column-level table above:**

| Constraint | Type | Definition | Requirement basis |
|---|---|---|---|
| `pk_authentication_configurations` | PRIMARY KEY | `(api_id, environment_id)` | `REQ-SEC-002` §5 — credential scope is exactly API × Environment |
| `authentication_configurations_api_id_fkey` | FOREIGN KEY | `api_id → api_configurations(api_id)`, `ON DELETE RESTRICT ON UPDATE CASCADE` | consistent with 3A/3B FK convention |
| `authentication_configurations_environment_id_fkey` | FOREIGN KEY | `environment_id → environments(environment_id)`, `ON DELETE RESTRICT ON UPDATE CASCADE` | consistent with 3A/3B FK convention |
| `ck_authentication_configurations_auth_type` | CHECK | `auth_type IN ('NONE','LOGIN_FORM','BEARER_TOKEN')` | `REQ-AUTH-003` BR-AUTH-003-01 |
| `ck_authentication_configurations_secret_exclusive` | CHECK | `NOT (password_ciphertext IS NOT NULL AND bearer_token_ciphertext IS NOT NULL)` — the two secret pairs can never both be populated at once | `REQ-AUTH-003` CL-3C-02 |

No column-level `UNIQUE` constraint exists on this table beyond the composite primary key.

## 5. Relationships and cardinality

```
api_configurations (1) ──── (0..N) authentication_configurations (N..0) ──── (1) environments
```

- **`api_configurations` 1 — N `authentication_configurations`**: one API can have at most one Authentication Configuration row per Environment, and any number of Environments, so an API can have many rows total (one per Environment it has been configured in).
- **`environments` 1 — N `authentication_configurations`**: symmetric — one Environment can back Authentication Configuration rows for many APIs.
- **Effective cardinality per (API, Environment) pair is 0..1**, enforced by the composite primary key `(api_id, environment_id)`. This directly implements `BR-AUTH-003-01` ("at most one active Authentication Configuration per API × Environment at any time").
- Both FKs are `ON DELETE RESTRICT`: deleting an `api_configurations` or `environments` row while an `authentication_configurations` row references it is blocked at the database level. This is consistent with `api_configurations`/`environments` using soft-delete/lifecycle status rather than hard delete (Group 3A), so in practice this RESTRICT is not expected to be exercised as a hard blocker — it is a safety net, not an active lifecycle path.
- There is no relationship from `authentication_configurations` to any Run/Result table, because none exists yet (§10, §1).

## 6. Indexes and database constraints

| Name | Kind | Columns | Purpose |
|---|---|---|---|
| `pk_authentication_configurations` | Unique index (via PK) | `(api_id, environment_id)` | Primary lookup path — "get the Authentication Configuration for this API × Environment", used by every service method (`get`, `putConfiguration`, `putCredential`, `removeCredential`) |
| `idx_authentication_configurations_environment_id` | B-tree index | `(environment_id)` | Supports queries scoped by Environment alone; PK already covers `api_id`-only prefix lookups (leading column of composite PK) so no separate `api_id` index was added |
| `ck_authentication_configurations_auth_type` | CHECK | `auth_type` | Domain enforcement for the type field (Database Standard §12 — VARCHAR + CHECK preferred over native ENUM) |
| `ck_authentication_configurations_secret_exclusive` | CHECK | `password_ciphertext`, `bearer_token_ciphertext` | Enforces mutual exclusivity of the two secret pairs at the DB level, not just in application code |

No other index is defined on this table (no index on `auth_type`, `created_at`, or `updated_at` — consistent with Database Standard §21's "not every column indexed" guidance and no observed query pattern that would need one).

## 7. Authentication credential storage and encryption

**What is stored:**

- The **non-secret** LOGIN_FORM fields (`login_url`, `username`, `username_field`, `password_field`, `token_response_path`) are stored as **plaintext** VARCHAR columns. Per `REQ-SEC-002`'s own terminology (cited in the migration header comment), these are classified as *Credential Metadata*, not *Secret Credential Value*, and the requirement explicitly allows Admin and User-with-Project-Access to read them.
- The **secret** values — the LOGIN_FORM password and the BEARER_TOKEN token — are never stored as plaintext. Each is stored as three separate `BYTEA` columns: ciphertext, IV, and GCM auth tag.

**Encryption implementation** (`apps/api/src/common/utils/credential-crypto.ts`):

- Algorithm: **AES-256-GCM** (`node:crypto`, `createCipheriv`/`createDecipheriv`).
- Key: a single application-level key read from the `CREDENTIAL_ENCRYPTION_KEY` environment variable at call time (not injected via `ConfigService`, matching this codebase's existing convention for `sessions.service.ts`'s `SESSION_TTL_HOURS`). The key must be a base64-encoded 32-byte value; `encryptSecret`/`decryptSecret` throw if it is missing or the wrong length. **The key itself is never stored in the database.**
- IV: a fresh random 12-byte IV (`randomBytes(12)`) is generated on every `encryptSecret` call, so the same plaintext never produces the same ciphertext twice (verified by `credential-crypto.spec.ts`).
- Auth tag: GCM's built-in authentication tag is captured and stored alongside the ciphertext; `decryptSecret` calls `setAuthTag` before decrypting, so a tampered ciphertext or tag throws rather than silently returning corrupted plaintext (also verified by spec).
- **No key rotation mechanism exists.** There is exactly one key, read once per call, with no versioning column (e.g. no `key_version`) on `authentication_configurations`. If the key were ever rotated, every existing ciphertext would become undecryptable — this is an open gap, not a designed rotation path.

**Exposure surface (what the API returns):**

`AuthenticationService.toResult()` (`authentication.service.ts`) builds every response from a fixed field list that includes `authType`, `credentialStatus`, and the non-secret metadata — it **never includes** `passwordCiphertext`/`bearerTokenCiphertext` or any decrypted value. `credentialStatus` is derived, not stored: `NOT_REQUIRED` when `auth_type = NONE`, otherwise `CONFIGURED` if either ciphertext column is non-null, else `NOT_CONFIGURED`. No endpoint or DTO in this module ever calls `decryptSecret` — decryption capability exists in `credential-crypto.ts` but currently has no caller in the codebase (consistent with Run execution, which would be the actual consumer of a decrypted credential, being out of scope for this phase).

**Audit-time redaction:** `AuthenticationService` audit calls only ever pass `{ authType, credentialConfigured: boolean }` as `beforeData`/`afterData` (never the ciphertext, DTO password, or token) — verified directly by `authentication.service.spec.ts` (`expect(JSON.stringify(auditCall)).not.toMatch(/[Cc]iphertext/)` and an equivalent assertion that a submitted plaintext password never appears in the audit payload). `AuditWriterService.record()` additionally runs every `beforeData`/`afterData` value through a `sanitizeForAudit()` step before persisting to `audit_logs.before_data`/`after_data` (JSONB).

## 8. Credential lifecycle: Create, Replace, Remove, Change Authentication Type

All four operations are implemented in `AuthenticationService` (`apps/api/src/modules/authentication/authentication.service.ts`), each wrapped in a `prisma.$transaction`, gated first by `assertProjectActive(tx, projectId)` and then by `environment.environmentStatus === "ACTIVE"` (both throw `409 INVALID_STATE` otherwise). Only `ADMIN` role can reach the mutating endpoints (`RolesGuard` + `@Roles("ADMIN")` on the controller); `GET` is reachable by any user with `ProjectAccessGuard`-granted project access.

| Operation | Endpoint | Service method | DB effect |
|---|---|---|---|
| **Set/replace Authentication Type + metadata** | `PUT .../authentication` | `putConfiguration` | `upsert` on `authentication_configurations` keyed by `(apiId, environmentId)`. Sets `auth_type` and the LOGIN_FORM metadata columns (nulled out for NONE/BEARER_TOKEN). Server-side validation (`validateConfigDto`) enforces all `REQ-AUTH-001` LOGIN_FORM field requirements (URL well-formed + http/https, all 5 fields present, `usernameField ≠ passwordField`, `tokenResponsePath` pattern) before the transaction opens |
| **Create credential** (first time) | `PUT .../authentication/credential` | `putCredential` | `update` sets the ciphertext/iv/authTag triple for whichever secret type is currently configured; rejects `409 INVALID_STATE` if `auth_type = NONE` or no row exists yet |
| **Replace credential** | same endpoint | same method | Same `update` path — overwrites the existing ciphertext/iv/authTag in place. The DTO does not require or accept the old secret (`BR-AUTH-003-08`: "Replace doesn't require reading old secret") |
| **Remove credential** | `DELETE .../authentication/credential` | `removeCredential` | If a secret is present, `update` nulls all six secret columns but **leaves the row and `auth_type` untouched** (`BR-AUTH-003-08`: reverts to Not configured but keeps the record). If no secret is present, the call is a no-op — no `update`, no audit write (explicit idempotency) |
| **Change Authentication Type** | `PUT .../authentication` with a different `authType` | `putConfiguration` (`typeChanged` branch) | Same `upsert` as "Set/replace", but when `dto.authType !== existing.authType`, the transaction additionally nulls **all six** secret columns (both LOGIN_FORM and BEARER_TOKEN pairs) in the same write — implementing `CL-3C-02` ("the old type's credential must be safely discarded... in the same mutation") at the database-transaction level, not as a separate follow-up call |

**Audit events written** (via `AuditWriterService.record`, same transaction, table `audit_logs`, unchanged schema):

| Event type | Written when |
|---|---|
| `AUTH_TYPE_CHANGED` | `putConfiguration` and `dto.authType` differs from the existing row's `auth_type` |
| `AUTHENTICATION_CONFIGURATION_UPDATED` | `putConfiguration` and `auth_type` is unchanged |
| `CREDENTIAL_CONFIGURED` | `putCredential` and no secret existed before (`wasConfigured === false`) |
| `CREDENTIAL_REPLACED` | `putCredential` and a secret already existed |
| `CREDENTIAL_REMOVED` | `removeCredential` and a secret was actually cleared |

Every audit write's `beforeData`/`afterData` is limited to `{ authType, credentialConfigured }` — never the secret itself (§7).

**Not implemented in this lifecycle** (confirmed by reading the service, not inferred):

- No confirmation step *inside* the backend for a type change — `CL-3C-02`'s "must warn before confirming" is implemented entirely in the frontend (`ConfirmDialog` before the `PUT` is sent); the service itself performs the type change unconditionally once called. This matches the requirement doc's own framing ("the frontend confirms via dialog before calling this at all" — migration header comment).
- No optimistic-concurrency/versioning column (no `lock_version`/ETag) on `authentication_configurations` — `ODC-06` ("concurrent replace/run — transaction/snapshot consistency") from `REQ-AUTH-003` §9 remains open, not resolved by this schema.

## 9. Data isolation by API and Environment

- The composite primary key `(api_id, environment_id)` is the sole and complete implementation of the isolation boundary defined in `REQ-SEC-002` §5: a credential for API A in Environment UAT is a physically distinct row from API A in DEV, or API B in UAT. There is no foreign key, view, or application code path that reads one API×Environment's row to answer a query for another.
- **No Shared/Reusable Credential Library table exists.** There is no join table, no `credential_profiles` table, and no nullable "shared profile id" column anywhere — consistent with `REQ-AUTH-003`'s explicit rejection of the earlier "Authentication Profile per Environment, shared across APIs" design (§3 Out of Scope, and the migration header's "No Shared/Reusable Credential Library, no Copy Credential (MVP boundary)").
- **Creating a new Environment never copies a credential**, because there is no copy code path in `AuthenticationService` at all — every row is created independently via its own `putConfiguration`/`putCredential` call, keyed by the new `environment_id`. This satisfies `BR-AUTH-003-05`.
- **Changing Environment in the UI loads a different row**, not a client-side filtered view of a shared row: `AuthenticationController.get()` takes `environmentId` as a path parameter and the service does a fresh `findUnique` keyed on it — there is no caching or carrying-over of a previously loaded Environment's data at the database layer.
- One consequence, not a gap: because the row key is `(api_id, environment_id)`, a Project-level or Environment-level "list all Authentication Configurations" query is possible only via `environment_id` (indexed) or a full scan filtered by `api_id` through the PK's leading column — there is no index or query path in the service today that lists by `api_id` alone across Environments (not needed by any implemented endpoint, since the only `GET` is scoped to one API×Environment pair).

## 10. Version metadata persistence status

**Implemented: none.** There is no table, column, migration, or Prisma model anywhere in `prisma/schema.prisma` or its migrations for API Version or Database Version. This was verified directly:

- `prisma/schema.prisma`'s own top-of-file scope comment for Group 3C states explicitly: *"API/DB Version (REQ-VER-001) has no backend persistence in this scope — Run persistence is deferred, so Version stays a transient UI-only field (Run Preparation), not modeled here."*
- The migrations directory has six entries total (`20260911192701_init_user_auth` through `20260921120000_add_authentication_3c`); none is named for, or contains any reference to, version metadata.
- `authentication_configurations` (the only new Group 3C table) has no `api_version`/`database_version`-shaped column.

This matches `REQ-VER-001` itself, which states its own boundary as *"Requirement mô tả hành vi; không chốt DB schema, endpoint hay giao diện cụ thể"* (this requirement describes behavior only; it does not finalize DB schema, endpoint, or UI) and, in its Traceability section, *"Cần persistence version per Run; không tự chọn kiểu dữ liệu/cột khi chưa có Run schema"* (needs per-Run persistence; must not pick a data type/column before the Run schema exists). Since no Run/Result table exists yet (§1), there is no schema for a per-Run version column to attach to.

**Where Version metadata currently lives instead:** entirely in the frontend, as ephemeral React state in the Run API area's Version Metadata step (`apps/web/src/features/apiEnvironment/RunVersionMetadataPanel.tsx` / `version.util.ts`, outside this document's scope). It is never sent to any backend endpoint and never reaches any database row. This is consistent with, and does not exceed, what `REQ-VER-001` and the 3C-R01 UI revision both describe as current scope ("Run Preparation UI only... Run execution/persistence must not be inferred as completed from the UI design").

**Conclusion:** Version metadata persistence, as required by `REQ-VER-001` §6 ("system locks both values at Run-creation time") and VER-BR-04/05 (per-Run immutability), is **not yet implemented at the database level**, and cannot be, until a Run/Result schema is designed — which is explicitly out of scope for Group 3C per this task's own instructions and per the requirement document's own stated boundary.

## 11. Mapping to Group 3C requirements

| Requirement | Implemented DB element | Status |
|---|---|---|
| `REQ-SEC-002` §5 — credential scope = API + Environment + Authentication Configuration | `authentication_configurations` PK `(api_id, environment_id)` | Implemented |
| `REQ-SEC-002` §14 — Secret Credential Value never stored/returned as plaintext | 6 secret columns store only AES-256-GCM ciphertext/iv/authTag; `toResult()` never returns them | Implemented |
| `REQ-AUTH-001` (Fixed Login Form) — Login URL, Username, Password, Username Field, Password Field, Token Response Path | `login_url`, `username`, `username_field`, `password_field`, `token_response_path` (metadata) + `password_ciphertext/iv/auth_tag` (secret) | Implemented (storage only — the login call itself is Run-time behavior, out of DB scope) |
| `REQ-AUTH-001` BR-AUTH-001-05 — never store Username/Password inside Request Input Definition or 3B Run Value | No write path from `authentication.service.ts` touches `request_parameter_definitions`/`request_body_definitions` | Implemented (by omission — confirmed no cross-write exists) |
| `REQ-AUTH-002` (Bearer Token direct) | `bearer_token_ciphertext/iv/auth_tag` | Implemented |
| `REQ-AUTH-002` BR-AUTH-002-04 — never re-display plaintext token | `toResult()` returns only `credentialStatus`, never a decrypted value | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-01 — at most one active Authentication Configuration per API×Environment | Composite PK `(api_id, environment_id)` | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-04/05 — credential isolation and independent per-Environment configuration | PK + no cross-row read/copy path (§9) | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-06 — no Shared/Reusable Profile Library, no Copy Credential | No such table/column/code path exists | Implemented (absence confirmed) |
| `REQ-AUTH-003` BR-AUTH-003-08 — Remove reverts to Not configured but keeps the record | `removeCredential` nulls secret columns only, row persists | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-09 / `CL-3C-02` — type change clears old secret in the same mutation | `putConfiguration`'s `typeChanged` branch nulls all 6 secret columns in the same `upsert` | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-11 — no credential mutation while Project INACTIVE | `assertProjectActive` + Environment `ACTIVE` check inside every mutating transaction | Implemented |
| `REQ-AUTH-003` BR-AUTH-003-12 — Auth Configuration never changes API identity, Full URL, or Request Input Definition | No write path touches `api_configurations`, `api_environment_configs`, or the 3B tables | Implemented (absence confirmed) |
| `REQ-AUTH-003` BR-AUTH-003-14 — audit records only safe metadata | Audit payload limited to `{authType, credentialConfigured}` (§7, §8) | Implemented |
| `REQ-AUTH-003` ODC-04 — secret storage encryption/key rotation | AES-256-GCM implemented; **key rotation not implemented** (§7) | Partially implemented — encryption done, rotation still open |
| `REQ-AUTH-003` ODC-05 — Login URL / SSRF outbound policy | `validateLoginUrl` only checks well-formed + http/https scheme; no SSRF/private-IP blocking (confirmed by migration header: *"Login URL is syntax-only-validated, no SSRF/private-IP blocking"*) | Explicitly deferred, not implemented |
| `REQ-AUTH-003` ODC-06 — concurrent replace/run consistency | No optimistic-lock/versioning column | Not implemented, still open |
| `REQ-VER-001` (all sections) | No table/column | **Not implemented** — see §10 |

## 12. Deviations from Database Standard

Cross-checked against `Database_Standard_v2.0.docx` (Effective 2026-09-11):

| Standard section | Rule | Observation |
|---|---|---|
| Naming (tables/columns `snake_case`, PK = `<singular_entity>_id`) | — | `authentication_configurations` (plural, snake_case) — compliant. Composite PK columns `api_id`/`environment_id` follow the referenced-PK-name convention for FK naming — compliant. No deviation found. |
| §12 Data Type Standard — fixed domain → VARCHAR + CHECK preferred over native ENUM | — | `auth_type VARCHAR(20)` + `ck_authentication_configurations_auth_type` — compliant, matches the same pattern already used for `account_status`, `project_status`, `classification`, etc. |
| §12 — Identifier → UUID | — | `api_id`/`environment_id` are UUID — compliant. |
| §13 NULL/NOT NULL — "is the record valid at creation time if this field has no value yet?" | — | All LOGIN_FORM-only and secret columns are nullable, which is correct since a row can validly exist with `auth_type = NONE` or `BEARER_TOKEN` with no LOGIN_FORM fields at all — compliant. |
| §14 Default vs Initial Business Value | DB `DEFAULT` only when every valid insert shares it; a value assigned by only one flow is an Initial Business Value, not a SQL default | `auth_type` has no SQL `DEFAULT` in the migration (no row is ever inserted with an implicit type — the service always supplies an explicit `authType` on `upsert`/`create`). This is compliant with the standard, though note it differs from `users.account_status`/`projects.project_status`, which the schema comments explicitly call out as "Initial Business Value... not a SQL default" — `auth_type` doesn't need that annotation because it's never defaulted at all (no-row = NONE is an application-level *read-time* convention, not a stored default). No deviation. |
| §18 Timestamp/Timezone — UTC, `<event>_at` naming | — | `created_at`, `updated_at` are `TIMESTAMPTZ`, no `_utc` suffix — compliant. |
| §19 Audit/History — audit log must never contain secret/full token | — | Confirmed compliant (§7, §8) — audit payloads are explicitly restricted to `{authType, credentialConfigured}` and unit-tested to exclude ciphertext/plaintext. |
| §20 Normalization — no copying data into child tables for display when a stable join exists | — | `authentication_configurations` does not duplicate `api_name`/`environment_name`; the service joins `api_configurations`/`environments` at read time (`findApiAndEnvironment`) — compliant. |
| §21 Index Standard | FK and frequently filtered columns considered for indexing based on query pattern | `environment_id` is indexed; `api_id` is not separately indexed (relies on the composite PK's leading-column property) — this is a reasonable, standard-compliant choice given the only implemented query patterns, not a deviation. |
| §22 Security/Sensitive Data — no plaintext password/token/credential unless required, and any secret requires a dedicated security design | — | Secrets are encrypted (§7), matching the standard. **However**, the Database Standard's own text is more absolute than what's implemented: it also expects "a dedicated security design covering encryption, expiry, rotation, access control" for any stored secret. Encryption exists; **expiry and rotation do not** (no TTL on a credential, no key-rotation path) — see §7 and the ODC-04 row in §11. This is a **deviation from the full spirit of §22**, though it is explicitly named as still-open in `REQ-AUTH-003`'s own ODC-04, so it is a *documented, requirement-acknowledged* gap rather than a silent one. |
| §16 Catalog/Reference Table Standard (`code`, `name`, `is_disabled`, etc.) | — | Not applicable — `authentication_configurations` is an entity/configuration table, not a catalog table. No `auth_type` catalog/reference table was created; the domain is enforced by CHECK instead, which the Standard explicitly permits for "small stable domains with no admin-management/localization/sorting/reporting requirement" (§16) — compliant choice, not a deviation. |
| §17 Status/Lifecycle Standard — every status field needs a Status Dictionary | `auth_type` is a domain field (NONE/LOGIN_FORM/BEARER_TOKEN), not strictly a "status" with defined transitions, but it does have transition-sensitive behavior (CL-3C-02). No formal Status Dictionary artifact (entry/exit/forbidden transitions table) exists for it beyond what's narratively described in `REQ-AUTH-003` §6/§9. Minor documentation gap, not a schema deviation. |

**No naming, typing, or FK-delete-rule deviation was found.** The one substantive deviation is the incomplete secret lifecycle management (no expiry, no rotation) against Database Standard §22's full expectation — and it is a requirement-acknowledged open item (`ODC-04`), not an undocumented one.

## 13. Unapproved design decisions or open questions

These are open items still unresolved at the database/schema level, carried over from the requirement documents' own "Open Design Controls" sections and cross-checked against what the code actually does:

1. **`REQ-AUTH-003` ODC-04 — Secret storage key rotation.** AES-256-GCM encryption is implemented; key rotation, key expiry, and access-control-beyond-Admin-role are not. A single static `CREDENTIAL_ENCRYPTION_KEY` env var with no versioning means rotating it would break decryption of all existing rows — no migration or dual-key-read path exists to handle that.
2. **`REQ-AUTH-003` ODC-05 — Login URL outbound/SSRF policy.** `validateLoginUrl` (in `authentication.service.ts`) checks only that the URL is well-formed and uses `http:`/`https:`. There is no private-IP/internal-network blocking, no allowlist/denylist — confirmed both by reading the validation function and by the migration's own header comment stating this explicitly ("Login URL is syntax-only-validated, no SSRF/private-IP blocking").
3. **`REQ-AUTH-003` ODC-06 — Concurrent Replace/Run consistency.** No optimistic-concurrency column (e.g. a row version or `xmin`-based check surfaced to the application) exists on `authentication_configurations`. Two concurrent `PUT` calls for the same API×Environment would both succeed via Prisma's `upsert`/`update`, last-write-wins, with no conflict detection.
4. **`REQ-VER-001` — Version metadata persistence (VER-OD-01 through VER-OD-05), entirely open.** No table/column exists (§10). None of the following are decided at the DB level because there is no DB element to decide them for: trim/max-length rules for the free-text version strings, the canonical representation of `UNKNOWN` (literal string vs. null-then-display), whether a failed Run's version gets recorded, or any future automatic version-source mechanism. This is not a defect — the requirement document itself defers these decisions until a Run/Result schema exists — but it means any future migration adding version persistence has zero existing precedent in this schema to build on.
5. **`note TEXT` column on `authentication_configurations`.** Present in the migration (consistent with the `note` column pattern on every other Group 3A/3B/3C table) but no DTO, controller route, or service code path reads or writes it. Whether this is intentional forward-provisioning or dead schema surface is not stated in any requirement or design document reviewed.
6. **No Status Dictionary artifact for `auth_type`** beyond narrative description in the requirement docs (§12 of this document, §17 cross-check) — a minor documentation gap against Database Standard §17, not a functional one.
7. **`REQ-AUTH-003` §3 out-of-MVP items** (Shared/Reusable Credential Library, Copy Credential, Basic/API Key/OAuth auth types, custom login flow) remain fully unimplemented, as expected — listed here only for completeness, not as a gap, since the requirement explicitly places them out of scope.

---

*End of document. Status: AS-BUILT / FOR REVIEW.*
