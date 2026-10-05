-- Login Form Authentication: "Import Login Request from cURL/fetch".
--
-- Adds a second, general shape (IMPORTED) alongside the existing 3-field
-- LOGIN_FORM shape (now called MANUAL): an arbitrary login request captured
-- from pasted cURL/fetch text (method, headers, body format, body fields),
-- with import_username_location/import_password_location marking which
-- header or top-level body field is overwritten with the selected Test
-- Account's real username/password at Run time. login_mode discriminates
-- which shape is active; the inactive shape's columns are always null.
--
-- No plaintext secret is stored here — Test Account still holds the only
-- secret (its encrypted password), unchanged by this migration.

-- AlterTable
ALTER TABLE "authentication_configurations"
  ADD COLUMN "login_mode" VARCHAR(10),
  ADD COLUMN "import_method" VARCHAR(10),
  ADD COLUMN "import_url" VARCHAR(2048),
  ADD COLUMN "import_headers" JSONB,
  ADD COLUMN "import_body_format" VARCHAR(20),
  ADD COLUMN "import_body_fields" JSONB,
  ADD COLUMN "import_username_location" JSONB,
  ADD COLUMN "import_password_location" JSONB;

-- CreateCheckConstraint
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "ck_authentication_configurations_login_mode"
  CHECK ("login_mode" IS NULL OR "login_mode" IN ('MANUAL', 'IMPORTED'));

-- CreateCheckConstraint
ALTER TABLE "authentication_configurations" ADD CONSTRAINT "ck_authentication_configurations_import_body_format"
  CHECK ("import_body_format" IS NULL OR "import_body_format" IN ('JSON', 'FORM_URLENCODED', 'NONE'));
