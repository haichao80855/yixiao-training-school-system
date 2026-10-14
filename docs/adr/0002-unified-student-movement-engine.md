# 0002. 收敛学员 7 种学籍异动至统一深模块

## 状态
Accepted

## 背景与决策
学员学籍异动覆盖 7 种分支场景（转班、换课、停课/休学、复课、转校、转让、退费）。原系统中业务逻辑严重过缝泄漏：
1. 前端 `AbnormalMovementDialog.vue` 中充斥着 `refundCalc`、`oldPkgResidual`、`newCourseTotal`、`courseDiff` 等复杂财务计算，将剩余净值折算、赠课剥离收回、手续费扣除等风控规则硬编码在客户端；
2. API 胶水适配器 `src/api/modules/student.ts` 中的 `adaptMovementDto` 存在危险的兜底赋值（若未显式传 `refundAmount`，将 `deductionFee` 手续费直接当做退费金额赋权给后端）；
3. 服务端 `student.service.ts` 的 `executeMovement` 维护了一个 300 多行的平铺单体 `switch`，除了退费委托给 `StudentEnrollmentCoordinator`，其余 6 种均平铺在长事务中，转班缺乏目标班级容量（`capacity`）硬阻断，换课未联动电子钱包多退少补，转让未移交钱包资产。

我们决定在服务端建立学籍异动深模块 `StudentMovementCoordinator`，以极简 CQS 双入口（`preview` 预演 / `execute` 落盘）为外部接缝，融合可辨识联合类型（Discriminated Union）与智能默认值，内部闭环 7 种异动全生命周期状态机跃迁、班容并发锁、盛通退费折算法则、跨校区交付资质核验、钱包双分账流水与三级审批流联动。前端弹窗彻底剥离所有算术代码，转变为只读驱动看板。

## 评估过的备选方案
- **备选方案 A（纯极简 CQS 入口，弱类型单一 DTO）**：外部仅暴露单一弱类型 DTO 字典。被否决，因为入参包含大量相互冲突或语义模糊的别名（如 `toClassId` vs `targetClassId`、`deductionFee` vs `refundAmount`），无法在编译期为不同异动分支提供强类型守护。
- **备选方案 B（微规则插件流水线架构）**：为 7 种异动暴露 5 类策略接口（`ICapacityPolicy`、`IFeeConversionPolicy` 等）与两层持久化适配器。被否决，在当前单体架构下，过度细粒度的策略抽象增加了调用者的装配认知成本（Mental Burden），违背了深模块“小接口，大实现”的设计初衷。
- **入选方案（实用主义融合深模块）**：对外暴露极简 CQS 双入口（`preview`/`execute`），入参采用可辨识联合类型（Discriminated Union）消除字段歧义，内置开箱即用的合理默认值，内部通过单事务聚合处理班容、交付、钱包与退费审批。

## 结果与收益
- **消灭算法漂移**：前端弹窗删除全部财务计算属性，由服务端 `preview()` 统一输出权威差额、赠课追缴与班容诊断。
- **消除危险胶水**：废除 `adaptMovementDto` 中将手续费误赋为退费金额的危险逻辑，实现编译期类型强校验。
- **补齐风控死角**：转班满员强拦截（`currentStudentCount < capacity`）、换课钱包差额自动退补、停课冻结与复课自动顺延、跨校区交付准入、转让资产同步过户等全部原子闭环。
- **测试表面收敛**：测试用例直接面向 `StudentMovementCoordinator` 进行 7 种异动场景穿透验证，摆脱对 UI DOM 绑定的依赖。
