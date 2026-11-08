/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZERO_CACHE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
