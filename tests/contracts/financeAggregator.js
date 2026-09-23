/**
 * 财务中心 3x8 高密度筛选矩阵、汇总小计与审批流模型 (Finance Aggregator & Approvals)
 * 对应 PROJECT.md § Interface Contracts 4 & Features 20, 21, 22, 23
 */

class FinanceAggregator {
  // 3x8 筛选矩阵初始默认表单字段 (24项)
  static getDefaultFilterForm() {
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
      pageSize: 20,         // 每页条数
    };
  }

  // 重置表单方法
  static resetFilterForm(campusId = 'CAMPUS_HQ') {
    const defaults = this.getDefaultFilterForm();
    defaults.campusId = campusId;
    return defaults;
  }

  // 3x8 矩阵数据过滤匹配
  static filterOrders(orders = [], filters = {}) {
    return orders.filter(order => {
      // 1. 校区
      if (filters.campusId && filters.campusId !== 'all' && order.campusId !== filters.campusId) {
        return false;
      }
      // 2. 综合关键字 (学员姓名/学号/手机号)
      if (filters.studentKeyword && filters.studentKeyword.trim()) {
        const kw = filters.studentKeyword.trim().toLowerCase();
        const matchesName = (order.studentName || '').toLowerCase().includes(kw);
        const matchesNo = (order.studentNo || '').toLowerCase().includes(kw);
        const matchesPhone = (order.phone || '').includes(kw);
        if (!matchesName && !matchesNo && !matchesPhone) return false;
      }
      // 3. 提交人
      if (filters.submitter && filters.submitter.trim()) {
        if (!order.submitter || !order.submitter.includes(filters.submitter.trim())) return false;
      }
      // 4. 业绩归属人
      if (filters.salesOwner && filters.salesOwner.trim()) {
        if (!order.salesOwner || !order.salesOwner.includes(filters.salesOwner.trim())) return false;
      }
      // 5. 渠道
      if (filters.channel && filters.channel !== 'all' && order.channel !== filters.channel) {
        return false;
      }
      // 6. 班级
      if (filters.classId && order.classId !== filters.classId) {
        return false;
      }
      // 7. 收费类型
      if (filters.chargeType && filters.chargeType !== 'all' && order.chargeType !== filters.chargeType) {
        return false;
      }
      // 8. 订单状态
      if (filters.orderStatus && filters.orderStatus !== 'all' && order.orderStatus !== filters.orderStatus) {
        return false;
      }
      // 9. 支付方式
      if (filters.paymentMethod && filters.paymentMethod !== 'all' && order.paymentMethod !== filters.paymentMethod) {
        return false;
      }
      // 10. 金额范围
      if (typeof filters.minAmount === 'number' && order.actualAmount < filters.minAmount) {
        return false;
      }
      if (typeof filters.maxAmount === 'number' && order.actualAmount > filters.maxAmount) {
        return false;
      }
      // 11. 日期范围
      if (filters.startDate && order.payTime && order.payTime.split(' ')[0] < filters.startDate) {
        return false;
      }
      if (filters.endDate && order.payTime && order.payTime.split(' ')[0] > filters.endDate) {
        return false;
      }

      return true;
    });
  }

  // 动态汇总小计横条计算
  static calculateSummaryStrip(filteredOrders = []) {
    const totalCount = filteredOrders.length;
    let totalCents = 0;

    for (const ord of filteredOrders) {
      // 使用精确整数分计算，防止浮点数精度截断问题
      const amountCents = Math.round((ord.actualAmount || 0) * 100);
      totalCents += amountCents;
    }

    const totalAmount = Number((totalCents / 100).toFixed(2));
    const formattedAmount = totalAmount.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const summaryText = `当前条件下：共计 ${totalCount} 笔缴费，实缴金额 ${formattedAmount} 元`;

    return {
      totalCount,
      totalAmount,
      formattedAmount,
      summaryText,
    };
  }

  // 多级审批流工作台
  static processApproval(approvalRecord, action, operator, comment = '') {
    if (approvalRecord.status !== 'pending') {
      throw new Error(`Approval record is already finalized as: ${approvalRecord.status}`);
    }

    const steps = [
      { step: 1, role: 'teacher_or_director', name: '教学课消核实' },
      { step: 2, role: 'principal', name: '校区校长审批' },
      { step: 3, role: 'finance', name: '总部财务终审' },
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
        status: 'rejected',
      });
      return { success: true, finalStatus: 'rejected', approvalRecord };
    }

    if (action === 'pass') {
      approvalRecord.timeline.push({
        step: currentStepConfig.name,
        operator,
        comment,
        time: new Date().toISOString(),
        status: 'passed',
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

module.exports = FinanceAggregator;
