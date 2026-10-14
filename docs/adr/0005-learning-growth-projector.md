# 0005. 学情成长投影深模块（LearningGrowthProjector）

- **状态**: Accepted
- **日期**: 2026-10-14
- **决策者**: 架构设计评审组
- **关联候选**: Candidate 02（架构评审报告 `architecture-review-20261014-124140.html`）

---

## 背景与问题陈述 (Context & Problem Statement)

在原有架构中，授课考勤与学员成长档案之间存在明显的架构接缝断裂与财务资产风控隐患：
1. **反结课冲正盲目复活退费课包**：当教务在授课工作台对历史课次执行反结课冲正（`reverseRollCall`）时，系统无脑将对应课包设置为 `status = 'active'` 并退还学时。若该课包已在财务端退费（`refunded`），反结课会使其非法死灰复燃，破坏退费结账一致性。
2. **随堂学情资产交付断裂**：教师在随堂点名时录入的评语（`comment`）、得分（`score`）与评级（`rating`）落库于 `AttendanceRecord`，但学员档案端点（`student.service.ts -> getStudentProfile`）未作级联结构化投影，前端 `src/api/normalizers/student.ts` 硬编码读取 `raw.learningRecords || []`，导致学员 360° 画像抽屉的成长时间轴恒为空白，教育资产交付沦为数据孤岛。
3. **消课预警规则分散**：全系统散落着 4/8/3 课时的硬编码判定，学管预警与授课看板缺乏权威的单一真值源 (SSOT)。

---

## 决策依据与备选方案评估 (Considered Options)

在架构设计（Design It Twice）中，对比了 3 种架构方案：
- **方案 A（极简 CQS 入口）**：仅暴露 `execute(command)` 与 `project(query)`，接口表面积最小，但判别联合命令组装开销较大；
- **方案 B（事件审计与防腐屏障）**：显式不可变事件与 SHA-256 审计，引入 ACB 防腐屏障，但装配较重；
- **方案 C（面向高频业务工步）**：提供 `settleLessonRollCall`、`reverseLessonSettlement` 与 `getStudentLearningPortfolio`，调用端契约直观，杠杆最高。

---

## 最终决策 (Decision Outcome)

决定采用**以「方案 C：面向高频业务工步」为主干骨架，深度吸收「方案 B 的财务防腐屏障 (ACB) 与消课流失预警」以及「方案 A 的五维能力雷达与纯只读投影」的【实用主义高韧性学情投影深模块（LearningGrowthProjector）】**：

1. **核心方法**：
   - `settleRollCall(input: SettleRollCallInput)`：原子随堂点名消课结算，内聚实付正课优先扣减（`Regular-First`）、出账课包智能嗅探与排课日程状态跃迁；
   - `reverseRollCall(input: ReverseRollCallInput)`：具备财务防腐屏障的反结课冲正，强制校验 `RefundLocked`，对已退费课包坚决强阻断拦截（409 Conflict），杜绝重放刷课并等额原路退还课时；
   - `projectLearningPortfolio(studentId: string, options?)`：纯只读 5 表折叠投影，输出清洗后的学情时间轴、课包进度条、五维能力雷达（`logic`, `creativity`, `focus`, `handsOn`, `expression`）与滑动 30 天周消课速率预警。
2. **数据连通**：
   - 在 `StudentService.getStudentProfile` 中直接调用该深模块，挂载 `learningRecords`、`growthRadar` 与 `consumptionHealth`，彻底治愈前端空白假降级。

---

## 收益与架构影响 (Consequences)

### 긍정적 영향 (Positive)
- **退费课包复活事故率归零**：行级硬阻断保护退费资产生命周期；
- **学情成长资产 100% 贯通**：随堂教师评语与得分直接穿透呈现至学员 360° 成长档案；
- **单一真值源收敛**：预警规则、消课速率与耗尽天数由深模块统一计算，消灭魔法数字；
- **极小接缝与高杠杆**：调用端无需再手动关联 5 张表或在前端写复杂的 reduce 计算。

### 부작용 (Trade-offs / Mitigations)
- 增加了模块间单向装配（`StudentModule` 导入 `EducationalModule`），需严格保证单向依赖，避免循环引用。
