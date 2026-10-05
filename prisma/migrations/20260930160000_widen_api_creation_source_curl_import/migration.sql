-- Phase 2 (customer feedback #1): widen creation_source to add CURL_IMPORT,
-- for APIs created from a parsed curl/fetch command. Same server-decided
-- trust boundary as MANUAL/OPENAPI_IMPORT — never accepted as client input.
ALTER TABLE "api_configurations" DROP CONSTRAINT "ck_api_configurations_creation_source";
ALTER TABLE "api_configurations" ADD CONSTRAINT "ck_api_configurations_creation_source" CHECK ("creation_source" IN ('MANUAL', 'OPENAPI_IMPORT', 'CURL_IMPORT'));
