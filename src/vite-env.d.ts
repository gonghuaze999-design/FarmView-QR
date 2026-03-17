/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_NAME: string
  readonly VITE_DEVICE_ID: string
  readonly VITE_AMAP_KEY: string
  readonly VITE_AMAP_SECURITY_CODE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
