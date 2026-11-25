/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORCHESTRATOR_URL: string;
  readonly VITE_RESERVATIONS_API_URL: string;
  readonly VITE_AWS_REGION: string;
  readonly VITE_AWS_ACCESS_KEY_ID: string;
  readonly VITE_AWS_SECRET_ACCESS_KEY: string;
  readonly VITE_AWS_SESSION_TOKEN?: string;
  readonly VITE_DEFAULT_USER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS Modules
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
