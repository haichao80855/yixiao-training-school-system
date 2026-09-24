# Project: 拓视未来教育「一校教培系统」生产级高保真复刻工程

## Architecture
本系统采用前沿的现代企业级管理中台架构，对拓视未来教育原系统实现像素级复刻：
- **核心前端架构**: Vue 3.5 (SFC + `<script setup>`) + Vite 5 + TypeScript 5 + Element Plus 2.8 + TailwindCSS 3.4 + Pinia 2.2 + Vue Router 4.4。
- **设计系统 Token**: 盛通蓝 `#1890FF` 为基准品牌色，配合已完成绿 `#67C23A`、冲突警示红 `#F56C6C`、日程紫 `#722ED1`、警示橙 `#FAAD14`；60px 顶栏、220px/64px 折叠侧边栏、44px 表头及 50px 行高。
- **核心业务中台服务**:
  - `TenantContext & CampusScope`: 维护多租户与当前校区作用域，多模块响应式数据联动。
  - `StateFlowEngine`: 管理学员 7 种异常状态流转（转班、换课、休学、复课、转校、转学员、退费）及审批联动。
  - `CollisionDetectionEngine`: 教务 7x15（07:00-22:00）网格排课 Lane 染色多列自适应与教师/教室/学员三维碰撞冲突检测。
  - `FinanceAggregator`: 财务 3x8 高密度筛选矩阵实时动态小计汇总及多级审批工作流。
  - `RBACPermissionEngine`: 组织机构 5 级树与 4 级细粒度权限控制树及数据作用域过滤。

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 全局外壳与导航系统 | 60px 顶栏（含微系统切换、多校区切换）、220px/64px 折叠侧边栏、面包屑、多 Tab 标签栏 | M1 | ORIGINAL_REQUEST §R1, MODULE_ANALYSIS_DESIGN §一 |
| 2 | 盛通蓝设计系统 Token | #1890FF 品牌色、衍生色阶、语义功能色（绿/红/紫/橙）与标准规范 | M1 | MODULE_ANALYSIS_DESIGN §一, screenshots |
| 3 | 多校区上下文隔离中台 | 顶栏校区快速切换，动态联动重载各模块数据作用域与权限 | M1 | ORIGINAL_REQUEST §R1, MODULE_ANALYSIS_DESIGN §四 |
| 4 | 全局路由与 Mock 骨架 | 完整匹配 /curriculum/*, /studentCenter/*, /educational/*, /financial/*, /systemSetting/* | M1 | ORIGINAL_REQUEST §R1, MODULE_ANALYSIS_DESIGN §三 |
| 5 | 教研课程卡片流网格 | 16:9 课程封面、微立体属性角标、两行标题截断、突出价格显示 | M2 | ORIGINAL_REQUEST §R2, curriculum_courseManage.png |
| 6 | 教研胶囊过滤器与搜索 | 适用年级、课程属性、课程状态胶囊式多选过滤与模糊搜索 | M2 | ORIGINAL_REQUEST §R2, curriculum_courseManage.png |
| 7 | 教研三步课程编辑器 | 基础信息录入、跨校区授权穿梭树、单元与课时层级及拖拽排序向导 | M2 | ORIGINAL_REQUEST §R2, MODULE_ANALYSIS_DESIGN §二 |
| 8 | 教研课程启禁用与排课联动 | 课程 Switch 状态开关，禁用后阻断排课与前台开单 | M2 | ORIGINAL_REQUEST §R2, curriculum_courseManage.png |
| 9 | 学员中心全景列表 | 全部学员、待分班学员、服务费管理表格，状态 Tag 与查询 | M3 | ORIGINAL_REQUEST §R3, student_allStudent.png |
| 10 | 360° 学员画像全景抽屉 | 课程卡片、学习成长档案、钱包账本明细、沟通回访时间轴抽屉 | M3 | ORIGINAL_REQUEST §R3, MODULE_ANALYSIS_DESIGN §三 |
| 11 | 学员报名选课签约向导 | 关联学员、选课包、优惠核算、划拨课时并生成待审订单 | M3 | ORIGINAL_REQUEST §R3, MODULE_ANALYSIS_DESIGN §三 |
| 12 | 学员电子钱包账本 | 现金本金与赠送金独立分账、充值/消费/退款明细账本 | M3 | ORIGINAL_REQUEST §R3, MODULE_ANALYSIS_DESIGN §三 |
| 13 | 学员 7 分支异常状态机 | 转班、换课、休学、复课、转校、转学员、退费的前置校验与状态流转 | M3 | ORIGINAL_REQUEST §R3, MODULE_ANALYSIS_DESIGN §三 |
| 14 | 教务班级管理与班容控制 | 班级设立、授课老师/班主任关联、班容上限与待分班入班调度 | M4 | ORIGINAL_REQUEST §R4, educational_classManagement.png |
| 15 | 教务 7x15 动态时间排课网格 | 07:00-22:00（60px/小时）绝对定位渲染周一至周日排课看板 | M4 | ORIGINAL_REQUEST §R4, educational_timeSchedule.png |
| 16 | 教务排课 Lane 自适应并列算法 | 同一天重叠时段多课次自适应均分分流并排渲染（支持多达4列） | M4 | ORIGINAL_REQUEST §R4, educational_timeSchedule.png |
| 17 | 教务四色语义排课卡片 Chip | 绿色（已上结课）、红色（冲突）、紫色（个人日程）、蓝色（普通日常） | M4 | ORIGINAL_REQUEST §R4, educational_timeSchedule.png |
| 18 | 教务三维动态冲突检测引擎 | 毫秒级核验教师时段冲突、物理教室占用冲突、学员课程冲突 | M4 | ORIGINAL_REQUEST §R4, MODULE_ANALYSIS_DESIGN §四 |
| 19 | 授课工作台考勤与消课冲正 | 讲台点名考勤（出勤/请假/缺席）、自动课消与反结课冲正机制 | M4 | ORIGINAL_REQUEST §R4, MODULE_ANALYSIS_DESIGN §四 |
| 20 | 财务 3x8 高密度筛选矩阵 | 3 行 24 控件高密度紧凑表单（模糊搜索、渠道、班级弹窗、日期区间） | M5 | ORIGINAL_REQUEST §R5, financial_order_management.png |
| 21 | 财务动态汇总横条实时统计 | 表格上方浅灰小计条动态呈现“共计 N 笔缴费，实缴金额 M 元” | M5 | ORIGINAL_REQUEST §R5, financial_order_management.png |
| 22 | 财务订单营收流水与状态流 | 常规/季度纵向 Tab、已支付/未支付/已驳回/作废横向 Tab 流水表格 | M5 | ORIGINAL_REQUEST §R5, financial_order_management.png |
| 23 | 财务多级审批流工作台 | 常规缴费确认、季度扣费流水、退费多级审批（教学核实/校长/财务终审） | M5 | ORIGINAL_REQUEST §R5, MODULE_ANALYSIS_DESIGN §五 |
| 24 | 系统设置 5 级组织架构树 | 集团-区域-校区-部门-角色五级树状组织维护与编码管理 | M6 | ORIGINAL_REQUEST §R6, systemSetting_authoritiesInfo.png |
| 25 | 系统设置 4 级细粒度 RBAC 矩阵 | 系统-模块-页面-按钮级权限复选框（支持半选联动）与 4 级数据范围 | M6 | ORIGINAL_REQUEST §R6, MODULE_ANALYSIS_DESIGN §六 |
| 26 | 跨模块多校区数据流穿透联动 | 顶部校区切换全局广播，驱动教研、学员、排课、财务、权限联动重载 | M7 | ORIGINAL_REQUEST §Acceptance Criteria |
| 27 | 生产级构建验证与 E2E 终审 | npm run build 零错误、npm run dev 启动流畅、通过 100% E2E 自动化测试 | M7 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | 全局架构与设计系统外壳 | 项目脚手架初始化、盛通蓝设计系统、60px顶栏/220px侧边栏外壳、全局路由、校区上下文Store与基础Mock | none | DONE |
| M2 | 教研中心模块 (Curriculum) | 16:9 课程响应式卡片流、胶囊过滤器、三步课程向导编辑器、跨校区授权树、课时拖拽排序 | M1 | DONE |
| M3 | 学员中心与 CRM 模块 (Student Center) | 学员全生命周期列表、360°画像全景抽屉、签约开单向导、电子钱包账本、7 种异常状态流转状态机 | M1 | DONE |
| M4 | 教务与排课矩阵模块 (Educational Admin) | 班级管理、7x15（07:00-22:00）动态排课网格、Lane染色多列并排算法、四色语义Chip、三维防撞检测引擎、点名消课冲正 | M1, M2, M3 | DONE |
| M5 | 财务中心与审批流模块 (Financial Center) | 3x8 高密度筛选矩阵、动态小计汇总横条、订单营收流水表格、分段状态Tab、多级审批工作流引擎 | M1, M3 | DONE |
| M6 | 系统设置与 RBAC 中台模块 (System Settings) | 5 级组织架构树形管理、4 级细粒度权限勾选树（按钮级控制+半选联动）、4 种数据透视范围管理 | M1 | DONE |
| M7 | 全系统集成、E2E 测试验收与对抗加固 | 跨模块全业务链路联调、顶部校区动态穿透验证、E2E 自动化测试 100% 通过（Tiers 1-4）、对抗加固（Tier 5）、生产打包构建核验 | M1~M6, TEST_READY | DONE |

## Interface Contracts

### 1. Tenant & Campus Context Contract (`useTenantStore`)
```typescript
interface Campus {
  id: string;
  code: string;
  name: string;
  isHeadquarter: boolean;
}

interface TenantState {
  companyId: string;
  currentCampusId: string;
  campuses: Campus[];
  setCampus(campusId: string): void;
}
```

### 2. Curriculum ↔ Student Center Contract
```typescript
interface CourseItem {
  id: string;
  name: string;
  code: string;
  cover: string;
  pricePerLesson: number;
  totalLessons: number;
  subject: string;
  grade: string;
  attribute: 'regular' | 'extended' | 'activity' | 'trial' | 'training';
  status: 'enabled' | 'disabled';
  authorizedCampusIds: string[];
}
```

### 3. Student Center ↔ Educational Administration Contract
```typescript
interface StudentProfile {
  id: string;
  name: string;
  studentNo: string;
  campusId: string;
  status: 'normal' | 'suspended' | 'transferred' | 'dropped_out';
  coursePackages: {
    packageId: string;
    courseId: string;
    courseName: string;
    remainingLessons: number;
    totalLessons: number;
    status: 'active' | 'frozen' | 'refunded' | 'completed';
  }[];
  wallet: {
    principalBalance: number;
    bonusBalance: number;
  };
}

interface ScheduleCollisionParams {
  date: string;
  startTime: string; // '08:30'
  endTime: string;   // '10:00'
  teacherId: string;
  classroomId: string;
  studentIds: string[];
  excludeEventId?: string;
}
```

### 4. Student Center ↔ Financial Center Contract
```typescript
interface OrderCreationPayload {
  studentId: string;
  courseId: string;
  lessonCount: number;
  pricePerLesson: number;
  discountAmount: number;
  actualAmount: number;
  paymentMethod: 'wechat' | 'alipay' | 'bank_transfer' | 'pos' | 'wallet';
  campusId: string;
  orderType: 'regular' | 'quarterly' | 'change_course_diff' | 'refund';
}

interface ApprovalRecord {
  id: string;
  businessType: 'payment' | 'quarterly' | 'refund' | 'transfer';
  sourceId: string;
  applicantName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: number;
  timeline: { step: string; operator: string; comment: string; time: string; status: 'passed' | 'rejected' | 'pending' }[];
}
```

## Code Layout
```
/Users/donghaichao/Desktop/new_xitong/
├── package.json               # 依赖配置与构建脚本
├── tsconfig.json              # TypeScript 编译配置
├── vite.config.ts             # Vite 构建与路径别名配置
├── tailwind.config.ts         # 盛通蓝及设计系统 Token
├── index.html                 # 入口 HTML
├── src/
│   ├── main.ts                # 应用入口
│   ├── App.vue                # 根组件
│   ├── assets/                # 静态图标与资源
│   │   ├── icons/             # 12 个金刚区与业务图标
│   │   └── styles/            # 全局样式与 Token (tokens.css)
│   ├── layout/                # 全局外壳 (Header 60px, Sidebar 220px/64px, Breadcrumb, Tabs)
│   │   ├── MainLayout.vue
│   │   ├── TopHeader.vue
│   │   ├── AppSidebar.vue
│   │   └── CampusSelector.vue
│   ├── router/                # 动态路由配置 (/curriculum, /studentCenter, etc.)
│   ├── stores/                # Pinia 状态库 (tenant, user, schedule, finance)
│   ├── types/                 # 全局 TypeScript 数据契约
│   ├── utils/                 # 工具函数 (conflictEngine, financeCalculator, dateUtils)
│   ├── mocks/                 # 全局统一 Mock 数据中心 (带校区作用域)
│   ├── components/            # 全局通用业务组件
│   │   ├── CapsuleFilter.vue  # 胶囊式过滤器
│   │   ├── HighDensityGrid.vue# 3x8 紧凑筛选矩阵
│   │   ├── SummaryStrip.vue   # 动态小计统计横条
│   │   └── StatusChip.vue     # 排课四色语义 Chip
│   └── views/                 # 5 大核心业务模块页面
│       ├── dashboard/         # 控制台看板 (4 视图与金刚区)
│       ├── curriculum/        # 教研模块 (卡片流、三步向导)
│       ├── studentCenter/     # 学员中心 (全景列表、360抽屉、7状态机)
│       ├── educational/       # 教务模块 (7x15网格排课、冲突检测、考勤)
│       ├── financial/         # 财务中心 (3x8筛选、流水、审批流)
│       └── systemSetting/     # 系统设置 (5级机构树、4级RBAC)
└── tests/                     # 独立 E2E 与业务契约测试套件
    ├── e2e/                   # Opaque-box 端到端测试 (Tiers 1-4)
    └── runner.js              # 自动化测试执行器
```
