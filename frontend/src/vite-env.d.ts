/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // เพิ่ม environment variables อื่นๆ ตามต้องการ
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_ENVIRONMENT?: 'development' | 'production' | 'staging';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}