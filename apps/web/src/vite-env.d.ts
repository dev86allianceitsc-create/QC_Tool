/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the QC Tool API, including its "api/v1" prefix. */
  readonly VITE_API_BASE_URL?: string;
  /** Public Google OAuth 2.0 Web client ID (no secret). Empty disables real Google login. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
