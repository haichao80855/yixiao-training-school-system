# Repository Guidelines

## Project Structure & Module Organization
This repository contains three clients and one backend for the **一校教培系统** (Yixiao Training School Management System):

- `src/`: Vue 3 admin SPA (Vite, TypeScript, Pinia, Element Plus, TailwindCSS).
  - `src/views/`: Pages by module: `dashboard`, `curriculum`, `studentCenter`, `educational`, `financial`, `systemSetting`, `login`, `public` (parent growth report share page), and `teacher` (mobile web teacher portal mounted at `/teacher`).
  - `src/components/`, `src/stores/`, `src/api/` (`modules/`, `normalizers/`), `src/composables/`, `src/router/`: Shared UI, Pinia stores, API clients, and routing.
- `mini-program/`: uni-app project (Vue 3, `wot-design-uni`). The same source builds two targets:
  - WeChat mini-program (`build:mp-weixin`): staff workbench (`pages/`, plus subpackages `package-edu`, `package-finance`, `package-student`).
  - Web parent portal (`build:h5`, deployed at `/parent/`): `package-parent`.
  - Business logic lives in `coordinators/`, `projectors/`, and `services/`; keep pages thin.
- `server/`: NestJS 10 backend (Prisma 5, JWT auth).
  - `server/src/modules/`: `auth`, `curriculum`, `student`, `educational`, `financial`, `system`, `data-scope` (campus data-permission policy), `parent` (parent portal and WeChat login), `teacher-portal`, `upload` (media upload and Aliyun OSS links).
  - Most modules keep their domain logic in `domain/` (coordinators, engines, projectors); controllers and services stay thin. The ADRs in `docs/adr/` describe these modules.
  - `server/prisma/`: `schema.prisma` (the active schema), `schema.sqlite.prisma` / `schema.postgresql.prisma` (the sources it is copied from), and `seed.ts`. There is no migrations folder; schema changes go through `prisma db push`. The local database `server/prisma/dev.db` is git-ignored.
- `tests/`: Tiered suites (`tier1_core` … `tier4_e2e_scenarios`, `tier5_adversarial_suite_*.cjs`), adversarial/challenger scripts, mini-program contract tests (`test_mp_*.cjs`), and E2E runners.
- `scripts/`: Browser walkthroughs, DB maintenance (`db_stats`, `clear_*`), and campus provisioning (`provision_campuses.cjs`).
- `deploy/`: Aliyun ECS deployment (`deploy-to-aliyun.sh`, nginx, docker-compose) and `deploy/backup/` (daily DB backup to OSS, alerting, restore; see its README).
- Root docs: `README.md`, `PROJECT.md`, `GLOSSARY.md` (domain vocabulary), `TEST_INFRA.md`, `docs/adr/`.

## Build, Test, and Development Commands
Run commands from the repository root:

- `npm run dev`: Launch the Vite frontend dev server (`http://localhost:5173`).
- `npm run server:dev`: Run the NestJS backend in watch mode (port 3001).
- `npm run build`: Run `vue-tsc` type-checking and build production frontend assets.
- `npm run type-check`: Validate TypeScript types across frontend code.
- `npm run test:all`: Run tiered tests, full-stack E2E, and backend domain tests.
- `npm run test:server`: Execute backend module test suites (an explicit list in `package.json`; add new `server/test-*.js` files there).
- `npm run test:fullstack` / `npm run test:backup`: Full-stack E2E only / backup script tests (Python).
- `npm run mp:dev`, `npm run mp:build`, `npm run mp:type-check`: WeChat mini-program. Under `mini-program/`, `npm run build:h5` builds the web parent portal.
- `npm run db:stats`: Print local database statistics.
- Under `server/`:
  - `npx prisma db push`: Push schema changes to the local database.
  - `npm run prisma:seed`: Populate the database with seed data.
  - `npm run prisma:use:sqlite` / `prisma:use:postgres`: **Overwrite** `schema.prisma` with that variant and regenerate the client. Edit models in both variant files, not only `schema.prisma`.
  - `npm run build`: Use this, not bare `nest build`. A leftover `*.tsbuildinfo` makes `nest build` exit silently without emitting `dist/`.
  - `npm run format`: Format backend code using Prettier.
- Deployment: `deploy/deploy-to-aliyun.sh` builds the admin SPA, the parent H5, and the server, then syncs them to production. Run it only when explicitly asked.
  - The live nginx config is `/etc/nginx/sites-available/yixiao` on the ECS host, not a repo file. `deploy/nginx.conf` is the reference copy. When changing nginx behavior, update both and keep them in step.
  - Production serves pre-built `.br` files (`brotli_static`, via `libnginx-mod-http-brotli-static`) and `.gz` files (`gzip_static`). Hashed assets use `Cache-Control: public, max-age=31536000, immutable`.
  - In `deploy/nginx.conf`, `brotli_static` stays commented out on purpose. The `Dockerfile` copies that file into `nginx:1.25-alpine`, which has no brotli module, so enabling it there would break the container.

## Coding Style & Naming Conventions
- **Frontend**: Vue 3 `<script setup lang="ts">`. Use PascalCase for components (`BatchScheduleDialog.vue`), camelCase for stores/composables, and 2 spaces for indentation.
- **Backend**: NestJS conventions. Use kebab-case for filenames (`student.service.ts`), PascalCase for classes (`StudentService`), and camelCase for methods/variables.
- **Typing**: Keep TypeScript strict; avoid untyped `any`.

## Frontend Performance Conventions
These follow PR #36. The first load is about 187 KB gzip; don't let it grow back.
- **Element Plus loads on demand** through `unplugin-auto-import` / `unplugin-vue-components` (`vite.config.ts`). Do not add `app.use(ElementPlus)`, the full `element-plus/dist/index.css`, or a global icon registration loop. Import icons from `@element-plus/icons-vue` in each file that uses them.
  - Imperative components (`ElMessage`, `ElMessageBox`, `ElNotification`, `ElLoading`) get their styles from the imports at the top of `src/main.ts`. When you start using another imperative API, add its style import there.
- **`manualChunks`** in `vite.config.ts`: never put the `element-plus` main entry (`es/index.mjs`) or the icon library into a manual chunk. That turns tree-shaking off and pulls in the whole 1 MB library. Component code and styles stay split by page, and shared internals go into `vendor-element-base`.
- `MainLayout` is imported statically on purpose. Lazy-loading it was measured 160–180 ms slower on desktop, so keep it static unless you have new measurements.
- **Large static data** must not be bundled into a page. For example, the platform courseware details are one JSON file per course under `src/mocks/platform-coursewares/`, loaded with `import.meta.glob` only when a course drawer opens. Follow the same pattern for new large datasets, and keep an eye on `chunkSizeWarningLimit` (800 KB).
- **Lists that can grow** should be paginated and filtered on the server. The all-students page is an example: filters go to `GET /api/students`, and summary numbers come from `GET /api/students/stats`. Don't fetch everything and filter in the browser.
- **Avoid duplicate requests**: reuse the profile request cache in `src/api/modules/auth.ts` (same token, 5 seconds), shared by `authStore` and `tenantStore`, and the in-flight dict request dedupe in `src/stores/dictStore.ts`. `MainLayout` already rebuilds pages when the campus changes, so pages should not add their own campus `watch` that reloads data again.
- `build/vite-precompress.ts` writes `.gz` and `.br` next to the build output for the admin SPA and the parent H5. It uses only Node's built-in zlib, so don't add a compression dependency for this.
- Parent H5 media: videos get a poster image and `preload="none"`. Carousels load only the current and neighboring full-size images. OSS thumbnails are not WebP yet, because the same links serve the WeChat mini-program and iOS `<image>` needs the `webp` attribute.

## Testing Guidelines
- **Suites**: Custom tiered runner (`tests/runner.js`), Node.js assertions, and Puppeteer for E2E scenarios.
- **Organization**:
  - `tests/tier1~tier5`: Unit contracts, boundaries, pairwise states, and adversarial tests.
  - `tests/e2e_full_stack_integration.cjs`: End-to-end integration flows.
  - `server/test-*.js`: Backend API and domain validations.
  - `tests/test_mp_*.cjs`: Mini-program coordinator/projector contracts and adversarial checks.
- **Tests hit a live server and write to the real database.** Many `server/test-*.js` files and `tests/*.cjs` hardcode port 3001 and ignore `PORT`. `test:all` reuses any server already listening on 3001, which is usually the dev server on `server/prisma/dev.db`. Before running them, check `lsof -iTCP:3001`. To run them in isolation, start a server on another port with a temporary `DATABASE_URL` and rewrite the port in copies of the tests (`perl -pe 's/\b3001\b/<port>/g'`; macOS `sed` lacks `\b`).
- Not every `server/test-*.js` is listed in `test:server` (for example `test-class-lifecycle-coordinator.js`, `test-lesson-renewal-coordinator.js`, `test-media-upload-coordinator.js`, `test-learning-growth-multimedia-projector.js`). Run the relevant ones directly when touching those areas.
- Git worktrees have no `server/node_modules`. Run `npm ci` there instead of symlinking the main checkout, whose Prisma Client may be stale.
- Ensure all tests pass (`npm run test:all`) with zero errors before submitting changes.

## Commit & Pull Request Guidelines
- **Commit Messages**: Conventional prefix with scope plus a Chinese summary of the user-visible effect, e.g. `fix(student): 编辑学员时保存年龄与年级，列表和档案显示真实值`. Common scopes: `student`, `educational`, `evaluation`, `financial`, `system`, `teacher`, `parent`, `mp`, `media`, `ops`, `security`.
- **Pull Requests**:
  - Specify the affected domain (e.g., `[教务/排课]`, `[财务/退费]`).
  - Provide a concise summary of changes and reference relevant tasks or issues.
  - Include verification command results or UI screenshots when modifying views.

## Agent skills

### Issue tracker

GitHub issues (`haichao80855/yixiao-training-school-system`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

