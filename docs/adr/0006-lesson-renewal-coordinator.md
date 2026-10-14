# 0006. 课消风控与续费决策协调器（LessonRenewalCoordinator）

- **状态**: Accepted
- **日期**: 2026-10-14
- **决策者**: 架构设计评审组
- **关联候选**: Candidate 03（架构评审报告 `architecture-review-20261014-124140.html`）

---

## 背景与问题陈述 (Context & Problem Statement)

在原有架构中，学员课消预警与续费跟进机制存在显著的规则割裂与履约断层：
1. **魔法数字割裂，双轨分歧严重**：
   - `student.service.ts` 硬编码 `remainingLessons <= 4` (urgent) 与 `<= 8` (warning)；
   - `ClassDetailDrawer.vue` 硬编码 `remainingLessons <= 3` (红色高亮提示)；
   - 导致授课教师在班级抽屉看到的是“正常”，而学管在学员中心看到的却是“紧急”，引发数据与协同信任危机。
2. **多因子流失风控失明 (Single-Dimensional Blindness)**：
   - 仅看剩余课时绝对值，缺少滑动消课流速与耗尽倒计时预测（周均 4 讲 vs 周均 0.5 讲，紧迫性完全不同）；
   - 对“剩余 30 课时但连续 14/30 天未消课休眠”以及“课包临期失效”完全缺乏识别与拦截能力。
3. **风控预警与续费开单履约断层 (Missing Intent Pipeline)**：
   - 预警仅作为一个只读标签，学管发现低课时学员后，需手动退出重入开单向导，重新选择课程、核对原单价并计算折扣，极易发生录错漏单或跟进滞后。

---

## 决策依据与备选方案评估 (Considered Options)

在架构设计（Design It Thrice）中，对比了 3 种架构方案：
- **方案 A（极简 CQS 入口）**：仅暴露 `evaluateHealth` 与 `proposeRenewal` 2 个入口，接口最窄，并直接输出 `visualBadge` 与 `EnrollStudentCommand`；
- **方案 B（规则管道与审计意图）**：解耦 `IRiskRule` 管道插件，支持多因子动态加权归一化与 SHA-256 签名不可变意图凭证；
- **方案 C（面向高频业务工步）**：提供 `diagnoseStudentRisk`、`getCampusRenewalRoster`、`getClassRosterHealth` 与 `createRenewalOrderDraft`，调用端契约直达业务，抹平组装样板。

---

## 最终决策 (Decision Outcome)

决定采用**以「方案 C：面向高频业务工步」为主干骨架，深度融合「方案 B 的多因子规则管道加权与防篡改意图校验」以及「方案 A 的权威视觉语义徽章（`visualBadge`）与开单零胶水对接」的【实用主义高韧性课消风控与续费决策协调器（`LessonRenewalCoordinator`）】**：

1. **核心方法**：
   - `diagnoseStudentRisk(studentId, options)`：单学员 360° 课消全景诊断，闭环滑动 30 天周均速率、耗尽天数推算与停消休眠探测；
   - `getCampusRenewalRoster(campusId, query)`：学管校区批量看护大盘，单次拉取 30 天考勤，内存 Map 分组计算，杜绝 N+1 查询，支持三色预警漏斗分流；
   - `getClassRosterHealth(classId)`：班级花名册消课健康视图，直接下发权威 `visualBadge` 并加权输出班级消课健康指数 `classHealthIndex`；
   - `createRenewalOrderDraft(studentId, options)`：一键生成自洽开单预填草案，强制校验 ACB 财务防腐屏障（拦截已退费/在途退费课包），继承原单价、推算标准规格、CAS 预检班容，直通 `EnrollDialog`。
2. **单一真值源常量**：
   - 全局收敛于 `RENEWAL_RISK_CONSTANTS`：`CRITICAL_LESSONS_THRESHOLD = 4`, `WARNING_LESSONS_THRESHOLD = 8`, `DORMANT_INACTIVITY_DAYS = 14`, `RENEWAL_WINDOW_DAYS = 30`。

---

## 收益与架构影响 (Consequences)

### 积极影响 (Positive)
- **魔法数字彻底清零**：前端与后端 100% 对齐统一 SSOT 预警基准；
- **流失风控多维闭环**：滑动消课流速、停消休眠高危与课包临期失效全量覆盖；
- **续费开单极度顺滑**：一键生成不可变预填草案，班容超编自动退化为待分班，钱包抵扣智能预判；
- **资金风控硬阻断**：杜绝退费冻结课包发起续费错单。

### 权衡与应对 (Trade-offs & Mitigations)
- 增加了批量考勤数据聚合计算量，内部通过 Prisma 批量查询与内存分组处理，在千万级考勤表上建立 `(studentId, isReversed, createdAt)` 联合索引以确保高性能。
