# 领域词汇表 (Domain Glossary)

本文档定义「一校教培系统」跨模块核心业务概念与统一术语，指导后续代码设计与功能演进。

## 核心业务概念

### 1. 机构与校区 (Organization & Campus)
- **集团 (Group / Corporation)**: 顶层多租户法人实体（如：北京拓视未来教育科技集团股份有限公司）。
- **校区 (Campus)**: 物理教学实体场所（如：总部、远洋、朝阳、海淀、望京）。各业务数据（班级、排课、学员、流水）按校区作用域（Campus Scope）隔离与授权。
- **校区上下文 (Campus Context)**: 全局响应式状态，切换校区时穿透重载教研、学员、教务、财务与权限数据。

### 2. 教研模块 (Curriculum)
- **教研课程 (Curriculum Course)**: 标准化课程定义，包含年级、科目、单元与课时大纲。
- **跨校区授权 (Cross-Campus Authorization)**: 集团教研课程穿梭下发至指定校区的授权机制。
- **课时 (Lesson / Period)**: 最小教学单元，课时消耗计算的基准。

### 3. 学员与资产 (Student & Asset)
- **学员档案 (Student Profile)**: 学员全生命周期档案，含基本信息、学籍状态、在读班级与联系方式。
- **课包 (Course Package)**: 包含指定课时数、单价、有效期的资产凭据。
- **电子钱包 (Student Wallet)**: 分账账本体系，严格区分本金钱包（现金充值）与赠送金钱包（优惠赠送）。
- **学籍异动 (Status Flow)**: 包含转班、换课、休学、复课、转校、转学员、退费共 7 种异常状态流转。
- **学籍异动协调器 (Student Movement Coordinator)**: 服务端学籍与资产异动深模块，对外提供 `preview`（只读预演）与 `execute`（原子落盘）极简接缝，统一编排状态机跃迁、盛通退费折算、班容并发锁、跨校区交付准入与三级风控审批。
- **学籍异动意图 (Student Movement Intent)**: 针对 7 种异动场景的强类型可辨识联合规范，消除参数别名与前端危险回退赋值。
- **学籍异动预演报告 (Movement Preview)**: 零写副作用仿真试算结果，输出前置阻断原因、警告、差额应退/应补、班容变化与审批预测。
- **学籍异动执行回执 (Movement Receipt)**: 事务落盘结果凭证，包含不可变审计快照（`originalData` 与 `targetData`）、关联订单与审批单据号。

### 4. 教务模块 (Educational Affairs)
- **实体班级 (Class)**: 绑定特定课程、授课老师、班主任、物理教室与班容上限的教学班集体。
- **排课日程 (Schedule / Lesson Plan)**: 7x15（07:00-22:00）网格排课条目，包含时段、教室、授课教师与四色语义 Chip。
- **排课调度协调器 (Schedule Coordinator)**: 服务端排课深模块，对外提供预演（Preview）与原子落盘（Commit）统一接缝，封装冲突检测、日历推演、泳道分配与事务持久化。
- **循环排课意图 (Batch Schedule Spec / Intent)**: 声明式排课请求规范，包含起始日期、时段、周期步长与课次数，支持自动水化继承班级的主教与教室。
- **碰撞冲突检测 (Collision Detection)**: 教师时段冲突、教室占用冲突、教室额定容量上限冲突、班级重叠与营业窗口（07:00-22:00）的多维冲突校验引擎。
- **碰撞仲裁策略 (Collision Policy)**: 遭遇冲突时的决议行为：严格拒绝回滚 (`STRICT_ABORT`) vs 容错入库标红跳动待调解 (`ALLOW_AND_FLAG`)。
- **排课预演报告 (Scheduling Preview)**: 零副作用排课仿真结果，提供完整虚拟课次时间线、冲突诊断集合与可提交性判定。
- **排课泳道 (Schedule Lane)**: 7x15 看板多列并排时的重叠冲突染色索引（0~3 泳道），由服务端在落盘时原子计算赋予，保障跨端视觉一致性。
- **考勤点名 (Attendance)**: 课次上课状态确认（出勤、请假、缺席、补课）。
- **课消 (Lesson Consumption)**: 授课结课后扣减学员课包剩余课时的核销操作。
- **反结课冲正 (Reversal / Correction)**: 结课误操作后的课时反冲与状态复原机制。
- **学员班级入班协调器 (Class Roster Coordinator)**: 服务端班级花名册与分班履约深模块，闭环行级班容排他锁 (CAS)、原班人数原子冲减、学籍状态机自愈、批量入班原子性与待分班名册高性能分页聚合。
- **待分班资产池 (Unassigned Pool)**: 持有有效激活课包（`status = 'active'` 且 `remainingLessons > 0`）但尚未分配实体班级（`classId is null`）的学员资产聚合大盘。
- **班容并发锁 (Class Capacity CAS Lock)**: 数据库行级条件更新约束（`currentStudentCount + N <= capacity`），杜绝网络并发导致班容被击穿超卖。
- **班级花名册全景 (Class Roster)**: 班级在读学员画像集合，包含实时满班率、剩余名额与 `<= 3` 课时低额预警。
- **学情成长投影深模块 (Learning Growth Projector)**: 服务端闭环随堂点名消课、反结课防腐风控与学员成长画像投影的高内聚深模块，对外提供 `settleRollCall`、`reverseRollCall` 与 `projectLearningPortfolio` 极简业务工步接缝。
- **财务防腐屏障 (Anti-Corruption Barrier, ACB)**: 反结课冲正过程中的退费资产保护屏障，硬阻断针对已退费课包（`status === 'refunded'`）的反向修改，坚决禁止退费冻结课包被恶意或误冲正复活。
- **退费锁定 (RefundLocked)**: 课包处于已退费终态或关联在途审批退费工单时的保护标记，禁止任何消课扣除与非法逆向课时恢复。
- **五维能力星级雷达 (Competency Radar)**: 综合出勤率、随堂测验打分、课堂专注度、编程作品评分归一化折算的五维能力图谱（`logic`, `creativity`, `focus`, `handsOn`, `expression`）。
- **消课流失预警单一真值源 (SSOT Burning Alerts)**: 基于近 30 天滑动消课速率与剩余课时，权威输出预警级别（`normal`, `warning`, `urgent`）与耗尽天数预测，终结全系统散落的魔法数字。
- **课消风控与续费决策协调器 (Lesson Renewal Coordinator)**: 服务端课消风控与续费决策深模块，收敛统一多因子课消健康流失模型（耗尽预测、停消休眠、临期失效），对外提供单学员诊断、校区大盘看护、班级健康花名册与一键续费开单草案生成高阶任务接缝。
- **停消休眠流失判定 (Dormant Inactivity Detection)**: 双向探测学员连续未消课天数（$\ge 14$ 天）与所在班级未来 14 天排课安排，智能识别隐性流失高危。
- **班级消课健康指数 (Classroom Health Index)**: 基于班级内学员紧急枯竭、预警跟进与停消休眠比例加权折算的 0~100 综合健康度指标。
- **续费开单智能预填草案 (Renewal Order Draft)**: 协调器基于历史课包与风控策略自动生成的自洽开单凭证，继承原单价、推算标准规格、CAS 预检班容、试算钱包抵扣，直通招生开单向导。
- **教学班级全生命周期协调器 (Class Lifecycle Coordinator)**: 服务端实体教学班级全生命周期流转与级联资产处置深模块，对外提供 `activateClass`、`completeClass`、`cancelClass`、`mergeClasses` 与 `previewOperation` 高阶业务接缝，闭环状态机单向流转、未执行排课安全撤回、历史考勤防腐锁死、在读课包原子分流、学籍状态机自愈与不可变审计回执生成。
- **未点名排课安全撤销 (Pending Schedule Revocation)**: 班级正常结课或异常解散时，针对未来无任何点名消课记录的排课日程执行安全注销，即时释放物理教室与讲师时段工时，出清排课冲突矩阵。
- **学籍状态机自愈 (Student Status Auto-Healing)**: 班级解绑或结课时，系统自动探测学员名下有效在读班级；若无其他在读班级，学籍状态由 `in_class` 自动回退为 `normal`（待分班/在读）或跃迁为 `graduated`，彻底杜绝幽灵学籍。
- **不可变生命周期处置凭单 (Class Lifecycle Receipt)**: 班级状态跃迁事务落盘生成的不可变防篡改凭单，包含唯一流水号（`REC-CLS-xxxx`）、SHA-256 数据指纹、受影响学员课包明细、释放排课数与操作人上下文，支撑教育合规审计。
- **课评闭环与家长通知协调器 (Lesson Evaluation Coordinator)**: 服务端随堂课评持久化与家长通知出站深模块，对外提供 `hydrateEvaluation`（智能全景水化）与 `commitEvaluation`（原子落盘与派发）极简高阶意图接缝，闭环实体持久化、考勤记录双向渗透（激活 ADR-0005 学情雷达）、不可变版本快照归档与事务出站信箱投递。
- **随堂课评智能水化 (Lesson Evaluation Hydration)**: 教师打开课评对话框时，深模块自动从排课日程、标准课程大纲（`CourseLesson`）与考勤记录中抽取教学重难点 HTML、预设评语框架、参课学员花名册与家长微信绑定画像（`wechatOpenId`），提供开箱即用零心智负担的工作台全景草案。
- **事务性通知出站信箱 (Transactional Evaluation Outbox)**: 在同一个数据库 ACID 事务中将课评发布、考勤渗透与待发送通知（`LessonEvaluationOutbox`）原子落盘；事务提交后再由调度器异步非阻塞出站，彻底杜绝外部微信 API 网络超时或限流对数据库事务的拖拽。
- **课评不可变数据指纹 (Evaluation Immutable Fingerprint)**: 课评正式发布或修订时，协调器基于快照数据排序计算的 SHA-256 哈希防篡改指纹，随不可变版本快照（`LessonEvaluationRevision`）持久化归档，支撑教育质量与家校互动合规审计。
- **微信模板消息通知端口 (WeChat Notification Port)**: 基于 Ports & Adapters 架构抽象的外部通知出站接缝端口（`NotificationPort`），解耦真实微信接口；提供生产适配器（`WechatNotificationAdapter`）与内存断言适配器（`MockNotificationAdapter`），满足“双适配器确立真实接缝”的架构规范。
- **统一结课履约协调器 (Lesson Fulfillment Coordinator)**: 服务端统一随堂消课与课评履约深模块，将随堂点名消课、随堂课评持久化、不可变版本指纹快照、学情雷达双向渗透与事务出站信箱折叠为单一物理单原子事务（ACID）；对外仅暴露 `prepareFulfillmentWorkbench`（极速工作台智能水化）、`fulfillLesson`（一键全量履约）与 `reverseFulfillment`（级联安全反结课冲正）三大高阶意图接缝。
- **零心智结课通途 (Zero-ceremony Happy Path)**: 工作台结课默认将全部班级在读学员预置为全勤到课（`present`）、正课扣除 1 课时、自动抽取课程核心素养大纲富文本、预置 5 星卓越评级与标准化评语，教师面对 90% 的常规课堂无需逐项点选修改，一键即可安全结课。
- **异常学员差异覆写 (Anomaly Overrides)**: 零心智通途的配套机制。调用端仅需显式传入有异常的学员（如请假、缺席、自定义评语或能力标签），协调器自动将基线全勤名单与异常增量做差分合并计算，大幅缩减网络传输报文体积与前端状态维护复杂度。
- **反结课级联安全冲正 (Cascading Reversal Safety)**: 当执行反结课操作时，协调器在单物理事务内原子联动：原路退还课包课时、自愈课包状态、激活财务防腐屏障（ACB 退费锁定强阻断）、标记考勤记录冲正、废除课评状态（`revoked`），并级联作废/取消出站信箱中处于 `pending` 状态的在途微信通知，彻底消除“课已撤销但家长仍收到课评通知”的幽灵通知（Ghost Notice）灾难。
- **课评重开独立策略 (Reopen Evaluation Strategy)**: 反结课冲正的可配置轻量策略（`strategy: 'REOPEN_EVALUATION'`）。仅作废原课评与在途通知、重置考勤评语评价字段并允许教师重新编辑提交，而保持底层的学员课时扣减与课包财务对账完全不被破坏，兼顾教学内容勘误与财务稽核稳定性。
- **学情成长多媒体投影深模块 (Multimedia Learning Growth Projector)**: 服务端纯只读单次级联投影深模块，折叠 Student + Package + Attendance + Schedule + Evaluation 5 张物理表，接入多媒体课评相册流（9 宫格微缩画廊、视频首帧截屏、语音波形采样、个性特写与表现标签），提供开箱即用、零胶水代码的端到端学情视图。
- **双重视角工效接缝 (Dual-Perspective Client-First Ergonomics)**: 针对「校区管理档案抽屉」与「家长端移动 H5 落地页」两个截然不同的消费端提供开箱即用的投影模型：后台视角直供富媒体时间轴、课消预警 SSOT、雷达图与全景相册墙；家长视角直出瀑布流脚印、激励勋章与随堂高光卡片。
- **4 级多媒体平滑优雅降级 (4-Level Multimedia Graceful Degradation)**: 从 Level 1 (全量多媒体) → Level 2 (班级全员通评) → Level 3 (老旧无课评考勤) → Level 4 (反结课冲正历史物理出清) 的四级回退沙箱，保证数据完整性的同时杜绝 NPE 与历史噪点。
- **免密防越权安全令牌 (HMAC-SHA256 Growth Token)**: 为单课课评或全景学情签发带过期时间与身份绑定的 HMAC-SHA256 密文令牌，配合 timingSafeEqual 防时序攻击，杜绝横向越权（Anti-IDOR），让家长端免登录安全查阅。
- **多媒体存储与图片处理端口 (Media Storage Port)**: 基于 Ports & Adapters 架构抽象的外部 OSS 多媒体适配接缝，算力下沉到 OSS 边缘，提供动态 9 宫格正方形裁切（x-oss-process）与视频首帧截取，在测试环境中通过 `PassthroughMediaAdapter` 保证 0 外部网络 I/O。



### 5. 财务与风控 (Financial & Risk Control)
- **订单流水 (Order Ledger)**: 报名、缴费、续费、充值等资金往来明细流水。
- **审批流 (Approval Flow)**: 退费、大额转课等异动的三级风控审批机制（教学核实 → 校长审批 → 财务终审）。
- **审批编排器 (Financial Approval Orchestrator)**: 服务端多级风控审批与履约深模块，对外提供 `passApproval`、`rejectApproval`、`batchAudit`、`getApprovalTimeline` 与 `submitApproval` 等任务型高层接缝，统一编排状态机推进、终态防篡改、节点快照归档与跨事务履约记账。
- **履约记账策略 (Settlement Strategy SPI)**: 插件化业务履约接口，抽象 `validatePrerequisites`、`onStepPassed`、`onFinalized`、`onRejected` 等生命周期钩子，彻底剥离核心审批流中的业务特化硬编码（支持退费解冻恢复、常规缴费激活、季度扣费、换课差额退补、钱包预存记账与通用兜底）。
- **审批审计轨迹 (Approval Timeline)**: 包含历史审批节点、操作人、批注、流转时间与下一级预期的全流程不可变审计链路视图。
- **批量审批单据回执 (Batch Audit Receipt)**: 分块事务批处理执行凭据，返回成功笔数、失败笔数、耗时与逐笔明细，杜绝前端并发网络竞争与数据库长事务死锁。

