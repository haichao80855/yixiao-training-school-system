import type {
  FinanceFilterForm,
  OrderRecord,
  FinanceSummaryResult,
  ApprovalRecord,
} from '@/types/financial';

export function isCampusMatch(orderCampusId?: string, filterCampusId?: string): boolean {
  if (!filterCampusId || filterCampusId === 'all') return true;
  if (!orderCampusId) return false;

  const normalizeCampus = (id: string) => {
    if (id === 'CAMPUS_HQ' || id === 'campus-bj-hq' || id === '1' || id === '总部校区' || id === '拓视未来-原阳校区') return 'campus-bj-hq';
    if (id === 'CAMPUS_SH' || id === 'campus-sh-pd' || id === '2' || id === '上海浦东校区') return 'campus-sh-pd';
    if (id === 'CAMPUS_SZ' || id === 'campus-sz-ns' || id === '3' || id === '深圳南山校区') return 'campus-sz-ns';
    return id;
  };

  const normFilter = normalizeCampus(filterCampusId);
  const normOrder = normalizeCampus(orderCampusId);
  return normFilter === normOrder || orderCampusId === filterCampusId;
}

/**
 * 财务中心 3x8 高密度筛选矩阵、汇总小计与审批流算法引擎
 * 严格对标 tests/contracts/financeAggregator.js
 */
export class FinanceAggregator {
  // 3x8 筛选矩阵初始默认表单字段 (严格恰好 24 项)
  static getDefaultFilterForm(): FinanceFilterForm {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

    return {
      // Row 1 (8 控件)
      studentKeyword: '', // 姓名/学号/手机号
      submitter: '',      // 提交人
      salesOwner: '',     // 业绩归属人
      channel: 'all',     // 渠道来源
      classId: '',        // 班级
      courseType: 'all',  // 课程类型
      chargeType: 'all',  // 收费类型 (常规/季度)
      orderStatus: 'all', // 订单状态 (已支付/未支付/已驳回/已作废)

      // Row 2 (8 控件)
      studentStatus: 'all',  // 学员状态 (在读/休学/转校/结业)
      abnormalStatus: 'all', // 异动状态 (正常/转班/换课/停课/退费)
      goodsDelivery: 'all',  // 商品出库状态
      paymentMethod: 'all',  // 支付方式 (微信/支付宝/银行转账/POS/钱包)
      minAmount: null,       // 最低金额
      maxAmount: null,       // 最高金额
      invoiceStatus: 'all',  // 发票开具状态
      campusId: 'CAMPUS_HQ', // 归属校区

      // Row 3 (8 控件)
      dateRangeType: 'payTime', // 日期类型 (报名日期/支付日期/审核日期)
      startDate: `${year}-${month}-01`, // 默认当月1号
      endDate: `${year}-${month}-${lastDay}`, // 默认当月末
      couponUsed: 'all',    // 是否使用优惠券
      auditor: '',          // 审核人
      contractSigned: 'all',// 合同签署状态
      page: 1,              // 当前页码
      pageSize: 20          // 每页条数
    };
  }

  // 重置表单方法
  static resetFilterForm(campusId: string = 'CAMPUS_HQ'): FinanceFilterForm {
    const defaults = this.getDefaultFilterForm();
    defaults.campusId = campusId;
    return defaults;
  }

  // 3x8 矩阵数据过滤匹配
  static filterOrders(orders: OrderRecord[] = [], filters: Partial<FinanceFilterForm> = {}): OrderRecord[] {
    let min = filters.minAmount;
    let max = filters.maxAmount;
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      const temp = min;
      min = max;
      max = temp;
    }

    return orders.filter(order => {
      // 1. 校区过滤
      if (filters.campusId && filters.campusId !== 'all') {
        if (!isCampusMatch(order.campusId, filters.campusId)) {
          return false;
        }
      }

      // 2. 综合关键字 (学员姓名/学号/手机号/订单号)
      if (filters.studentKeyword && filters.studentKeyword.trim()) {
        const kw = filters.studentKeyword.trim().toLowerCase();
        const matchesName = (order.studentName || '').toLowerCase().includes(kw);
        const matchesNo = (order.studentNo || '').toLowerCase().includes(kw);
        const matchesPhone = (order.phone || '').includes(kw);
        const matchesOrderNo = (order.orderNo || '').toLowerCase().includes(kw);
        if (!matchesName && !matchesNo && !matchesPhone && !matchesOrderNo) return false;
      }

      // 3. 提交人
      if (filters.submitter && filters.submitter.trim()) {
        const sub = filters.submitter.trim();
        const s1 = order.submitter || '';
        const s2 = order.creator || '';
        if (!s1.includes(sub) && !s2.includes(sub)) return false;
      }

      // 4. 业绩归属人
      if (filters.salesOwner && filters.salesOwner.trim()) {
        const so = filters.salesOwner.trim();
        const s1 = order.salesOwner || '';
        const s2 = order.performanceOwner || '';
        if (!s1.includes(so) && !s2.includes(so)) return false;
      }

      // 5. 渠道来源
      if (filters.channel && filters.channel !== 'all' && order.channel !== filters.channel) {
        return false;
      }

      // 6. 班级
      if (filters.classId && filters.classId !== '' && filters.classId !== 'all') {
        if (filters.classId.includes(',')) {
          const ids = filters.classId.split(',');
          if (!order.classId || !ids.includes(order.classId)) return false;
        } else {
          if (order.classId !== filters.classId) return false;
        }
      }

      // 7. 课程类型
      if (filters.courseType && filters.courseType !== 'all' && order.courseType !== filters.courseType) {
        return false;
      }

      // 8. 收费类型 (常规/季度/换课/退费/钱包充值/服务费)
      if (filters.chargeType && filters.chargeType !== 'all') {
        const c1 = order.chargeType || '';
        const c2 = order.orderType || '';
        if (c1 !== filters.chargeType && c2 !== filters.chargeType) return false;
      }

      // 9. 订单状态 (已支付/未支付/已驳回/已作废)
      if (filters.orderStatus && filters.orderStatus !== 'all') {
        const s1 = order.orderStatus || '';
        const s2 = order.status || '';
        if (s1 !== filters.orderStatus && s2 !== filters.orderStatus) return false;
      }

      // 10. 学员状态
      if (filters.studentStatus && filters.studentStatus !== 'all' && order.studentStatus !== filters.studentStatus) {
        return false;
      }

      // 11. 异动状态
      if (filters.abnormalStatus && filters.abnormalStatus !== 'all' && order.abnormalStatus !== filters.abnormalStatus) {
        return false;
      }

      // 12. 商品出库状态
      if (filters.goodsDelivery && filters.goodsDelivery !== 'all' && order.goodsDelivery !== filters.goodsDelivery) {
        return false;
      }

      // 13. 支付方式
      if (filters.paymentMethod && filters.paymentMethod !== 'all' && order.paymentMethod !== filters.paymentMethod) {
        return false;
      }

      // 14. 金额范围
      if (typeof min === 'number' && order.actualAmount < min) {
        return false;
      }
      if (typeof max === 'number' && order.actualAmount > max) {
        return false;
      }

      // 15. 发票开具状态
      if (filters.invoiceStatus && filters.invoiceStatus !== 'all' && order.invoiceStatus !== filters.invoiceStatus) {
        return false;
      }

      // 16. 日期范围
      const dateType = filters.dateRangeType || 'payTime';
      let targetDateStr = '';
      if (dateType === 'signupTime') {
        targetDateStr = order.signupTime || '';
      } else if (dateType === 'auditTime') {
        targetDateStr = order.auditTime || order.payTime || '';
      } else {
        targetDateStr = order.payTime || '';
      }

      if (filters.startDate && targetDateStr) {
        const d = targetDateStr.split(' ')[0];
        if (d < filters.startDate) return false;
      }
      if (filters.endDate && targetDateStr) {
        const d = targetDateStr.split(' ')[0];
        if (d > filters.endDate) return false;
      }

      // 17. 优惠券使用
      if (filters.couponUsed && filters.couponUsed !== 'all') {
        if (filters.couponUsed === 'yes' && (order.couponAmount || 0) <= 0) return false;
        if (filters.couponUsed === 'no' && (order.couponAmount || 0) > 0) return false;
      }

      // 18. 审核人
      if (filters.auditor && filters.auditor.trim()) {
        const aud = filters.auditor.trim();
        if (!order.auditor || !order.auditor.includes(aud)) return false;
      }

      // 19. 合同签署状态
      if (filters.contractSigned && filters.contractSigned !== 'all' && order.contractSigned !== filters.contractSigned) {
        return false;
      }

      return true;
    });
  }

  // 动态汇总小计横条计算 (严格使用精确整数分计算，杜绝浮点数截断)
  static calculateSummaryStrip(filteredOrders: OrderRecord[] = []): FinanceSummaryResult {
    const totalCount = filteredOrders.length;
    let totalCents = 0;

    for (const ord of filteredOrders) {
      const amountCents = Math.round((ord.actualAmount || 0) * 100);
      totalCents += amountCents;
    }

    const totalAmount = Number((totalCents / 100).toFixed(2));
    const formattedAmount = totalAmount.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const summaryText = `当前条件下：共计 ${totalCount} 笔缴费，实缴金额 ${formattedAmount} 元`;

    return {
      totalCount,
      totalAmount,
      formattedAmount,
      summaryText
    };
  }

  /**
   * 多级审批流状态机纯函数算法
   * @deprecated 生产环境审批流已全面下沉至服务端深模块 `FinancialApprovalOrchestrator`。
   * 本纯内存函数作为离线单元测试与契约验证（Tier 1~Tier 5 / Contract Suite）专用模拟器保留，
   * 严禁在生产 Vue 业务视图中直接调用。
   */
  static processApproval(
    approvalRecord: ApprovalRecord,
    action: 'pass' | 'reject',
    operator: string,
    comment: string = ''
  ) {
    if (approvalRecord.status !== 'pending') {
      throw new Error(`Approval record is already finalized as: ${approvalRecord.status}`);
    }

    const steps = [
      { step: 1, role: 'teacher_or_director', name: '教学课消核实' },
      { step: 2, role: 'principal', name: '校区校长审批' },
      { step: 3, role: 'finance', name: '总部财务终审' }
    ];

    const currentStepConfig = steps.find(s => s.step === approvalRecord.currentStep);
    if (!currentStepConfig) {
      throw new Error(`Invalid current step: ${approvalRecord.currentStep}`);
    }

    if (action === 'reject') {
      approvalRecord.status = 'rejected';
      approvalRecord.timeline.push({
        step: currentStepConfig.name,
        operator,
        comment,
        time: new Date().toISOString(),
        status: 'rejected'
      });
      return { success: true, finalStatus: 'rejected', approvalRecord };
    }

    if (action === 'pass') {
      approvalRecord.timeline.push({
        step: currentStepConfig.name,
        operator,
        comment,
        time: new Date().toISOString(),
        status: 'passed'
      });

      if (approvalRecord.currentStep >= steps.length) {
        approvalRecord.status = 'approved';
        return { success: true, finalStatus: 'approved', approvalRecord };
      } else {
        approvalRecord.currentStep += 1;
        return { success: true, finalStatus: 'pending', nextStep: approvalRecord.currentStep, approvalRecord };
      }
    }

    throw new Error(`Unknown approval action: ${action}`);
  }
}
