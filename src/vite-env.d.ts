/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_ORG_EMAIL?: string;
  readonly VITE_ORG_PHONE?: string;
  readonly VITE_ORG_ADDRESS?: string;
  readonly VITE_ORG_MAP_URL?: string;
  readonly VITE_ORG_REGISTRATION?: string;
  readonly VITE_ORG_FACEBOOK?: string;
  readonly VITE_ORG_X?: string;
  readonly VITE_ORG_LINKEDIN?: string;
  readonly VITE_ORG_INSTAGRAM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
