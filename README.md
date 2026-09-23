# 盛通教育「一校教培系统」高保真复刻工程

以盛通教育「一校教培系统」为蓝本的像素级高保真实现，覆盖教研、学员、教务、财务、系统设置五大核心模块，前端为 Vue 3 单页应用，后端为 NestJS + Prisma 服务。

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 前端 | Vue 3.5（`<script setup>`）+ Vite 5 + TypeScript 5 + Element Plus 2.8 + TailwindCSS 3.4 + Pinia 2.2 + Vue Router 4.4 |
| 后端 | NestJS 10 + Prisma 5 + JWT（Passport）+ bcryptjs |
| 数据库 | 本地默认 SQLite（`server/prisma/dev.db`），可切换 MySQL / PostgreSQL |
| 验证 | 自研分层测试套件（`tests/tier1~tier5`）+ Puppeteer 真实浏览器走查脚本（`scripts/`） |

设计基准：盛通蓝 `#1890FF` 品牌色，60px 顶栏、220px/64px 可折叠侧边栏、44px 表头与 50px 行高的企业级中台栅格。

## 目录结构

```
src/                    前端源码（views / components / stores / router / mocks）
server/                 NestJS 后端（src/modules 下按 5 大业务域拆分）
server/prisma/          Prisma schema 与种子数据（dev.db 为本地数据，不入库）
tests/                  分层测试：契约、边界、两两组合、E2E、对抗套件
scripts/                Puppeteer 真实浏览器业务走查脚本
docs/screenshots/       原系统高保真参考截图
MODULE_ANALYSIS_DESIGN.md  模块分析与设计规格
PROJECT.md              架构、功能清单与里程碑
```

## 快速开始

前端（默认 `http://localhost:5173`，`/api` 反向代理到后端 3001）：

```bash
npm install
npm run dev
```

后端：

```bash
cd server
cp .env.example .env      # 首次运行需复制配置模板
npm install
npx prisma db push        # 初始化本地 SQLite 结构
npm run prisma:seed       # 写入种子数据
npm run start:dev
```

## 构建与测试

```bash
npm run build        # 类型检查 + 生产构建（零错误）
npm run type-check   # 仅类型校验
npm run test:all     # 分层测试 + 全栈集成 + 后端业务套件
```

## 文档

- `ORIGINAL_REQUEST.md`：原始需求与验收标准
- `MODULE_ANALYSIS_DESIGN.md`：五大模块的页面结构、交互与数据契约设计
- `PROJECT.md`：架构说明、功能清单与里程碑进度
- `TEST_INFRA.md` / `TEST_READY.md`：测试体系与验收证据
