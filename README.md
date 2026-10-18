# 拓视未来教育「一校教培系统」

<p align="center">
  <strong>现代化全栈教培 SaaS 数字化解决方案（Web 中台 + 微信小程序移动端 + NestJS 高并发后端）</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-brightgreen.svg" alt="Vue 3.5">
  <img src="https://img.shields.io/badge/Vite-5.4-blue.svg" alt="Vite 5">
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue.svg" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Element%20Plus-2.8-blue.svg" alt="Element Plus">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/NestJS-10.4-ea2845.svg" alt="NestJS">
  <img src="https://img.shields.io/badge/Prisma-5.22-2d3748.svg" alt="Prisma">
  <img src="https://img.shields.io/badge/Uni--app-3.0-green.svg" alt="Uni-app">
  <img src="https://img.shields.io/badge/Wot%20Design%20Uni-1.14-blueviolet.svg" alt="Wot Design Uni">
  <img src="https://img.shields.io/badge/Tests-100%25%20Passing-success.svg" alt="Tests">
</p>

---

## 📖 项目简介

**「一校教培系统」** 是面向综合性培训学校与连锁教培机构打造的生产级数字化教培中台。系统覆盖**教研中心、学员中心、教务中心、财务中心、系统设置**五大核心业务域，并配套**移动端微信小程序（教师掌上工作台）**，全面打通“课研-招生-排课-消课-课评-财务-权限”全链路运营闭环。

---

## 🌟 核心业务矩阵与架构亮点

### 1. Web 运营中台 (`src/`)
- **教研中心 (Curriculum)**：
  - 16:9 响应式课程卡片流、年级/属性/状态胶囊多选过滤器。
  - 三步课程向导编辑器（基础信息、多校区穿梭授权树、单元与课时层级配置）。
  - 科目体系、教案/课件库集中管理，课程启禁用与排课排期强阻断联动。
- **学员中心 (Student Center)**：
  - 学员全生命周期档案、待分班学员调度池与服务费管理。
  - **360° 学员全景画像抽屉**：涵盖在读课程、学习成长轨迹、充值与扣费电子账本明细、家校沟通回访时间轴。
  - 签约报名开单向导与优惠立减核算。
  - **7 种异常状态流转机**：转班、换课、休学、复课、转校、转学员、退费，严密校验前置依赖。
- **教务中心 (Educational Admin)**：
  - 班级设立、授课老师/班主任关联、班容上限动态预警与配比调度。
  - **7×15（07:00-22:00）网格排课看板**：Lane 自适应多列重叠并排算法（支持多达 4 课次同屏并列并保真对齐）。
  - **三维冲突检测引擎**：毫秒级精准检测“教师时间重叠 / 物理教室占用 / 学员课表冲突”。
  - 授课工作台点名签到（出勤/请假/缺席）、自动课消扣减与**反结课课消冲正机制**。
- **财务中心 (Financial Center)**：
  - 3×8 高密度多维筛选矩阵、实时动态汇总小计横条（“共计 N 笔，实缴金额 M 元”）。
  - 常规收费与周期性扣费营收流水看板，防伪电子收据防伪打码与官方印章水印。
  - 多级风控退费审批流（教学核实 ➔ 校长审核 ➔ 财务终审放款）。
- **系统设置与 RBAC (System Settings)**：
  - 集团-区域-校区-部门-角色 5 级组织架构树形维护。
  - 4 级细粒度权限勾选树（模块-页面-按钮三级控制 + 半选联动状态持久化）。
  - **4 级数据作用域隔离**（全部数据 / 本校区 / 本部门 / 仅本人）。
  - 顶栏**当前校区上下文实时穿透**（`x-campus-id` 全局请求头与全局响应式同步更新）。

### 2. 移动端微信小程序 (`mini-program/`)
- 基于 **Uni-app 3 + Vue 3 + TypeScript + Wot Design Uni** 打造的移动端混合应用。
- **科学分包架构**：主包（5 大核心 Tab：首页大盘、移动工作台、智能助手、待办协同、个人中心 + 登录）+ 4 大业务分包（`package-edu`, `package-student`, `package-finance`, `package-crm`），主包严格控制在 1.5MB 以内并配置静默预加载（`preloadRule`）。
- **微信底层原生深度适配**：动态胶囊避让（`useNavBar` 计算胶囊安全边界）、全面屏底部安全区（`safe-area-inset-bottom`）、防事件穿透抽屉。
- **掌上教学履约闭环**：教师移动端周日历日程、课次快速点名、**随堂课评防丢暂存**、**学生独立多媒体照片/视频闭环直传**。
- **六维学员智能预警大盘**：待入班预警、课程回访提醒、课程到期提醒、请假待办、剩余课次（≤5 标红预警）、活跃度异常监控。
- **移动财务与审批流**：移动端电子收据呈现、退费/收款/异动快捷审批工作台。

### 3. 后端领域中台 (`server/`)
- 基于 **NestJS 10 + Prisma 5** 构建的微内核领域中台，提供 80+ RESTful API。
- **双轨数据库驱动**：本地默认免外部配置的 SQLite（`dev.db`），一键无缝切换至生产级 PostgreSQL / MySQL。
- **24 大深度领域协调引擎**：
  - 课消结算引擎 (`LessonSettlementEngine`)
  - 课次履约调度器 (`LessonFulfillmentCoordinator`)
  - 随堂课评与家校协同矩阵 (`StudentCentricEvaluationMatrix`)
  - 学员全景成长投影器 (`LearningGrowthProjector`)
  - 批量排课引擎 (`BatchSchedulingDeepModule`)
  - 学员班级流动与转班退费协调器 (`StudentMovementDeepModule` / `StudentEnrollmentCoordinator`)
  - 财务审批流编排器 (`FinancialApprovalOrchestrator`)
  - 组织机构与多校区统一权限持久化引擎 (`OrganizationCampusUnification`)

---

## 🛠️ 技术栈总览

| 维度 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **Web SPA 前端** | Vue 3.5 + Vite 5 + TypeScript 5 | `<script setup lang="ts">` 组合式 API，单向数据流 |
| **UI 组件与样式** | Element Plus 2.8 + TailwindCSS 3.4 | 盛通蓝 `#1890FF` 经典中台视觉体系，企业级高密度组件 |
| **移动端小程序** | Uni-app 3 + Vue 3 + Wot Design Uni | 微信小程序端，自适应胶囊、多业务分包、原生手势与离线缓存 |
| **状态管理与路由**| Pinia 2.2 + Vue Router 4.4 | 模块化 Store、校区上下文穿透、页面权限守卫 |
| **后端中台服务** | NestJS 10 + Express + RxJS | 领域驱动设计 (DDD)，强类型 DTO 校验与拦截器 |
| **ORM 与数据持久化**| Prisma 5 + SQLite / PostgreSQL / MySQL | 自动化迁移、Prisma Client 类型安全生成、双轨 schema 切换 |
| **安全与认证** | Passport + JWT + bcryptjs | RBAC 细粒度权限控制、双轨认证、手机号一键登录与重置机制 |
| **质量保证体系** | 自研分层测试套件 (Tier 1 ~ Tier 5) + Puppeteer | 覆盖契约、边界、异常对抗与真实无头浏览器 E2E 走查 |

---

## 📁 目录结构

```bash
yixiao-training-school-system/
├── src/                          # 【Web 前端 SPA 源码】
│   ├── api/                      # 统一 API 请求层与拦截器
│   ├── components/               # 通用业务组件（布局、筛选器、抽屉、对话框）
│   ├── layouts/                  # 主布局架构（Header、Sidebar、Content 栅格）
│   ├── router/                   # 路由配置与动态鉴权守卫
│   ├── stores/                   # Pinia 状态库（校区上下文、用户权限、字典缓存）
│   └── views/                    # 业务视图页面
│       ├── curriculum/           # 教研中心（课程管理、科目分类、教案库）
│       ├── student/              # 学员中心（学员名册、待分班池、成长档案）
│       ├── educational/          # 教务中心（排课看板、班级管理、授课工作台）
│       ├── financial/            # 财务中心（订单流水、退费审批、收据凭证）
│       └── system/               # 系统设置（组织架构树、角色权限、操作日志）
├── server/                       # 【NestJS 后端微服务】
│   ├── prisma/                   # Prisma Schema、SQLite dev.db 与 seed.ts 种子数据
│   │   ├── schema.prisma         # 当前生效的数据模型配置
│   │   ├── schema.sqlite.prisma  # SQLite 专用模式定义
│   │   ├── schema.postgresql.prisma # PostgreSQL 生产模式定义
│   │   └── seed.ts               # 初始多校区组织与演示业务数据填充
│   └── src/
│       ├── common/               # 全局守卫、拦截器、数据作用域装饰器
│       └── modules/              # 业务领域模块（auth, curriculum, student, edu, fin, sys）
├── mini-program/                 # 【微信小程序源码 (Uni-app 3)】
│   ├── src/
│   │   ├── components/           # 移动端 11 大通用原子组件（导航栏、日历滑块、收据卡片等）
│   │   ├── pages/                # 主包 5 大核心 Tab 页面
│   │   ├── package-edu/          # 教务排课与随堂点名履约分包
│   │   ├── package-student/      # 学员全景与报名开单分包
│   │   ├── package-finance/      # 移动财务订单与多级审批分包
│   │   └── package-crm/          # 线索跟进与六维预警中心分包
│   └── package.json              # 小程序依赖与编译脚本
├── tests/                        # 【分层自动化测试套件】
│   ├── tier1_core/               # Tier 1: 核心契约与基础单元测试
│   ├── tier2_boundaries/         # Tier 2: 状态机边界与前置阻断条件
│   ├── tier3_pairwise/           # Tier 3: 多条件交叉与两两组合覆盖
│   ├── tier4_e2e/                # Tier 4: 全流程端到端业务闭环
│   ├── tier5_adversarial/        # Tier 5: 并发、脏数据与对抗性断言
│   ├── e2e_full_stack_integration.cjs # 全栈集成自动化测试
│   └── run_all_unified.cjs       # 一键全量统一测试运行器
├── scripts/                      # 运维工具与 Puppeteer 浏览器自动化走查脚本
└── package.json                  # 全局聚合任务与脚本
```

---

## 🚀 快速开始

### 1. 环境准备
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`

### 2. 克隆项目与安装依赖

```bash
# 克隆代码仓库
git clone https://github.com/haichao80855/yixiao-training-school-system.git
cd yixiao-training-school-system

# 安装根目录及前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装微信小程序依赖
cd mini-program && npm install && cd ..
```

### 3. 初始化后端数据库与种子数据

```bash
cd server

# 复制环境变量配置
cp .env.example .env

# 推送 Prisma 模型至 SQLite 本地数据库（生成 server/prisma/dev.db）
npx prisma db push

# 注入完备的组织架构与多校区初始种子数据
npm run prisma:seed

cd ..
```

> **提示**：如果需要接入 PostgreSQL，只需在 `server` 目录下运行 `npm run prisma:use:postgres`，并在 `.env` 中配置 `DATABASE_URL` 即可。

### 4. 启动开发服务

在项目根目录下分别执行以下命令（或在不同终端窗口中启动）：

```bash
# 启动 NestJS 后端服务（监听端口 3001）
npm run server:dev

# 启动 Web 前端服务（监听端口 5173，自动反向代理 /api 到 3001）
npm run dev

# 启动微信小程序（开发模式编译至 mini-program/dist/dev/mp-weixin）
npm run mp:dev
```

- **Web 访问地址**：`http://localhost:5173`
- **默认管理员账号**：`admin` / **密码**：`123456`
- **微信小程序调试**：打开「微信开发者工具」，选择「导入项目」，目录指向 `mini-program/dist/dev/mp-weixin`，AppID 填入测试号即可预览体验。

---

## 💻 常用脚本命令速查表

在仓库根目录下，可直接使用以下聚合命令管理各端：

| 任务类别 | 命令 | 说明 |
| :--- | :--- | :--- |
| **Web 前端** | `npm run dev` | 启动 Vite 开发热更新服务器 |
| | `npm run build` | 执行 `vue-tsc` 类型检查并输出生产构建文件 |
| | `npm run type-check` | 执行 Web 前端 TypeScript 严格类型检查 |
| **NestJS 后端** | `npm run server:dev` | 以 watch 模式启动后端服务 |
| | `npm run server:build` | 编译 NestJS 后端生产代码 |
| | `npm run test:server` | 执行后端 24 个深度领域核心单元与集成测试 |
| **微信小程序** | `npm run mp:dev` | 监听并编译微信小程序端源码 |
| | `npm run mp:build` | 打包生产环境微信小程序代码 |
| | `npm run mp:type-check`| 检查小程序端 TypeScript 类型声明 |
| **自动化测试** | `npm run test:all` | **一键运行全栈全部测试**（分层套件 + E2E + 24大领域测试） |
| | `npm run test:fullstack` | 运行端到端全链路集成校验 |
| | `npm run test:e2e:walkthrough` | 启动 Puppeteer 真实浏览器无头自动化走查 |

---

## 🧪 自动化测试与工程质量保障

本系统实施严格的质量防线，构建了多层次、立体的自动化测试矩阵：

```
+-------------------------------------------------------------+
|                     Tier 5: 对抗加固与脏数据抵抗              |
|        (并发竞态、异常回滚、非法越权穿透、容灾幂等)             |
+-------------------------------------------------------------+
|                     Tier 4: 全栈真实 E2E 走查                |
|    (从前台选课开单 -> 课表冲突排课 -> 考勤消课 -> 财务退费全闭环)  |
+-------------------------------------------------------------+
|                     Tier 3: 两两组合多维用例                 |
|       (多校区 x 多角色 x 7种异常状态机全排列覆盖)               |
+-------------------------------------------------------------+
|                     Tier 2: 状态机边界与阻断条件              |
|           (欠费停课、班容满额阻断、教案未归档校验)             |
+-------------------------------------------------------------+
|                     Tier 1: 核心领域契约与底层引擎            |
|       (24 大后端协调器单元测试、DTO 验证、JWT & RBAC 守卫)     |
+-------------------------------------------------------------+
```

运行全量测试套件：
```bash
npm run test:all
```
所有测试均保证 **100% 通过**，无类型报错，保障企业级系统的稳定与可靠。

---

## 🤝 贡献与规范

1. **分支管理**：建议从 `main` 创建特性分支 `feat/xxx` 或修复分支 `fix/xxx`。
2. **代码风格**：
   - 前端遵循 Vue 3 Composition API `<script setup lang="ts">`，组件名统一大驼峰 (PascalCase)。
   - 后端遵循 NestJS 模块化规范，文件采用短横线 (kebab-case)，类名采用大驼峰。
3. **提交规范**：推荐使用约定式提交（如 `feat:`, `fix:`, `docs:`, `refactor:`, `test:`）。
4. **提交前核验**：确保 `npm run type-check` 与 `npm run test:all` 通过无误。

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。
