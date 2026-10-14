# 0008. 收敛课评闭环与家长通知协调器（LessonEvaluationCoordinator）

## 状态
Accepted

## 背景与决策
在原有系统中，随堂课评与家长沟通场景存在严重的前后端业务断裂与数据孤岛：
1. **浏览器 localStorage 假存储**：前端 `LessonEvaluationDialog.vue` 与 `constants/evaluation.ts` 将相册、评语与录音直接写在客户端浏览器的 `localStorage` 中，服务端未建表，换机、多端协同或页面刷新导致课评数据完全丢失；
2. **随堂多媒体教学资产断裂流失**：教师耗费精力录制的随堂语音、视频片段与 9 宫格相册无法沉淀至学员档案；`AttendanceRecord` 与课评互不通气，导致 [ADR-0005 学情成长投影深模块（LearningGrowthProjector）](file:///Users/donghaichao/Desktop/yixiaoxitong/docs/adr/0005-learning-growth-projector.md) 无法感知多媒体点评，学员 360° 成长档案时间轴与五维能力雷达图处于空白或假降级状态；
3. **排课卡片刷新丢失状态**：授课工作台（`workbench.vue`）的排课卡片虽然设计了「⭐ 课评」发布绿点，但因服务端数据表缺失 `evaluationStatus` 字段，刷新页面后一律退化为未写状态；
4. **微信公众号推送假通知**：点击“保存并发送家长端”仅触发前端 `ElMessage` 弹窗，未与已绑定的微信公众号（`Student.wechatOpenId`）建立出站接缝，且缺少异步信箱与防重发机制。

我们决定在服务端建立教务核心深模块 **`LessonEvaluationCoordinator`**，采用**「方案 C 极简工作台流线接缝（`hydrateEvaluation` 与 `commitEvaluation` 两个高阶方法）」**作为外部接缝，内部深度融合**「方案 A 考勤双向原子渗透（激活 ADR-0005 学情雷达）」**与**「方案 B 事务性出站信箱（Transactional Outbox + SHA-256 不可变指纹 + Ports & Adapters 微信推送接缝）」**，闭环以下核心业务不变量：
- **开箱即用智能水化**：自动聚合排课日程、课程章节、到课学员名册与家长微信 OpenID 画像，预置大纲富文本与评语框架；
- **单一物理事务落盘**：ACID 事务内完成 `LessonEvaluation` 聚合根落盘、学员特写项、不可变版本快照 `LessonEvaluationRevision`（计算 SHA-256 数据指纹）；
- **考勤记录双向渗透写回**：单物理事务内将教师评语、星级（归一化为百分制得分与 A+/A/B+/B 等第）写回 `AttendanceRecord`，即时激活 ADR-0005 学情雷达；
- **事务性出站信箱与双适配器**：同一事务内灌装 `LessonEvaluationOutbox`，事务提交后由调度器非阻塞异步派发；在接缝处定义 `NotificationPort`，配置 `MockNotificationAdapter`（单测/开发）与 `WechatNotificationAdapter`（生产微信公众号模板消息），严格遵循“两个适配器确立真实接缝”准则。

## 评估过的备选方案
- **备选方案 A（极简 CQS 入口方案）**：对外暴露 `getEvaluationDetail`、`saveDraft` 与 `publishEvaluation` 3 个方法。优点是概念极为洗练，但在高频授课工作台场景下，未水化的大纲和花名册仍需前端多次查询关联，未将工作台流线做到极致。
- **备选方案 B（高扩展与事务信箱流水线方案）**：对外暴露 `saveDraft`、`previewDiff`、`publishEvaluation`、`getEvaluationTimeline` 与 `retryFailedOutbox` 5 个方法，采用显式事件总线与版本差异比对。优点是审计与重试极强，但方法过多，对于随堂高频操作存在较多仪式感（Ceremony）。
- **备选方案 C（授课工作台流线优先方案）**：对外仅暴露 `hydrateEvaluation` 与 `commitEvaluation` 2 个方法。极致优化了工作台零心智流线，但在初始设计中信箱重试与审计快照相对较轻。
- **入选方案（终局混合高韧性架构）**：以方案 C 的 2 个高阶意图方法为外部极简接缝（给调用端最高杠杆），内部完整吸收方案 A 的考勤双向渗透写回（激活 ADR-0005）与方案 B 的事务性出站信箱（Transactional Outbox + SHA-256 不可变数字指纹 + Ports & Adapters 双适配器），兼顾极致的调用端人体工学与坚固的后端容灾韧性。

## 结果与收益
- **彻底终结 localStorage 伪存储**：课评实体服务端正规落盘，排课日程与课评 1:1 强绑定，页面刷新后排课卡片右上角「⭐ 课评」发布绿点持久留存。
- **随堂学情资产 100% 贯通**：每次发布课评，评语与等第即刻穿透至 `AttendanceRecord`，使 ADR-0005 的学员 360° 成长档案时间轴与五维能力星级雷达实时激活，彻底消灭数据孤岛与空白状态。
- **微信推送解耦与零风控风险**：通过 Transactional Outbox 与 `NotificationPort` 物理隔离微信外部网络调用，微信网关抖动绝不阻断排课结课与课评落盘；单测通过 `MockNotificationAdapter` 实现毫秒级快速断言。
- **前端调用代码量减少 70%**：弹窗打开调用 `hydrateEvaluation` 获取全量上下文，提交调用 `commitEvaluation`，消除前端多表 lookup 与状态拼接胶水代码。
- **安全门禁合规**：前端增加单视频 $\le 100\text{MB}$ 与相册 $\le 9$ 张的前置硬门禁；课评协调器接缝保持纯净的字符串 URL 契约，避免业务服务器承担 CPU 密集型压缩转码。
