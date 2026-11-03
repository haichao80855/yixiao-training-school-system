interface ImportMetaEnv {
  /** 后端 API 根地址 (不含 /api)，如 https://aiic.space */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
