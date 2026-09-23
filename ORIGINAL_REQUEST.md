# Original User Request

## 2026-09-21T03:31:26Z

Build a high-fidelity, production-grade replica of the ShengTong Education training school management system (一校教培系统) covering the 5 core modules (Curriculum 教研, Student Center 学员, Educational Administration 教务, Financial Center 财务, and System Settings 系统) with complete UI fidelity, interactive state flows, and mock business data.

Working directory: /Users/donghaichao/Desktop/new_xitong
Integrity mode: development

## Reference Materials
- Design specification and schema: MODULE_ANALYSIS_DESIGN.md
- High-fidelity visual references: docs/screenshots/

## Requirements

### R1. Global Architecture & Design System Shell
Implement the enterprise admin layout conforming to the ShengTong Blue (`#1890FF`) visual guidelines specified in `MODULE_ANALYSIS_DESIGN.md`, featuring a 60px global top header with micro-system switcher, a 220px/64px collapsible sidebar, breadcrumbs, multi-tenant campus context selector, and segmented status tabs.

### R2. Curriculum Module (教研)
Implement course management with responsive card grid flow (16:9 covers, attribute badges, status toggle switches, capsule filters) and multi-step course editor (basic info, campus transfer authorization tree, unit/lesson hierarchy with drag-and-drop ordering).

### R3. Student Center & CRM (学员)
Implement student lifecycle management featuring a 360-degree student profile drawer, enrollment order wizard with course hour allocation, electronic purse ledger, and the 7-branch abnormal status transition state machine (transfer class, change course, suspend, resume, transfer school, transfer student, refund).

### R4. Educational Administration & Scheduling Matrix (教务)
Implement the 7x15 dynamic time-grid scheduling calendar (07:00-22:00) with semantic chip positioning (green: completed, red: conflict, purple: personal schedule, blue: regular), alongside a 3-dimensional collision detection engine validating teacher availability, classroom occupancy, and student schedule overlap.

### R5. Financial Center & Approval Workflows (财务)
Implement the high-density filter matrix (3 rows x 8 columns) and order revenue ledger table with dynamic summary metrics strip (order count and total amount calculation), alongside multi-tier approval flows for regular payments, quarterly charges, and refund requests.

### R6. System Settings & RBAC Middle Platform (系统)
Implement organizational hierarchy management (company, region, campus, department, role tree) and a 4-level permission assignment matrix controlling both UI action buttons and multi-campus data scoping.

## Acceptance Criteria

### Build & Code Quality
- [ ] Project builds cleanly via `npm run build` with zero TypeScript or bundler errors.
- [ ] Development server starts cleanly via `npm run dev` and renders the application at the root route.
- [ ] No broken CSS assets, missing icons, or unhandled runtime exceptions in the browser console.

### Layout & Navigation Fidelity
- [ ] Global header and sidebar navigate across all 5 target modules with routes matching `/curriculum/*`, `/studentCenter/*`, `/educational/*`, `/financial/*`, and `/systemSetting/*`.
- [ ] Switching campuses in the top header dynamically re-scopes mock data and active context.

### Business Feature Verification
- [ ] Curriculum course management supports responsive card rendering, tag filtering, and course status toggling.
- [ ] Educational schedule calendar renders a weekly 7x15 time matrix with conflict detection visibly flagging overlapping schedules.
- [ ] Student management allows viewing 360° student details, executing enrollment, and initiating abnormal status transitions.
- [ ] Financial order ledger allows multi-condition filtering and automatically updates the summary strip total payment count and sum amount.
- [ ] System settings allows toggling permissions on the RBAC tree and managing organizational units.
