# 一校教培系统 流畅体验改进计划报告

> 评估日期：2026-11-12 ｜ 基线：`main` @ a6af0d9（PR #55 合并后）
> 视角：前端渲染与虚拟化、交互体验、后端算法与架构
> 范围：后台 SPA、老师端 `/teacher`、家长端 H5、NestJS 后端。员工小程序本周期不改，只记录问题。
> 方法：静态阅读代码，并抽查关键结论。抽查确认的有：
> - 工作台「缺勤显示 -1.0、实际提交 0」：`workbench.vue:480` 对比 `:892`
> - 排课页请求不带日期范围：`timeSchedule.vue:579`
> - schema 里只有 9 个 `@@index`
>
> 本次没有做线上测速，目前也没有任何耗时数据（见 B-7），所以第 0 期先补测量。

## 实施进度

| 期 | 状态 | 说明 |
|---|---|---|
| 第 0 期 测量基线 | 已完成（前端埋点除外） | 后端慢请求和慢查询日志、`Server-Timing` 响应头、`npm run bench` 压测（临时库，3 档数据量），结果见 [perf-baseline.md](perf-baseline.md)。前端 `performance.mark` 埋点推迟到第 3 期和请求层改造一起做 |
| 第 1 期 止血 | 已完成 | 见下方「第 1 期实际改动」 |
| 第 2–4 期 | 未开始 | |

**第 0 期测出的新情况：** 点名工作台快照在 10 倍数据下要 8.6 秒、返回 29 MB，带上日期也一样慢。这是第 2 期最先处理的问题。

**第 1 期实际改动：**
- **后端「先认领再执行」**
  - 结课（`settleRollCall`、老师端结课）、审批每一级、提现，都在事务的第一步用条件更新认领当前状态。并发的第二个请求认领失败后直接返回 400 或 409，不会重复扣课、重复推进审批或把余额扣成负数。
  - 以前的状态检查都在事务外面，**实测并发两次点名会扣两次课时**，审批终审也可能执行两次退费结算。这两个问题都是第 1 期新发现的，原清单里没有。
- **充值和提现的幂等键**
  - 新增 `IdempotencyRecord` 表（新表，`db push` 不影响已有数据），由 `runIdempotent` 统一处理。
  - 前端打开表单时生成一个键，同一个键只执行一次，之后的重试返回第一次的结果。
- **前端提交保护**
  - 新增 `useSubmit`，用在充值、提现、审批、服务费、工作台消课这几处：提交中锁定按钮。
  - 充值、提现、消课在提交前弹框复述金额或课时。
  - 充值金额不再预填 ¥2000。
- **A-4、A-5**
  - 工作台的扣课显示改成和提交逻辑一致（缺勤显示 0）。
  - 点名弹窗先清空名单再打开，名单加载完成前不能提交。
- **A-6（调整）：** 老师端幂等键暂不改。后端的「幂等重放」分支会把整套结课再执行一次，改成固定的键反而可能重复扣课。现在由后端认领保证只结课一次，重放分支留到第 2 期一起修。
- **A-7**
  - 班级列表、审批列表改为后端分页和筛选，标签数量和摘要由后端按全部数据统计；审批页默认显示「待我审批」。
  - 下拉框统一取 200 条；受让学员和报考学员的选择改为后端搜索。
  - 报名弹窗的课程以前只取到 10 门，现在修好了。
- **新发现：审批列表以前不按校区限定，执行校长能看到其他校区的单据。** 现在按校区限定。
- **A-8：** 班级的状态筛选和搜索框传给后端；排课页的课程、教务班主任筛选生效。
- **A-9：** 统一响应包装时，删掉所有 `password` 字段（`stripSecrets`）。
- **回归测试**
  - 后端：`server/test-double-submit-guards.js`，29 项。去掉认领逻辑后，并发点名那一项会失败。
  - 前端：`tests/unit/submit-guards.spec.ts`。

## Context
系统目前数据量不大（开发快照：60 名学员、480 节排课），首屏也已经优化过（PR #36，182.5 KB gzip），所以现在用起来不慢。

但很多查询的耗时会随历史数据一直增长。原因是三处「全量加载」：
- 排课、点名工作台、上课记录都会把全部历史拉下来；
- 主要业务表没有索引；
- SQLite 用的是默认回滚日志模式，而不是 WAL。

半年到一年后，最常用的几个页面会先变慢。

另外，交互层有几处问题会直接影响钱和课时：
- 充值、提现、审批可以连点重复提交；
- 工作台显示的扣课数和实际提交的不一致。

这份报告的目标是：**先止住错误和重复提交，再把耗时从「随历史增长」降到「只和当前页的数据量有关」，最后打磨交互细节**。每一项都给出量化的验收标准。

---

## 一、执行摘要

| 维度 | 评分 (1–5) | 结论 |
|---|---|---|
| 首屏加载 | 4 | 按需引入、预压缩、哈希资源长缓存都做了。缺页面切换的加载提示 |
| 列表渲染与虚拟化 | 2 | 没有虚拟滚动；3 个核心页面一次加载全部历史；还有 9 处列表被后端默认分页**悄悄截断** |
| 交互反馈 | 2 | 老师端做得好（骨架屏、自动保存、下拉刷新）。后台的资金和课时操作缺少按钮加载态、重复提交保护和错误态 |
| 状态保持 | 2 | 后台页面不缓存，筛选条件不写进 URL，返回或刷新后都丢失；家长端每次返回都回到第一页 |
| 后端查询 | 2 | 主要表没有外键和热点字段索引；看板和汇总在 JS 里聚合；没有缓存 |
| 并发与写入 | 2 | SQLite 未开 WAL、没有 busy_timeout；约 30 个事务在锁里逐行查询 |
| 可观测性 | 1 | 没有接口耗时日志和慢查询日志，无法量化「慢」 |

**一句话：** 首屏不用再优化；要做的是「数据越多越慢」的结构问题和「点了没反应 / 点两次」的交互问题。

---

## 二、问题清单

### A. 正确性与数据安全（P0，直接影响钱和课时，最先做）

| # | 问题 | 证据 | 影响 |
|---|---|---|---|
| A-1 | 充值、提现按钮没有加载态、没有二次确认、没有幂等键；表单默认 ¥2000 + ¥200 赠送，且保留上次填写的值 | `StudentProfileDrawer.vue:453, 466, 704-742` | 连点一次就重复充值或提现 |
| A-2 | 退费审批的「确认通过 / 驳回」没有加载态；弹窗要等保存加全量刷新完成才关闭，期间一直可以点 | `approvalFlow.vue:255, 293, 502-515` | 同一审批可能被推进两级 |
| A-3 | 服务费保存、工作台「确认打卡消课」同样可以连点 | `serviceFee.vue:249, 267`；`workbench.vue:492` | 重复扣课 |
| A-4 | 工作台缺勤显示 **-1.0**，实际提交扣 0 | `workbench.vue:480` 对比 `:892` | 屏幕显示和真实扣课不一致 |
| A-5 | 点名抽屉打开时不清空上一节课的名单，加载期间可以提交 | `RollCallDrawer.vue:166-182` | 把上一节课的名单提交到当前课 |
| A-6 | 老师端幂等键里带 `Date.now()`，每次重试都是新键 | `src/api/modules/teacherPortal.ts:300, 343` | 后端无法识别重试，幂等失效 |
| A-7 | 列表被后端默认分页**悄悄截断**：班级最多 20、审批最多 20、服务费学员选择最多 10、课程最多 10，而且页面没有分页器 | `classManagement.vue:578`、`approvalFlow.vue:399`、`serviceFee.vue:305`、`QuickScheduleDialog.vue:186`、`AbnormalMovementDialog.vue:348` 等 9 处 | 数据一多就「查不到」，而且审批页的标签计数是错的 |
| A-8 | 班级状态筛选、搜索框没有传给后端；排课页的「顾问 / 课程」筛选也不生效 | `educational.controller.ts:121-136`；`classManagement.vue:511`；`timeSchedule.vue:478-479` | 筛选控件点了没有效果 |
| A-9 | 部分接口把老师 `User` 整行（**含 bcrypt 密码哈希**）返回给前端 | `educational.service.ts:234`、`:827`；`lesson-settlement.engine.ts:137, 178` | 安全问题。和 B-3 精简 include 一起处理 |

### B. 后端：耗时会随历史数据增长（P0/P1）

**B-1 主要表没有索引（P0）**

SQLite 和 Prisma 都不会自动给外键建索引。`ScheduleEvent`、`AttendanceRecord`、`StudentCoursePackage`、`Student`、`Order`、`Class` 的 `campusId`、日期和外键全部没有索引。

影响：
- 每一层 `include`、每个关系过滤都是全表扫描；
- 数据权限中间件注入的 `campusId` 条件也是全表扫描；
- 级联删除时也会全表扫描子表。

需要新增的索引：

| 表 | 索引 |
|---|---|
| `ScheduleEvent` | `[campusId, date, startTime]`、`[classId, date]`、`[teacherId, date]` |
| `AttendanceRecord` | `[scheduleEventId]`、`[studentId, createdAt]`、`[packageId]` |
| `StudentCoursePackage` | `[studentId, status]`、`[classId, status]` |
| `Student` | `[campusId, createdAt]` |
| `Order` | `[campusId, createdAt]`、`[studentId, status]` |
| `Class` | `[campusId, status]`、`[teacherId]` |

另外给 `ParentReadState.scheduleEventId`、`WalletLedger.studentId`、`ApprovalNode.approvalFlowId`、`StaffNotificationRead` 等补单列索引。

两份 schema 要同时修改：`schema.prisma` 和 `schema.sqlite.prisma`（后者已经和前者不一致，缺 `grade`、`StudentArchiveMedia`，要顺便对齐）。

**B-2 三处接口在没有日期条件时返回全部历史（P0）**

- 点名工作台快照会加载该校区所有上课记录，带 4 层 include，然后在 JS 里分组：`lesson-settlement.engine.ts:149-185`。不带 `studentId` 的 `GET /attendances` 也走这条路径。
- `getSchedules` 不带日期时返回全部排课；`resolveLessonSequence` 还会再加载这些班级的全部排课：`educational.service.ts:537-616`。
- 前端三个核心页面正是这样调用的：
  - 排课页 `timeSchedule.vue:579` 一次拉全部排课，切换周时不重新请求；
  - 点名页 `attendance.vue:349` 拉全部排课后只按某一天过滤；
  - 工作台清空日期时加载全部，日历上的圆点也用完整数据来计数（`workbench.vue:660-708`）。

**B-3 列表和统计在 JS 里聚合（P1）**

| 位置 | 现状 |
|---|---|
| 学员列表 `student.service.ts:113-155` | 按预警筛选时不在数据库分页，全校区学员连同课包、钱包和 4 个 `_count` 一起加载 |
| 学员统计 `student.service.ts:278-289` | 每页都对上课、订单、异动表做计数，这些子表都没有索引 |
| 后台看板 `admin-dashboard.aggregator.ts:139-228` | 加载时间范围内全部上课记录（3 层 include），在 JS 里求和 |
| 订单列表 `financial.service.ts:221-237` | 每翻一页都用两次不分页的 `findMany` 算汇总 |
| 续报名单 `lesson-renewal.coordinator.ts:518` | 为了取「最后上课日期」加载全部上课记录 |
| 班级列表 `educational.service.ts:193-250` | include 全部排课和全部课包，只是为了算摘要 |

改法：改用 SQL `groupBy` / `_sum` / `_max`。看板加 30–60 秒的内存缓存，或者建按天汇总表。

**B-4 SQLite 并发配置（P0）**
- 现状：journal_mode=delete，没有 busy_timeout，`PrismaService` 没有任何配置（`server/src/prisma/prisma.service.ts:9`）。在这种模式下，写事务提交时会阻塞所有读请求。
- 约 30 个 `$transaction` 在事务里逐个学员循环查询和写入。例如结课 `lesson-settlement.engine.ts:479-600`：12 个学员大约要 60–80 次串行往返，期间一直占着写锁。
- 改法：
  - 启动时执行 `PRAGMA journal_mode=WAL; synchronous=NORMAL; busy_timeout=5000`；
  - 循环查询改成事务外预取，写入改用 `createMany` / `updateMany`。

**B-5 N+1 和响应前的同步等待（P1）**

N+1：
- 批量排课时每个时段都查一次老师：`batch-scheduling.coordinator.ts:225`；
- 「全部已读」逐条 upsert：`staff-notification.service.ts:176-183`；
- 组织树逐层查询：`system.service.ts:963`。

响应前同步等待：
- 结课和课评之后，等站内通知写完才返回响应：`lesson-fulfillment.coordinator.ts:876`、`lesson-evaluation.coordinator.ts:876`。应改为后台执行，不阻塞响应。

数据权限中间件：
- 每次按 id 的 update / delete 都多一次 `findUnique`，而且用的是根 client 而不是事务 `tx`（`prisma-scope.middleware.ts:80-96`）。在 SQLite 上它会和正在进行的写事务抢锁。

**B-6 每个请求的固定开销（P2）**

每个请求：
- JWT 校验每次都加载用户、角色、权限，大约 6 条 SQL（`jwt.strategy.ts:72-90`）；超管会返回上百行权限。改法：按 userId 缓存 60 秒，角色或权限变化时失效。

每个响应：
- `MediaLinkInterceptor` 深拷贝整个响应和请求体（`media-link.interceptor.ts:28-64`）。改法：只处理带媒体字段的路由。
- `TransformInterceptor` 给每个响应加 `timestamp`（`transform.interceptor.ts:26`），所以 ETag 永远不会命中，拿不到 304。

上传：
- 视频整段读进内存，同步计算 SHA-256（`media-upload.coordinator.ts:147`），会阻塞事件循环 100–300 ms。改法：存到磁盘，流式计算哈希。

**B-7 可观测性为零（P0，前置条件）**

没有接口耗时日志、没有 Prisma 慢查询日志，健康检查只执行 `SELECT 1`。不先补这些，就无法验证任何优化有没有效果。

### C. 前端渲染与虚拟化（P1）

| # | 问题 | 证据 | 改法 |
|---|---|---|---|
| C-1 | 排课周视图在模板函数里过滤：每次渲染 7 次 × N 条过滤再分泳道；按教室和按老师视图每个函数调用两次 | `timeSchedule.vue:233, 303-352, 613-655` | 用 `computed` 一次算出 `Map<day, lanes>` 和 `Map<room/teacher, events>`；数据放进 `shallowRef` |
| C-2 | 排课汇总表、点名历史表没有分页，也不限高度，所有行都渲染 | `timeSchedule.vue:371`、`attendance.vue:191` | 服务端分页。必须长列表时用固定高度的 `el-table-v2` 虚拟表格（超过 200 行时） |
| C-3 | 大数组都是深层响应式（整个 `src/views` 只有 1 处用了 `shallowRef`） | `timeSchedule.vue:566`、`attendance.vue:201`、`workbench.vue`、`chargingLedger.vue:312`、`approvalFlow.vue:390` | 只读的服务端列表统一改用 `shallowRef` |
| C-4 | 请求层没有超时、没有取消，后返回的旧请求会覆盖新数据。`useLoadState` 只保护 loading 状态，不保护数据 | `src/utils/request.ts`、`src/composables/useLoadState.ts:19-31`、`orderManagement.vue:762` | `request.ts` 加 AbortController 和 15 秒超时；`useLoadState` 加请求序号，数据只认最新一次请求 |
| C-5 | 本地筛选每次按键都重新计算 | `chargingLedger` 的 `displayLedgers`、`dictSetting`、`EmployeeTablePanel` | 统一 300 ms 防抖（参照 `allStudent.vue` 的做法），并改为服务端筛选 |
| C-6 | 后台 `<img>` 没有懒加载，课评照片在 80 px 缩略格里加载原图 | `CourseManageView.vue:157`、`LessonEvaluationDialog.vue:359`、`LessonFulfillmentDialog.vue:239`、`unassigned.vue:118` | `loading="lazy"`，并使用 `thumbnailUrl` |
| C-7 | 排课页有一直在播放的 `animate-ping/pulse` 动画；「当前时间线」的 computed 没有响应式依赖，线一直不动 | `timeSchedule.vue:104, 139, 523` | 去掉无限循环动画；时间线改用每分钟更新一次的 `now` ref |
| C-8 | 看板首屏有 7 个请求，其中两次是重叠的完整排课请求，只用来计数；顶栏另外还发 3 个请求 | `dashboard/index.vue:405-414`、`TopHeader.vue:256-283` | 后端提供计数接口；前端合并成一个看板接口 |

**不做：**
- 首屏体积已经到 187 KB 的上限，不再压缩。
- `MainLayout` 保持静态引入。实测懒加载会慢 160–180 ms，这是 AGENTS.md 里的约定。

### D. 交互体验（P1/P2）

| # | 问题 | 证据 | 改法 |
|---|---|---|---|
| D-1 | 加载失败时显示「暂无数据」，用户以为没有数据；看板在 `finally` 里提示「数据已刷新」，失败了也提示，还人为延迟 400 ms | `allStudent.vue:126`、`orderManagement.vue:218`、`dashboard/index.vue:458-466`；只有 9 个页面用了 `useLoadState` | 所有列表页统一接入 `useLoadState`：骨架 → 数据 / 空 / 错误加「重试」 |
| D-2 | 点了没有反应：点排课格子、点「签到」后要等一次请求才弹窗；报名弹窗先显示旧的默认值，加载完再跳变 | `QuickScheduleDialog.vue:288`、`workbench.vue:856`、`EnrollDialog.vue:341` | 先打开弹窗并显示骨架，选项在后台加载；页面加载时预取选项 |
| D-3 | 保存后整表重新加载，表格闪一下（约 100 处全量刷新，原地更新只有 16 处）；工作台本地更新后又刷新一次 | `classManagement`、`allStudent`、`workbench.vue:814-843`；`timeSchedule.vue:154` 整张周视图变暗 | 编辑单行时原地替换；新增或删除时静默刷新（保留旧数据，不显示遮罩） |
| D-4 | 页面切换：`out-in` 过渡要等 200 ms 离场动画结束，新页面才开始请求；下载页面代码时没有任何进度提示 | `MainLayout.vue:40`、`tokens.css:90`、`router/index.ts` | 过渡改为只淡入新页面（不等离场），时长 ≤ 120 ms；顶部加 2 px 进度条（自己写，不引依赖） |
| D-5 | 后台状态丢失：页面不缓存，筛选和页码不在 URL 里（只有课酬页写了月份） | `MainLayout.vue:39-44`；`TagsView` 写了但没有挂载 | 列表页的筛选、页码、周写进 URL query（抽成 `useRouteQueryState`）；学员、订单、审批列表加 `KeepAlive`（include 白名单，max 5，和切换校区时的 key 配合） |
| D-6 | 表单：只有 7 个表单用 `:rules`；32 处用 toast 提示「请…」；按 Esc 会直接丢掉多步表单；没有自动聚焦 | `CourseEditorDialog.vue:678`、`EnrollDialog`、`StudentFormDialog`、`LessonEvaluationDialog` | 字段级校验；多步和长表单在有修改时拦截关闭；打开时聚焦第一个字段；报名和课评草稿暂存（参照老师端 `evaluationDraft.ts`） |
| D-7 | 退费预览金额变化时没有加载提示，确认框也不复述金额；审批页默认显示「全部状态」 | `AbnormalMovementDialog.vue:480, 645`、`approvalFlow.vue:383` | 预览时显示加载态，确认框写明「退 ¥X，扣 N 课时」；审批页默认显示「待我审批」 |
| D-8 | 家长端：切换标签用 `redirectTo` 重建整页；返回时列表回到第一页；网络错误时显示开发者文案「请确认 3001 端口…」；分享页把所有错误都当成链接过期，还写死了「5 星好评」 | `ParentTabBar.vue:44`、`evaluations/index.vue:158`、`mini-program/src/utils/request.ts:113`、`ParentGrowthReportView.vue:9-40` | 用 tabBar 或 switchTab 保留各页实例；`onShow` 只在数据过期时静默刷新；错误文案面向家长并提供重试；分享页区分「过期」和「网络错误」，去掉写死的文案 |
| D-9 | 默认值不对：快速排课在早上 8 点前默认日期是昨天（用了 UTC）；报名默认选中第一个学员和第一门课 | `QuickScheduleDialog.vue:316-324`、`EnrollDialog.vue:366` | 按北京时间计算日期；不预选，由用户选择 |
| D-10 | 文案里有后端术语，如「落盘 / 落库 / 已真实扣减」（18 处） | 各页面 | 改成用户能看懂的说法 |

做得好、要保持的：
- 老师端：骨架屏、旧数据续显、自动保存、下拉刷新、滚动位置恢复、44 px 触控区域、离开前提醒；
- 尊重系统的「减少动态效果」设置；
- 家长端：缩略图、懒加载、游标分页。

---

## 三、目标与度量（「流畅」的量化定义）

| 指标 | 定义 | 目标 |
|---|---|---|
| 交互响应 | 点击到出现视觉反馈（按钮加载态、弹窗、骨架） | ≤ 100 ms，所有操作 |
| 接口 p95 | 按路由统计（B-7 上线后采集） | 列表 ≤ 150 ms，看板 ≤ 300 ms，写操作 ≤ 300 ms |
| 耗时随数据增长 | 用 10 倍数据压测：10 万条上课记录、1 万条排课、3000 名学员 | 核心接口 p95 增长 ≤ 30% |
| 页面切换 | 点菜单到新页面出现骨架 | ≤ 150 ms（不再等 200 ms 离场动画） |
| 滚动 | 排课周视图、长表格的长任务 | 没有超过 50 ms 的长任务；周视图切换 ≤ 16 ms/帧 |
| 首屏 | 现有门禁 | 保持 ≤ 187 KB gzip |
| 重复提交 | 资金和课时按钮并发点击 2 次 | 只生效 1 次（结合测试计划第 4 期的并发测试） |
| 状态保持 | 详情页返回或刷新列表页 | 筛选、页码、滚动位置都不丢失 |

---

## 四、改进路线图

### 第 0 期：测量基线（约 1 天）
- 后端加全局计时拦截器，日志按 `method route status ms` 输出，超过 300 ms 记为 warn。Prisma 加 `$on('query')`，超过 100 ms 的查询记为慢查询。
- 新增造数脚本 `scripts/seed-load.cjs`，只写临时库，用于 10 倍数据压测。另写 `scripts/bench-api.cjs`，对 15 个核心接口各请求 50 次，输出 p50 和 p95。两个脚本都复用 `tests/isolated-env.cjs` 的临时环境。
- 前端加 `performance.mark` 埋点，记录路由开始、骨架出现、数据渲染完成；只在开发环境打印。
- **验收：** 产出一份基线报告 `docs/perf-baseline.md`，包含当前数据量和 10 倍数据量下的 p95。

### 第 1 期：止血（约 3 天，A 类全部）
- 新增 `useSubmit` 组合式函数：自动处理 loading、防重入、错误提示。所有资金和课时按钮（A-1/2/3）改用它，充值和提现补二次确认并带上幂等键。
- 修 A-4（显示的扣课数改为和提交逻辑一致）、A-5（打开时清空名单，加载期间禁止提交）、A-6（幂等键改为每次操作生成一次，重试时复用）。
- A-7：班级、审批页改为服务端分页；下拉框统一调用轻量的 `options` 接口（只返回 id 和 name，有上限并支持搜索）。
- A-8：补上筛选参数，或删掉不生效的控件。
- A-9：老师和顾问统一用 `select { id, name, avatar }`。
- **验收：** 每一项都有回归测试（后端并发测试 + Vitest 组件测试）；资金和课时按钮连点 2 次只生效 1 次。

### 第 2 期：后端结构优化（约 5 天，B-1~B-5）
- 加索引（两份 schema 同步），通过 `db push` 上线。上线前用生产快照验证 push 不会丢数据。
- 启用 WAL、busy_timeout，`synchronous=NORMAL`。
- 工作台快照、`getSchedules`、`/attendances` **默认要求日期范围**，不传时默认取最近 N 天或本周；历史数据分页返回。
- 看板、订单汇总、学员统计、续报名单改用 SQL 聚合；看板加 60 秒缓存，写操作后按校区让缓存失效。
- 结课类事务改为事务外预取、批量写入；站内通知改为后台执行；数据权限中间件的检查改用事务 `tx`。
- 新增日历计数接口 `GET /schedules/counts?start&end`（按天计数）。
- **验收：** 10 倍数据下核心接口 p95 达到第三节的目标；后端全部测试通过；用 `EXPLAIN QUERY PLAN` 抽查热点查询，确认走了索引。

### 第 3 期：前端渲染与请求层（约 4 天，C 类）
- `request.ts`：超时、AbortController、路由切换时取消上一页的请求；`useLoadState` 加请求序号。
- 排课页：按周请求（换周时重新拉取，并预取相邻一周），用 Map 预先分组，`shallowRef`，去掉无限动画，修好时间线。
- 点名页、工作台：按日期或日期范围请求；日历圆点改用计数接口。
- 长表格分页；必须长列表时用 `el-table-v2`（新增组件要确认首屏体积不变）。
- 图片懒加载和缩略图；看板改为一个接口返回。
- **验收：** 排课周视图换周 ≤ 16 ms/帧（Performance 面板），没有超过 50 ms 的长任务；首屏 ≤ 187 KB。

### 第 4 期：交互打磨（约 5 天，D 类）
- 统一加载态：所有列表页接入 `useLoadState`，模式为骨架 → 数据 / 空 / 错误加重试；刷新时保留旧数据，不显示遮罩。
- 先开弹窗再加载、保存后原地更新、页面切换只淡入加顶部进度条。
- 用 `useRouteQueryState` 把筛选和页码写进 URL；常用列表页加 `KeepAlive` 白名单。
- 表单：字段级校验、修改后拦截关闭、自动聚焦、报名和课评草稿暂存。
- 退费确认写明金额；审批页默认「待我审批」；日期按北京时间；文案去掉后端术语。
- 家长端：保留标签页实例、返回时恢复滚动位置、面向家长的错误文案和重试、分享页修正。
- **验收：** 5 条关键流程（点名、报名收费、排课、退费审批、家长查看报告）每一步点击后都在 100 ms 内有反馈；浏览器冒烟测试（`tests/smoke/`）补上「返回后筛选还在」「失败后可以重试」的断言。

总计约 18 个工作日。**每期一个 PR**，合并后由你决定是否部署。

---

## 五、风险与约束
- **索引上线：** SQLite 的 `db push` 加索引不会丢数据，但部署时要先备份（部署脚本已经自动备份）。Postgres 的 schema 一起改，留作以后迁移用。
- **默认日期范围会改变接口行为。** 要同时检查 dist 里的小程序和家长端是否调用了这些接口而且不带日期。小程序本周期不改，所以后端只在请求「没有 `campusId` 以外的任何条件」时才收紧，保持兼容。
- **KeepAlive 和切换校区重建页面的 key 有冲突。** 缓存的 key 要包含校区，否则会显示其他校区的数据。
- **这份报告不包括：** 改用 Postgres、引入 Redis 或消息队列、服务端渲染（单机加 SQLite 在当前规模下够用，等第 0 期的数据证明不够再考虑）。

---

## 六、实施时的文件要点

**新增：**
- `src/composables/useSubmit.ts`
- `src/composables/useRouteQueryState.ts`
- `src/components/RouteProgress.vue`
- `server/src/common/interceptors/timing.interceptor.ts`
- `scripts/seed-load.cjs`
- `scripts/bench-api.cjs`
- `docs/perf-baseline.md`
- 本报告：实施时放到 `docs/perf-improvement-plan.md`

**修改（代表性文件）：**
- `server/prisma/schema.prisma`、`schema.sqlite.prisma`
- `server/src/prisma/prisma.service.ts`（PRAGMA 和慢查询日志）
- `lesson-settlement.engine.ts`、`educational.service.ts`、`student.service.ts`、`admin-dashboard.aggregator.ts`、`financial.service.ts`、`prisma-scope.middleware.ts`
- `src/utils/request.ts`、`src/composables/useLoadState.ts`
- `timeSchedule.vue`、`attendance.vue`、`workbench.vue`、`approvalFlow.vue`、`StudentProfileDrawer.vue`、`RollCallDrawer.vue`、`MainLayout.vue`
- 家长端 `ParentTabBar.vue`、`evaluations/index.vue`、`mini-program/src/utils/request.ts`

**复用：**
- `allStudent.vue` 的请求序号和防抖写法
- 老师端的 `useLoad.ts` / `evaluationDraft.ts` / `usePullToRefresh.ts`
- `tests/isolated-env.cjs`（压测环境）
- `scripts/check-bundle-size.cjs`（体积门禁）

## 七、验证
1. 每期都跑 `npm run test:all`、`npm run test:unit`、`npm run build && npm run check:bundle`，CI 必须全绿。
2. 第 0 期的 `bench-api.cjs` 在每期结束后重新跑，用 10 倍数据和基线对比，结果写进 `docs/perf-baseline.md`。
3. 在浏览器面板里用 Performance 面板录制排课页换周和工作台点名，检查长任务和帧耗时。
4. 用 `npm run test:smoke` 跑 6 条冒烟流程；第 4 期补上状态保持和错误重试的断言。
5. 部署后在线上看计时日志的 p95，对照第三节的目标。
