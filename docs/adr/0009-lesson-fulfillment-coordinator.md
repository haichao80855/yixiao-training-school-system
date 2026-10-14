# ADR-0009: 统一结课履约协调器 (LessonFulfillmentCoordinator)

## 状态
已接受 (Accepted) - 2026-10-14

## 背景与问题陈述
在「一校教培系统」前序架构中，教务排课的结束环节存在明显的断裂与数据孤岛：
1. **工作台操作割裂**：教师在授课工作台结课时，随堂点名消课（`settleRollCall`）与随堂课评（`commitEvaluation`）位于两个互不联通的独立弹窗中，教师结课平均需要 11 次点击与多次重复录入；
2. **分布式半悬挂风险**：点名消课与课评持久化通过两个独立 HTTP 请求落盘，一旦网络抖动或中途放弃，极易造成“已扣课时但无课评”或“已发课评但未扣课时”的账实不符；
3. **幽灵通知与幽灵课评灾难**：历史的反结课冲正（`reverseRollCall`）仅原路退还课时与恢复排课状态，完全遗漏了关联的 `LessonEvaluation` 实体与处于 `pending` 状态的微信出站信箱（`LessonEvaluationOutbox`），导致“课次已被教务撤销，但微信公众号依然向家长推送该课课评”的幽灵通知严重事故；
4. **缺少非破坏性勘误机制**：当教师仅需修正课评大纲错别字或调整评语时，此前必须执行全量反结课，强行回滚财务课时对账，增加了不必要的财务对账扰动。

## 决策依据与 Design It Twice 推演
我们对该领域接缝进行了充分的「Design It Twice」推演，并在 3 种架构方案中进行了深层融合：
- **方案 A（极简单物理原子事务与级联安全）**：主打单物理原子事务强一致性与幽灵通知彻底作废，坚守退费锁定（ACB RefundLocked）财务防腐屏障；
- **方案 B（生命周期流水线与重开策略）**：引入轻量结课模式枚举（`FULL_SETTLE`、`ATTENDANCE_ONLY`、`PUBLISH_EVALUATION`）与 `REOPEN_EVALUATION` 策略（仅作废旧课评草稿，保持财务课消扣减 100% 不受扰动）；
- **方案 C（面向授课工作台的极速流线）**：通过“默认全员到课、扣 1 课时、自动抽取标准素养大纲、预置 5 星评级”的 Zero-ceremony Happy Path，让 90% 的常规课堂无需逐项修改，1 键即可完成结课与微信推送；仅通过 `anomalyOverrides` 增量传入请假与缺席学员。

经过折中决策，我们采纳：
> **以方案 C 的极速工作台流线为外部接缝，内部吸收方案 A 的物理单原子事务与级联反结课安全防护，并在参数层吸收方案 B 的轻量模式枚举与课评重开策略，构建统一深模块 `LessonFulfillmentCoordinator`。**

## 架构决策与设计

### 1. 外部极简高阶意图接缝
协调器对外仅暴露 3 个高度聚焦任务的高阶意图接口，对外隐藏底层的全部复杂编排：
```typescript
interface LessonFulfillmentCoordinator {
  // 1. 极速工作台智能全景水化
  prepareFulfillmentWorkbench(query: PrepareFulfillmentQuery, scope?: CampusScopeContext): Promise<FulfillmentWorkbenchView>;

  // 2. 一键全量结课履约 (随堂消课 + 随堂课评 + 家长通知)
  fulfillLesson(command: FulfillLessonCommand, scope?: CampusScopeContext): Promise<FulfillmentReceipt>;

  // 3. 级联反结课冲正 (全量原路回滚 / 独立课评重开)
  reverseFulfillment(command: ReverseFulfillmentCommand, scope?: CampusScopeContext): Promise<FulfillmentReversalReceipt>;
}
```

### 2. 物理单原子事务编排 (ACID Single Transaction)
在单个 `prisma.$transaction` 内按严格时序编排：
1. **Regular-First 实付正课优先扣除**：计算课包正课与赠课余额，优先扣除实付正课，耗尽自动跃迁课包为 `completed`；
2. **考勤履约与学情双向渗透**：写入 `AttendanceRecord`，并将星级归一化为百分制得分（98/92/88/80/72）与等第（A+/A/B+/B），评语写回，激活 ADR-0005 学情雷达；
3. **随堂课评持久化**：聚合根 `LessonEvaluation` 与单学员特写项落盘；
4. **不可变快照与 SHA-256 数据指纹**：归档 `LessonEvaluationRevision`，生成 64 位防篡改哈希；
5. **事务性出站信箱灌装**：将到课且绑定微信的学员按幂等键排入 `LessonEvaluationOutbox`（状态 `pending`）；未绑微信学员安全标记为 `skipped_no_openid`；
6. **排课日程状态跃迁**：标记为 `completed`；事务提交后异步非阻塞触发微信出站调度器。

### 3. 双重级联反结课安全屏障 (Zero-Ghost & ACB RefundLocked)
执行反结课冲正时，协调器在单物理事务内提供双重防护：
- **财务防腐屏障 (ACB)**：若关联学员课包已处于 `refunded` 退费归档状态，严格抛出 `RefundLockedException` (HTTP 409 Conflict) 强行阻断，坚决杜绝通过教务冲正复活退费资产；
- **幽灵通知与幽灵课评彻底出清**：
  - 课包课时原路退还与状态复苏；
  - 标记考勤记录 `isReversed = true`；
  - 标记课评 `status = 'revoked'`；
  - **出站信箱中处于 `pending` 状态的所有在途未发通知原子批量置为 `status = 'cancelled'`**，从根本上消灭幽灵通知；
  - 排课日程恢复为 `scheduled`。

### 4. 课评重开独立策略 (REOPEN_EVALUATION)
通过传入 `strategy: 'REOPEN_EVALUATION'`，协调器仅作废旧课评并转为草稿（`draft`）、作废在途信箱通知、重置考勤评语，而**保持底层的学员课时扣减与财务对账 100% 保持不动**，允许教师无痛重新编辑与补录，兼顾教学合规与财务稳定。

## 收益与达标成果

| 核心评估维度 | 方案实施前 (Fragmented Status) | 实施后 (LessonFulfillmentCoordinator) | 架构收益 |
| :--- | :--- | :--- | :--- |
| **工作台交互链路** | 弹窗跳转2次，点击11步 | 统一抽屉开箱即用，**1 键极速交付** | **点击减少 91%** |
| **跨系统数据一致性** | 两个独立请求，存在半悬挂孤岛 | **单物理单原子事务 (ACID)** | **100% 消除半悬挂** |
| **反结课通知风险** | 漏作废信箱，存在幽灵通知事故隐患 | **单事务级联作废 pending 信箱** | **100% 杜绝幽灵通知** |
| **退费课包风控** | 散落逻辑易被反冲复活 | **ACB 财务防腐屏障强阻断** | **100% 资产防腐** |
| **课评勘误扰动** | 必须全额回滚退费才能修改 | **`REOPEN_EVALUATION` 策略独立重开** | **财务扣减 0 扰动** |

## 相关文件与引用
- 统一协调器实现：[lesson-fulfillment.coordinator.ts](file:///Users/donghaichao/Desktop/yixiaoxitong/server/src/modules/educational/domain/lesson-fulfillment.coordinator.ts)
- 领域契约定义：[lesson-fulfillment.types.ts](file:///Users/donghaichao/Desktop/yixiaoxitong/server/src/modules/educational/domain/lesson-fulfillment.types.ts)
- 前端极速工作台组件：[LessonFulfillmentDialog.vue](file:///Users/donghaichao/Desktop/yixiaoxitong/src/views/educational/components/LessonFulfillmentDialog.vue)
- 专项全链路测试：[test-lesson-fulfillment-coordinator.js](file:///Users/donghaichao/Desktop/yixiaoxitong/server/test-lesson-fulfillment-coordinator.js)
- 前序依赖架构决策：[ADR-0005 学情成长档案画像投影](file:///Users/donghaichao/Desktop/yixiaoxitong/docs/adr/0005-learning-growth-projector.md)、[ADR-0008 课评闭环与家长通知协调器](file:///Users/donghaichao/Desktop/yixiaoxitong/docs/adr/0008-lesson-evaluation-coordinator.md)
