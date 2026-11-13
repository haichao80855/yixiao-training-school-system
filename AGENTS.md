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
  - `server/src/modules/`: `auth`, `curriculum`, `student`, `educational`, `financial`, `system`, `data-scope` (campus data-permission policy), `parent` (parent portal and WeChat login), `teacher-portal`, `upload` (media upload and Aliyun OSS links), `staff-notification` (in-app notices for principals and above: evaluation published, low lesson balance; shown in the admin header bell). Teacher pay (`financial` module, `teacher-pay.*`, page `/financial/teacherPay`) is computed from roll-call records and is visible only to principals and above (`common/campus-leader.policy.ts`); the rules are stored per campus in `SystemSetting`.
  - Most modules keep their domain logic in `domain/` (coordinators, engines, projectors); controllers and services stay thin. The ADRs in `docs/adr/` describe these modules.
  - `server/prisma/`: `schema.prisma` (the active schema), `schema.sqlite.prisma` / `schema.postgresql.prisma` (the sources it is copied from), and `seed.ts`. There is no migrations folder; schema changes go through `prisma db push`. The local database `server/prisma/dev.db` is git-ignored.
- `tests/`: The test list (`suites.json`), runner and isolated environment, full-stack and integration tests, mini-program contract tests (`test_mp_*.cjs`), and `unit/` (tests for the real `src/utils`). See `TEST_INFRA.md`.
- `scripts/`: DB maintenance (`db_stats`, `clear_*`), campus provisioning (`provision_campuses.cjs`), the UI lint and the first-load size check. The old browser walkthrough scripts were replaced by `tests/smoke/`.
- `deploy/`: Aliyun ECS deployment (`deploy-to-aliyun.sh`, nginx, docker-compose) and `deploy/backup/` (daily DB backup to OSS, alerting, restore; see its README).
- Root docs: `README.md`, `PROJECT.md`, `GLOSSARY.md` (domain vocabulary), `TEST_INFRA.md`, `docs/adr/`.

## Build, Test, and Development Commands
Run commands from the repository root:

- `npm run dev`: Launch the Vite frontend dev server (`http://localhost:5173`).
- `npm run server:dev`: Run the NestJS backend in watch mode (port 3001).
- `npm run build`: Run `vue-tsc` type-checking and build production frontend assets.
- `npm run type-check`: Validate TypeScript types across frontend code.
- `npm run test:all`: Run every suite registered in `tests/suites.json` on a throwaway database (see Testing Guidelines). The deploy script runs it first and stops on failure.
- `npm run test:server`: Same, backend suites only. Filter with `-- --group=<name>` or `-- --file=<part>`, for example `npm run test:server -- --file=teacher-pay`.
- `npm run test:fullstack` / `npm run test:backup`: Full-stack E2E only / backup script tests (Python).
- `npm run check:bundle`: After `npm run build`, check that the first load stays within 187 KB gzip.
- `npm run bench`: Time 16 core APIs on a throwaway database at seed size, 1× and 10× a school-year of data (`scripts/seed-load.cjs`, `scripts/bench-api.cjs`). Results and the baseline are in `docs/perf-baseline.md`; the plan is `docs/perf-improvement-plan.md`.
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
- Courseware fallback: platform courseware normally uses the public 盛通 (download) and 百家云 (online whiteboard) links. A backup of the courseware the school archived lives in the prod bucket under `courseware/shengtong/<盛通 path>`. `POST /api/curriculum/courseware/resolve` picks the origin link or a signed backup link, based on the 系统设置 switch (`auto` / `origin` / `mirror`) and on probes of the origin platforms. See `deploy/courseware-mirror/README.md`.
  - OSS rejects `response-content-type` on signed links. Set the right Content-Type when uploading.
  - The local disk engine only accepts ASCII keys, so Chinese-named backups only work with `STORAGE_ENGINE=oss`.

## Coding Style & Naming Conventions
- **Frontend**: Vue 3 `<script setup lang="ts">`. Use PascalCase for components (`BatchScheduleDialog.vue`), camelCase for stores/composables, and 2 spaces for indentation.
- **Backend**: NestJS conventions. Use kebab-case for filenames (`student.service.ts`), PascalCase for classes (`StudentService`), and camelCase for methods/variables.
- **Typing**: Keep TypeScript strict; avoid untyped `any`.

## Writes That Move Money or Lesson Hours
These follow the 第 1 期 fixes of `docs/perf-improvement-plan.md`.
- **Claim inside the transaction.** A status check before `$transaction` does not stop two concurrent requests. Make the first statement in the transaction a conditional `updateMany` (for example `where: { id, status: { notIn: ['completed'] } }`), and throw when `count !== 1`. Roll call, teacher-portal settle, every approval step and wallet withdraw work this way; `server/test-double-submit-guards.js` fires concurrent requests to prove it.
- **Idempotency keys.** Wrap the write in `runIdempotent(prisma, scope, dto.idempotencyKey, tx => …)` (`server/src/common/idempotency/run-idempotent.ts`). The frontend creates the key with `createIdempotencyKey()` when the form opens and reuses it for retries; a replay returns the first result with `replayed: true`.
- **Buttons.** Use `useSubmit()` (`src/composables/useSubmit.ts`) for submit buttons: bind `:loading="submitting"`, and repeated clicks are ignored while a request is in flight. Restate the amount or lesson count in the confirm box.
- **Dropdowns.** Never fetch an unpaged list for a select: list APIs default to 10–20 rows. Pass `OPTION_LIST_PAGE_SIZE` (`src/constants/ui.ts`) for classes and courses, and use `useStudentSearch()` (server-side search) for student pickers.
- **Responses.** `TransformInterceptor` strips every `password` field (`server/src/common/security/strip-secrets.ts`). Still prefer `select` over `include: { teacher: true }`.
- **Timing.** Requests over `SLOW_REQUEST_MS` (300) and queries over `SLOW_QUERY_MS` (100) are logged as `[timing]` / `[slow-query]` warnings, and every API response carries a `Server-Timing` header.

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
- **Overview**: `TEST_INFRA.md` describes the layout and rules. `docs/test-improvement-plan.md` holds the improvement plan.
- **Organization**:
  - `server/test-*.js`: Backend API and domain tests against a live backend.
  - `tests/*.cjs`: Full-stack and roll-call/evaluation integration, mini-program contracts, and source checks.
  - `tests/unit/*.spec.{js,ts}`: Front-end unit tests (Vitest, `vitest.config.ts`, which reuses the Vite aliases and Element Plus auto-import). `npm run test:unit` runs them in about a second.
    - Import real modules from `src/` (with `@/`). The old Tier 1–5 suites tested hand-written copies in `tests/contracts/` and the unused `src/mocks` data, so they were removed. Don't reintroduce copied business logic in tests.
    - `*.server.spec.js` files need a backend, run only in the isolated environment, and must each be registered in `tests/suites.json`.
    - `route-access-matrix.server.spec.js` logs in as 5 roles and records who can open which admin page in `route-access-matrix.md`. When you change page or role permissions on purpose, delete that file, rerun `npm run test:all -- --file=route-access-matrix`, and commit the regenerated table.
    - Known bugs are recorded with `it.fails`, which passes while the bug exists and fails once it is fixed. Then remove `.fails`.
  - `tests/smoke/*.smoke.cjs`: Browser smoke tests (puppeteer-core) for 9 key flows (09 = parent H5 screenshots and readability checks at 320/375/414 px).
    - Run them with `npm run test:smoke`, which builds the SPA and uses the isolated backend.
    - They are not part of `test:all` or PR CI. `.github/workflows/nightly-smoke.yml` runs them nightly or on demand.
    - Set up data through the API or Prisma, and drive only the key UI steps.
- **Run tests in isolation.** `npm run test:all` / `test:server` (`tests/isolated-env.cjs`) do the following:
  - Copy nothing from `dev.db`. They create a temporary SQLite database with `prisma db push` and the seed.
  - Start `server/dist/main.js` on a random port, rebuilding it first if `server/src` is newer.
  - Run the suites, then delete everything. Use `--keep` to keep the temp folder (database, uploads, server log).
  - The 3001 dev server and `server/prisma/dev.db` are never touched.
- **One list of tests: `tests/suites.json`.** It is grouped by domain and read by `test:all`, `test:server`, the deploy gate and CI.
  - Register every new `server/test-*.js` there. The runner (`tests/run-suite.cjs`) fails when a backend test is missing from the list.
  - `needs` marks what a test requires. Tests whose build output (`mp-dist` / `h5-dist`) is missing or older than `mini-program/src` are reported as skipped, because a stale build would test old code. `skip` records a known reason to skip.
- **Test accounts.** Log in with `server/test-utils/accounts.js` (`ACCOUNTS.superAdmin`, `principal`, `finance`, `teacher`, `advisor`, and `SEED_PASSWORD`). Prefer a business role over the super admin, because the super admin hides permission bugs.
- **Leftover check.** In isolated runs, the runner counts rows before and after every backend test.
  - New rows a test leaves behind are listed under 「清理遗漏」 in the summary and then deleted, so the next test sees the original database.
  - Tables where a test changed existing rows are reported but not restored.
  - For permission-related tables (`User`, `Role`, `UserRole`, `RolePermission`, `Campus`, `Company`, `SystemSetting`), the runner also compares content (ignoring ids, timestamps and password hashes). It warns with ⚠️ when a test changes existing data and does not restore it, because that silently changes what later tests can do.
  - This only runs on a database inside the system temp dir.
  - Fix a test's own cleanup when it shows up there.
- **Server address in tests.** Tests get it from `server/test-utils/target.js` (`TEST_BASE_URL`, then `PORT`, then 3001). Don't hardcode ports or hosts in new tests.
- **Environment guard (`tests/env-guard.cjs`).**
  - Running `node tests/run-suite.cjs` against an existing server is refused for a remote host, a missing `DATABASE_URL`, `dev.db`, or port 3001.
  - Pass `--allow-dev-db` only when you really mean to write the dev database.
- **Don't depend on existing data.** Tests must build their own fixtures and must not assume they are the only writer. For example, compare against a baseline read before creating fixtures, because other suites write to the same database earlier in the run.
- **CI.** `.github/workflows/ci.yml` runs on every PR and on pushes to `main`:
  - `lint:ui`
  - `build` (type-check included)
  - `check:bundle`
  - the backend build
  - all suites on a temporary database
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

