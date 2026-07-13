/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API; empty = same-origin. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
