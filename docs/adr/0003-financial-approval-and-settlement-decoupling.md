# 0003. 解耦财务多级审批流与履约记账策略

## 状态
Accepted

## 背景与决策
多级风控审批流是教培系统资金流与学员资产安全的核心生命线。原实现存在以下严重架构缺陷与过缝泄漏：
1. **业务硬编码与紧耦合**：服务端 `financial.service.ts` 的 `auditApproval` 方法硬编码了 `if (flow.businessType === 'refund')`，直接调用 `StudentEnrollmentCoordinator` 的 `finalizeRefund` 和 `rollbackRefund`。对于常规收款确认（`payment`）、季度扣费（`quarterly`）、换课差额（`course_change_diff`）、钱包预存（`wallet_prestore`）等其他业务，没有任何策略扩展机制，只能生硬将订单改为 `paid`；
2. **前端并发批处理脆弱性**：前端工作台 `approvalFlow.vue` 在处理多选审批单时，使用 `Promise.all(selectedPendingRows.value.map(...))` 循环发起并发 HTTP 请求。在网络抖动或高并发场景下，极易产生部分成功部分失败、行锁争用（Lock Contention）以及长事务超时，且缺乏批处理原子回执；
3. **前端伪状态机代码混淆**：前端 `src/utils/financeAggregator.ts` 遗留了 300 多行的客户端审批状态机 `processApproval`，虽然生产页面并不调用它，但被离线单元测试和 Contract 测试直接引用，造成前后端双轨代码维护困境；
4. **缺乏统一的全流程时间轴契约**：前端查看审批轨迹时，只能依赖零散的历史字段拼接，缺乏服务端统一归档的标准化时间轴视图。

我们决定在服务端建立多级审批与履约深模块 `FinancialApprovalOrchestrator`，并引入插件化 SPI 履约策略体系 `SettlementStrategy`：
- 对外暴露高杠杆任务型工作台接缝：`passApproval`、`rejectApproval`、`batchAudit`、`getApprovalTimeline` 与 `submitApproval`；
- 内部引入 `SettlementStrategyRegistry`，按业务类型解耦退费解冻恢复、常规缴费激活、换课差额退补、钱包充值记账等下游履约动作；
- 服务端提供单请求分块事务批处理引擎，消除前端 `Promise.all` 循环并发；
- 保持对离线测试 Contract 的解耦兼容与已有测试用例的零破坏。

## 评估过的备选方案
- **备选方案 A（纯 CQS 双入口泛化状态机）**：仅提供 `audit(flowId, decision)` 和 `submit(spec)` 两个最简入口。被否决，对于 95% 的前台审批场景（单笔快速通过、单笔必须写原因的驳回、多选单据批量通过），纯泛化接口需要调用方反复构造繁琐的结构体，在 Controller 和前端工作台中徒增胶水胶套。
- **备选方案 B（重型 BPMN/工作流引擎）**：引入外部流程引擎或完全动态的工作流规则定义器。被否决，教培系统标准的三级风控（教学核实 -> 校长复核 -> 财务终审）高度确定且强管控，重型工作流引擎过度设计，增加了维护复杂性。
- **入选方案（极简任务契约 + 插件化 SPI 履约深模块）**：深模块对外提供最贴合业务场景的任务方法与单请求批量批处理；内部通过 `SettlementStrategy` SPI 注册机制实现下游记账与资产回滚解耦；审批流转、节点归档与策略履约在单次数据库 `$transaction` 中原子提交。

## 结果与收益
- **消除业务硬编码**：核心审批流彻底摆脱对 `businessType === 'refund'` 的硬编码 `if/else`，新增审批类型只需实现 SPI 策略并注册，符合开闭原则（OCP）；
- **前端网络请求与并发收敛**：批量审批请求次数由 $O(N)$ 并发缩减为 $O(1)$ 单请求，杜绝客户端网络风暴与并发数据竞争；
- **全链路资产防撕裂**：审批状态跃迁、节点快照落库与业务履约/回滚在单个事务内原子完成，终态单据（`approved`/`rejected`）具备严格防篡改屏障（HTTP 400）；
- **生产与测试双轨清晰**：生产视图 100% 走服务端真实深模块与时间轴，离线纯函数 Contract 测试保持独立运行，互不干扰；
- **零破坏平滑过渡**：现有 `test-financial-and-approval.js`、`test-student-enrollment-coordinator.js` 保持 100% 通过。
