-- Phase 1 (customer feedback #2): optional per-Environment domain/base URL.
-- Nullable — "no domain bound" stays the default, matching every other
-- optional column on this table (note). Used only as a fallback base when
-- resolving an API's effective Full URL (resolveEffectiveUrl); never
-- replaces the api_environment_configs override contract.
ALTER TABLE "environments" ADD COLUMN "base_url" VARCHAR(2048);
