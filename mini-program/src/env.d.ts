interface ImportMetaEnv {
  /** 后端 API 根地址 (不含 /api)，如 https://aiic.space */
  readonly VITE_API_BASE_URL?: string;
  /** Vite 部署基础路径；网页家长端为 /parent/ (见 manifest.json h5.publicPath) */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
