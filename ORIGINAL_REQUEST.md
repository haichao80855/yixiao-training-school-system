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


## Follow-up — 2026-10-15T14:27:54Z

一校教培系统微信小程序移动端全功能规划与技术规格设计，全面复刻 57 张业务截图并打通现有 Web 后端 NestJS RESTful 接口体系。

Working directory: /Users/donghaichao/Desktop/yixiaoxitong
Integrity mode: development

## Requirements

### R1. Web 现有架构审计与 API 接口映射
系统性梳理现有 Vue 3 Web 前端与 NestJS 后端（含 auth、curriculum、educational、financial、student、system、upload 等核心模块）的业务逻辑与数据模型。输出完整的接口复用映射矩阵，明确请求方法、URL、租户头（x-campus-id）、鉴权头（Authorization: Bearer）与入参出参结构，确保移动端 API 复用率达到 95% 以上。

### R2. 57 张页面截图像素级视觉与交互分析
针对 `docs/screenshots` 及微信小程序复刻截图目录（包含 01_首页统计、02_工作台入口与设置、03_课程管理与售卖、04_教务、05_学员、08_我的与账号等 10 大分类共 57 张 PNG 截图）进行像素级布局、色彩规范、排版层级、交互状态（加载、空状态、抽屉 ActionSheet、多选列表、日历滑块、表单联动、图表渲染）的深度解析与规格定义。

### R3. 小程序端技术架构方案与微信平台适配
制定基于 Uni-app + Vue 3 (Composition API / `<script setup>`) + TypeScript + Pinia 的高内聚低耦合移动端架构方案。设计“主包 (5大 Tab: 首页、工作台、AI问答、待办、我的) + 4大业务分包 (package-edu、package-student、package-finance、package-crm)”的按需分包加载方案。完成微信平台特性的深度适配方案，包括自定义胶囊避让导航栏、iOS/Android 底部安全区、下拉刷新与分页触底加载。

### R4. 认证、网络拦截器与数据适配设计
设计双轨登录体系（账号密码登录与微信快捷授权登录无缝切换）。设计统一的 Request 网络拦截器，自动注入多租户校区 Header 与 Bearer Token，闭环 401 登录失效跳转机制。针对小程序弱网与传输性能，设计轻量级数据适配转换层（Normalizer），对齐前端契约。

### R5. 验收标准与阶段化任务拆解
结合现有自动化契约测试套件（Phase 1 至 Phase 4 契约测试），制定视觉还原、功能交互、异常防御三维验收标准。将整体开发工作划分为 5 个可独立交付、可独立测试的敏捷阶段与细粒度任务工单，明确输入、输出与自动化验证指令，保持“先设计文档、确认后再开始项目工程编码”的安全交付节奏。

## Acceptance Criteria

### 架构与设计文档完整性
- [ ] 产出完整的微信小程序端系统架构设计文档（包含系统拓扑、目录规范、状态流转与网络分层）。
- [ ] 覆盖全部 57 张页面截图的布局还原规范与交互状态清单，无遗漏核心界面。
- [ ] 建立覆盖课程、教务、学员、订单、审批、报表全部核心路径的 API 映射表。

### 自动化契约对齐
- [ ] 小程序路由与分包配置满足 `tests/test_mp_phase1_contracts.cjs` 规范。
- [ ] 教学履约（讲台、点名、课评、多媒体）满足 `tests/test_mp_phase2_contracts.cjs` 契约。
- [ ] 学员画像与报名全向导满足 `tests/test_mp_phase3_contracts.cjs` 契约。
- [ ] 财务订单与审批风控满足 `tests/test_mp_phase4_contracts.cjs` 契约。
- [ ] 全量契约测试执行结果 100% 通过（0 assertions failed）。
