# Repository Guidelines

## Project Structure & Module Organization
This repository contains a Vue 3 SPA frontend and a NestJS backend for the **一校教培系统** (Yixiao Training School Management System):

- `src/`: Vue 3 frontend (Vite, TypeScript, Pinia, Element Plus, TailwindCSS).
  - `src/views/`: Business pages organized by module (`curriculum`, `student`, `educational`, `financial`, `system`).
  - `src/components/`, `src/stores/`, `src/api/`: Shared UI components, Pinia stores, and API clients.
- `server/`: NestJS backend service.
  - `server/src/modules/`: Domain modules (`auth`, `curriculum`, `student`, `educational`, `financial`, `system`).
  - `server/prisma/`: Prisma schema, migrations, and `seed.ts` (SQLite: `dev.db`).
- `tests/`: Tiered testing suites (`tier1_core` to `tier5` adversarial suites) and E2E integration runners.
- `scripts/`: Browser walkthrough and operational automation scripts.

## Build, Test, and Development Commands
Run commands from the repository root:

- `npm run dev`: Launch the Vite frontend dev server (`http://localhost:5173`).
- `npm run server:dev`: Run the NestJS backend in watch mode (port 3001).
- `npm run build`: Run `vue-tsc` type-checking and build production frontend assets.
- `npm run type-check`: Validate TypeScript types across frontend code.
- `npm run test:all`: Run tiered tests, full-stack E2E, and backend domain tests.
- `npm run test:server`: Execute backend module test suites.
- Under `server/`:
  - `npx prisma db push`: Push schema changes to the local SQLite database.
  - `npm run prisma:seed`: Populate the database with seed data.
  - `npm run format`: Format backend code using Prettier.

## Coding Style & Naming Conventions
- **Frontend**: Vue 3 `<script setup lang="ts">`. Use PascalCase for components (`BatchScheduleDialog.vue`), camelCase for stores/composables, and 2 spaces for indentation.
- **Backend**: NestJS conventions. Use kebab-case for filenames (`student.service.ts`), PascalCase for classes (`StudentService`), and camelCase for methods/variables.
- **Typing**: Keep TypeScript strict; avoid untyped `any`.

## Testing Guidelines
- **Suites**: Custom tiered runner (`tests/runner.js`), Node.js assertions, and Puppeteer for E2E scenarios.
- **Organization**:
  - `tests/tier1~tier5`: Unit contracts, boundaries, pairwise states, and adversarial tests.
  - `tests/e2e_full_stack_integration.cjs`: End-to-end integration flows.
  - `server/test-*.js`: Backend API and domain validations.
- Ensure all tests pass (`npm run test:all`) with zero errors before submitting changes.

## Commit & Pull Request Guidelines
- **Commit Messages**: Follow concise, descriptive messages (e.g., `feat: ...`, `fix: ...`, or clear descriptive summaries).
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

