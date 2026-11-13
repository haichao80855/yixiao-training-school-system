# 后台页面权限矩阵

由 `tests/unit/route-access-matrix.server.spec.js` 生成：用种子账号登录真实后端，再用真实的路由和 `canAccessRoute` 判断。
✓ = 能打开 (菜单里也显示)，· = 打不开 (菜单里不显示，直接输入地址会回到首页)。

| 页面 | 路径 | 集团超管 | 执行校长 | 财务 | 任课老师 | 课程顾问 |
|---|---|:-:|:-:|:-:|:-:|:-:|
| 教研中心 · 课程研发管理 | `/curriculum/courseManage` | ✓ | ✓ | · | ✓ | · |
| 教研中心 · 课次进度大纲 | `/curriculum/lessonPlan` | ✓ | ✓ | · | ✓ | · |
| 教研中心 · 资源平台课程库 | `/curriculum/platformCourse` | ✓ | ✓ | · | ✓ | · |
| 教研中心 · 科目体系设置 | `/curriculum/subject` | ✓ | ✓ | · | ✓ | · |
| 控制台看板 | `/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |
| 教务中心 · 授课点名消课 | `/educational/attendance` | ✓ | ✓ | · | · | ✓ |
| 教务中心 · 班级与班容管理 | `/educational/classManagement` | ✓ | ✓ | · | · | ✓ |
| 教务中心 · 7×15 排课时间看板 | `/educational/timeSchedule` | ✓ | ✓ | · | ✓ | ✓ |
| 教务中心 · 教学服务 - 讲台 | `/educational/workbench` | ✓ | ✓ | · | ✓ | ✓ |
| 财务中心 · 业务审批工作台 | `/financial/approvalFlow` | ✓ | ✓ | ✓ | · | · |
| 财务中心 · 收费流水账本 | `/financial/chargingLedger` | ✓ | ✓ | ✓ | · | · |
| 财务中心 · 订单营收流水 | `/financial/orderManagement` | ✓ | ✓ | ✓ | · | · |
| 财务中心 · 老师课酬 | `/financial/teacherPay` | ✓ | ✓ | · | · | · |
| 学员中心 · 全部学员全景 | `/studentCenter/allStudent` | ✓ | ✓ | · | · | ✓ |
| 学员中心 · 服务费代报考 | `/studentCenter/serviceFee` | ✓ | ✓ | · | · | ✓ |
| 学员中心 · 待分班学员池 | `/studentCenter/unassigned` | ✓ | ✓ | · | · | ✓ |
| 系统设置 · 组织架构与机构 | `/systemSetting/authoritiesInfo` | ✓ | ✓ | · | · | · |
| 系统设置 · 业务参数字典 | `/systemSetting/dictSetting` | ✓ | ✓ | · | · | · |
| 系统设置 · 4级RBAC角色管理 | `/systemSetting/roleManagement` | ✓ | · | · | · | · |
| **能打开的页面数** | | **19** | **18** | **4** | **7** | **8** |
