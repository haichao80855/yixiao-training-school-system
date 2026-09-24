// ==========================================
// 盛通教育「一校教培系统」财务中心 Mock 数据基石与业务中台引擎
// 对应 PROJECT.md § Interface Contracts 4 & MODULE_ANALYSIS_DESIGN.md § 五、财务模块
// ==========================================

import type {
  OrderRecord,
  FinanceFilterForm,
  FinanceSummaryResult,
  ApprovalRecord,
  ApprovalTimelineNode,
  ApprovalBusinessType,
  LedgerRecord,
  PaymentVoucherInfo,
  PaymentMethod
} from '@/types/financial'

// 校区 ID 规范映射 (支持系统标准 ID 与测试契约 ID 双向匹配)
export const CAMPUS_CODE_MAP: Record<string, string[]> = {
  'campus-bj-hq': ['campus-bj-hq', 'CAMPUS_HQ', 'HQ001', '总部校区'],
  'campus-bj-yy': ['campus-bj-yy', 'CAMPUS_YUANYANG', 'YY002', '远洋校区'],
  'campus-bj-cy': ['campus-bj-cy', 'CAMPUS_CHAOYANG', 'CY003', '朝阳校区'],
  'campus-bj-hd': ['campus-bj-hd', 'CAMPUS_HAIDIAN', 'HD004', '海淀分校'],
  'campus-bj-wj': ['campus-bj-wj', 'CAMPUS_WANGJING', 'WJ005', '望京校区']
}

function normalizeCampus(id: string): string {
  if (!id) return ''
  for (const [canonical, aliases] of Object.entries(CAMPUS_CODE_MAP)) {
    if (aliases.includes(id) || canonical === id) {
      return canonical
    }
  }
  return id
}

export function isCampusMatch(orderCampusId: string, filterCampusId: string): boolean {
  if (!filterCampusId || filterCampusId === 'all') return true
  const normFilter = normalizeCampus(filterCampusId)
  const normOrder = normalizeCampus(orderCampusId)
  return normFilter === normOrder || orderCampusId === filterCampusId
}

/**
 * 财务中心 3x8 高密度筛选矩阵、汇总小计与审批流算法引擎
 * 严格对标 tests/contracts/financeAggregator.js
 */
export class FinanceAggregator {
  // 3x8 筛选矩阵初始默认表单字段 (严格恰好 24 项)
  static getDefaultFilterForm(): FinanceFilterForm {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()

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
    }
  }

  // 重置表单方法
  static resetFilterForm(campusId: string = 'CAMPUS_HQ'): FinanceFilterForm {
    const defaults = this.getDefaultFilterForm()
    defaults.campusId = campusId
    return defaults
  }

  // 3x8 矩阵数据过滤匹配
  static filterOrders(orders: OrderRecord[] = [], filters: Partial<FinanceFilterForm> = {}): OrderRecord[] {
    // 金额防呆校验容错
    let min = filters.minAmount
    let max = filters.maxAmount
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      const temp = min
      min = max
      max = temp
    }

    return orders.filter(order => {
      // 1. 校区过滤
      if (filters.campusId && filters.campusId !== 'all') {
        if (!isCampusMatch(order.campusId, filters.campusId)) {
          return false
        }
      }

      // 2. 综合关键字 (学员姓名/学号/手机号/订单号)
      if (filters.studentKeyword && filters.studentKeyword.trim()) {
        const kw = filters.studentKeyword.trim().toLowerCase()
        const matchesName = (order.studentName || '').toLowerCase().includes(kw)
        const matchesNo = (order.studentNo || '').toLowerCase().includes(kw)
        const matchesPhone = (order.phone || '').includes(kw)
        const matchesOrderNo = (order.orderNo || '').toLowerCase().includes(kw)
        if (!matchesName && !matchesNo && !matchesPhone && !matchesOrderNo) return false
      }

      // 3. 提交人
      if (filters.submitter && filters.submitter.trim()) {
        const sub = filters.submitter.trim()
        const s1 = order.submitter || ''
        const s2 = order.creator || ''
        if (!s1.includes(sub) && !s2.includes(sub)) return false
      }

      // 4. 业绩归属人
      if (filters.salesOwner && filters.salesOwner.trim()) {
        const so = filters.salesOwner.trim()
        const s1 = order.salesOwner || ''
        const s2 = order.performanceOwner || ''
        if (!s1.includes(so) && !s2.includes(so)) return false
      }

      // 5. 渠道来源
      if (filters.channel && filters.channel !== 'all' && order.channel !== filters.channel) {
        return false
      }

      // 6. 班级
      if (filters.classId && filters.classId !== '' && filters.classId !== 'all') {
        if (filters.classId.includes(',')) {
          const ids = filters.classId.split(',')
          if (!order.classId || !ids.includes(order.classId)) return false
        } else {
          if (order.classId !== filters.classId) return false
        }
      }

      // 7. 课程类型
      if (filters.courseType && filters.courseType !== 'all' && order.courseType !== filters.courseType) {
        return false
      }

      // 8. 收费类型 (常规/季度/换课/退费/钱包充值/服务费)
      if (filters.chargeType && filters.chargeType !== 'all') {
        const c1 = order.chargeType || ''
        const c2 = order.orderType || ''
        if (c1 !== filters.chargeType && c2 !== filters.chargeType) return false
      }

      // 9. 订单状态 (已支付/未支付/已驳回/已作废)
      if (filters.orderStatus && filters.orderStatus !== 'all') {
        const s1 = order.orderStatus || ''
        const s2 = order.status || ''
        if (s1 !== filters.orderStatus && s2 !== filters.orderStatus) return false
      }

      // 10. 学员状态
      if (filters.studentStatus && filters.studentStatus !== 'all' && order.studentStatus !== filters.studentStatus) {
        return false
      }

      // 11. 异动状态
      if (filters.abnormalStatus && filters.abnormalStatus !== 'all' && order.abnormalStatus !== filters.abnormalStatus) {
        return false
      }

      // 12. 商品出库状态
      if (filters.goodsDelivery && filters.goodsDelivery !== 'all' && order.goodsDelivery !== filters.goodsDelivery) {
        return false
      }

      // 13. 支付方式
      if (filters.paymentMethod && filters.paymentMethod !== 'all' && order.paymentMethod !== filters.paymentMethod) {
        return false
      }

      // 14. 金额范围
      if (typeof min === 'number' && order.actualAmount < min) {
        return false
      }
      if (typeof max === 'number' && order.actualAmount > max) {
        return false
      }

      // 15. 发票开具状态
      if (filters.invoiceStatus && filters.invoiceStatus !== 'all' && order.invoiceStatus !== filters.invoiceStatus) {
        return false
      }

      // 16. 日期范围
      const dateType = filters.dateRangeType || 'payTime'
      let targetDateStr = ''
      if (dateType === 'signupTime') {
        targetDateStr = order.signupTime || ''
      } else if (dateType === 'auditTime') {
        targetDateStr = order.auditTime || order.payTime || ''
      } else {
        targetDateStr = order.payTime || ''
      }

      if (filters.startDate && targetDateStr) {
        const d = targetDateStr.split(' ')[0]
        if (d < filters.startDate) return false
      }
      if (filters.endDate && targetDateStr) {
        const d = targetDateStr.split(' ')[0]
        if (d > filters.endDate) return false
      }

      // 17. 优惠券使用
      if (filters.couponUsed && filters.couponUsed !== 'all') {
        if (filters.couponUsed === 'yes' && (order.couponAmount || 0) <= 0) return false
        if (filters.couponUsed === 'no' && (order.couponAmount || 0) > 0) return false
      }

      // 18. 审核人
      if (filters.auditor && filters.auditor.trim()) {
        const aud = filters.auditor.trim()
        if (!order.auditor || !order.auditor.includes(aud)) return false
      }

      // 19. 合同签署状态
      if (filters.contractSigned && filters.contractSigned !== 'all' && order.contractSigned !== filters.contractSigned) {
        return false
      }

      return true
    })
  }

  // 动态汇总小计横条计算 (严格使用精确整数分计算，杜绝浮点数截断)
  static calculateSummaryStrip(filteredOrders: OrderRecord[] = []): FinanceSummaryResult {
    const totalCount = filteredOrders.length
    let totalCents = 0

    for (const ord of filteredOrders) {
      const amountCents = Math.round((ord.actualAmount || 0) * 100)
      totalCents += amountCents
    }

    const totalAmount = Number((totalCents / 100).toFixed(2))
    const formattedAmount = totalAmount.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

    const summaryText = `当前条件下：共计 ${totalCount} 笔缴费，实缴金额 ${formattedAmount} 元`

    return {
      totalCount,
      totalAmount,
      formattedAmount,
      summaryText
    }
  }

  // 多级审批流工作台算法
  static processApproval(
    approvalRecord: ApprovalRecord,
    action: 'pass' | 'reject',
    operator: string,
    comment: string = ''
  ) {
    if (approvalRecord.status !== 'pending') {
      throw new Error(`Approval record is already finalized as: ${approvalRecord.status}`)
    }

    const steps = [
      { step: 1, role: 'teacher_or_director', name: '教学课消核实' },
      { step: 2, role: 'principal', name: '校区校长审批' },
      { step: 3, role: 'finance', name: '总部财务终审' }
    ]

    const currentStepConfig = steps.find(s => s.step === approvalRecord.currentStep)
    if (!currentStepConfig) {
      throw new Error(`Invalid current step: ${approvalRecord.currentStep}`)
    }

    if (action === 'reject') {
      approvalRecord.status = 'rejected'
      approvalRecord.timeline.push({
        step: currentStepConfig.name,
        operator,
        comment,
        time: new Date().toISOString(),
        status: 'rejected'
      })
      return { success: true, finalStatus: 'rejected', approvalRecord }
    }

    if (action === 'pass') {
      approvalRecord.timeline.push({
        step: currentStepConfig.name,
        operator,
        comment,
        time: new Date().toISOString(),
        status: 'passed'
      })

      if (approvalRecord.currentStep >= steps.length) {
        approvalRecord.status = 'approved'
        return { success: true, finalStatus: 'approved', approvalRecord }
      } else {
        approvalRecord.currentStep += 1
        return { success: true, finalStatus: 'pending', nextStep: approvalRecord.currentStep, approvalRecord }
      }
    }

    throw new Error(`Unknown approval action: ${action}`)
  }
}

// 默认提供纯净空集合供业务测试；可随时一键清空或一键恢复预设演示数据
export const MOCK_ORDERS_DATA: OrderRecord[] = []
export const MOCK_APPROVAL_RECORDS: ApprovalRecord[] = []
export const MOCK_LEDGER_RECORDS: LedgerRecord[] = []

export function clearFinancialMockData() {
  MOCK_ORDERS_DATA.length = 0
  MOCK_APPROVAL_RECORDS.length = 0
  MOCK_LEDGER_RECORDS.length = 0
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(ORDERS_STORAGE_KEY)
  }
}

export function restoreFinancialMockData() {
  MOCK_ORDERS_DATA.length = 0
  MOCK_ORDERS_DATA.push(...JSON.parse(JSON.stringify(PRESET_MOCK_ORDERS_DATA)))
  MOCK_APPROVAL_RECORDS.length = 0
  MOCK_APPROVAL_RECORDS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_APPROVAL_RECORDS)))
  MOCK_LEDGER_RECORDS.length = 0
  MOCK_LEDGER_RECORDS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_LEDGER_RECORDS)))
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(MOCK_ORDERS_DATA))
    } catch (e) {
      console.warn('[Mock Financial] Failed to save orders to storage:', e)
    }
  }
}

// ==========================================
// 覆盖 5 大实体校区的真实订单流水 (28 笔高保真订单)
// ==========================================
export const PRESET_MOCK_ORDERS_DATA: OrderRecord[] = [
  // --- 截图真实呈现 7 笔已支付订单 (实缴总计 14000.00 元) ---
  {
    id: 'ord-ss-01',
    orderNo: '260918173041mBA01',
    studentId: 'std-ss-01',
    studentName: '牛柯森',
    studentNo: 'S948918',
    phone: '156****0125',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 0.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 0.00,
    actualAmount: 0.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-18 17:30:41',
    payTime: '2026-09-18 17:30:51',
    goodsDelivery: 'none',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '李销售',
    salesOwner: '李销售',
    channel: 'referral',
    classId: 'class-scratch-101',
    className: 'Scratch创意周末班 (周六 09:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'WX20260918173051001',
    voucherUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80',
    verifyRemark: '微信在线直付系统自动核验通过'
  },
  {
    id: 'ord-ss-02',
    orderNo: '260913134002M1B02',
    studentId: 'std-ss-02',
    studentName: '张芯语',
    studentNo: 'S765585',
    phone: '156****0033',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 3500.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 3500.00,
    actualAmount: 3500.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-13 13:40:02',
    payTime: '2026-09-13 13:40:04',
    goodsDelivery: 'delivered',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '赵金牌咨询师',
    salesOwner: '赵金牌咨询师',
    channel: 'online',
    classId: 'class-cpp-201',
    className: 'C++金牌培优班 (周六 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'ALI20260913134004002',
    voucherUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&auto=format&fit=crop&q=80',
    verifyRemark: '支付宝扫码付款到账，教材已出库'
  },
  {
    id: 'ord-ss-03',
    orderNo: '2609131124022T03',
    studentId: 'std-ss-03',
    studentName: '林恒',
    studentNo: 'S947856',
    phone: '150****7026',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    courseType: 'training',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 0.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 0.00,
    actualAmount: 0.00,
    paymentMethod: 'wallet',
    signupTime: '2026-09-13 11:24:03',
    payTime: '2026-09-13 11:24:18',
    goodsDelivery: 'none',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'referral',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WL20260913112418003',
    verifyRemark: '电子钱包课时赠送核销'
  },
  {
    id: 'ord-ss-04',
    orderNo: '260909212611CF04',
    studentId: 'std-ss-04',
    studentName: '徐森源',
    studentNo: 'S747184',
    phone: '136****1998',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 3500.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 3500.00,
    actualAmount: 3500.00,
    paymentMethod: 'pos',
    signupTime: '2026-09-09 21:26:12',
    payTime: '2026-09-09 21:26:11',
    goodsDelivery: 'delivered',
    creator: '钱学管',
    submitter: '钱学管',
    performanceOwner: '周顾问',
    salesOwner: '周顾问',
    channel: 'ground',
    classId: 'class-kiro-401',
    className: 'KIRO大颗粒机械启蒙1班 (周六 10:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'POS20260909212611004',
    voucherUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=80',
    verifyRemark: '前台刷银联POS签购单已核验入账'
  },
  {
    id: 'ord-ss-05',
    orderNo: '260905212114tRA05',
    studentId: 'std-ss-05',
    studentName: '李有意',
    studentNo: 'S945819',
    phone: '156****0124',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 3500.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 3500.00,
    actualAmount: 3500.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-05 21:21:14',
    payTime: '2026-09-05 21:21:16',
    goodsDelivery: 'delivered',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '李销售',
    salesOwner: '李销售',
    channel: 'meituan',
    classId: 'class-ev3-501',
    className: 'EV3机器人工程实战1班 (周日 15:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'WX20260905212116005',
    voucherUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80',
    verifyRemark: '美团团购券线上核销完成'
  },
  {
    id: 'ord-ss-06',
    orderNo: '260905194632ofj06',
    studentId: 'std-ss-06',
    studentName: '陈鹏飞',
    studentNo: 'S945787',
    phone: '156****0123',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 3500.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 3500.00,
    actualAmount: 3500.00,
    paymentMethod: 'bank_transfer',
    signupTime: '2026-09-05 19:46:32',
    payTime: '2026-09-05 19:46:40',
    goodsDelivery: 'delivered',
    creator: '王学管',
    submitter: '王学管',
    performanceOwner: '赵金牌咨询师',
    salesOwner: '赵金牌咨询师',
    channel: 'online',
    classId: 'class-cpp-201',
    className: 'C++金牌培优班 (周六 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'BK20260905194640006',
    voucherUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&auto=format&fit=crop&q=80',
    verifyRemark: '招商银行对公账户转账已核验到账'
  },
  {
    id: 'ord-ss-07',
    orderNo: '2609041534144Y07',
    studentId: 'std-ss-07',
    studentName: '毛森帅',
    studentNo: 'S804771',
    phone: '130****8820',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    courseType: 'trial',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 0.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 0.00,
    actualAmount: 0.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-04 15:34:14',
    payTime: '2026-09-04 15:34:34',
    goodsDelivery: 'none',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '李销售',
    salesOwner: '李销售',
    channel: 'natural',
    classId: 'class-scratch-102',
    className: 'Scratch进阶周日班 (周日 10:30)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260904153434007',
    verifyRemark: '公开体验课 0 元试听合同归档'
  },

  // --- 经典基石订单 (覆盖总部校区大额学费、续费) ---
  {
    id: 'ord-001',
    orderNo: '260918173041mBA01_v2',
    studentId: 'std-001',
    studentName: '张小萌',
    studentNo: 'S948918',
    phone: '138****5678',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 14400.00,
    discountAmount: 1400.00,
    couponAmount: 0.00,
    receivableAmount: 13000.00,
    actualAmount: 13000.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-18 17:30:41',
    payTime: '2026-09-18 17:31:05',
    goodsDelivery: 'delivered',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '李销售',
    salesOwner: '李销售',
    channel: 'referral',
    classId: 'class-scratch-101',
    className: 'Scratch创意周末班 (周六 09:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'WX20260918173105008',
    verifyRemark: '秋季学期新签常规班学费'
  },
  {
    id: 'ord-002',
    orderNo: '260919101235kCD02',
    studentId: 'std-002',
    studentName: '李浩轩',
    studentNo: 'S765585',
    phone: '156****3344',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 64000.00,
    discountAmount: 4000.00,
    couponAmount: 2000.00,
    receivableAmount: 58000.00,
    actualAmount: 58000.00,
    paymentMethod: 'bank_transfer',
    signupTime: '2026-09-19 10:12:35',
    payTime: '2026-09-19 10:45:12',
    goodsDelivery: 'delivered',
    creator: '王学管',
    submitter: '王学管',
    performanceOwner: '赵金牌咨询师',
    salesOwner: '赵金牌咨询师',
    channel: 'online',
    classId: 'class-cpp-201',
    className: 'C++金牌培优班 (周六 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'BK20260919104512009',
    verifyRemark: '信奥金牌培优年度合同大额入账'
  },

  // --- 远洋校区订单 (季度扣费、钱包充值、常规学费) ---
  {
    id: 'ord-003',
    orderNo: '260920092211pEF03',
    studentId: 'std-003',
    studentName: '王紫涵',
    studentNo: 'S889920',
    phone: '139****6655',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    courseType: 'regular',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'quarterly',
    chargeType: 'quarterly',
    status: 'unpaid',
    orderStatus: 'unpaid',
    originalPrice: 16800.00,
    discountAmount: 800.00,
    couponAmount: 0.00,
    receivableAmount: 16000.00,
    actualAmount: 16000.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-20 09:22:11',
    goodsDelivery: 'undelivered',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'ground',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'unsigned',
    isLocked: false
  },
  {
    id: 'ord-005',
    orderNo: '260921101500y05',
    studentId: 'std-005',
    studentName: '许子涵',
    studentNo: 'S883499',
    phone: '135****4433',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    courseType: 'regular',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 19800.00,
    discountAmount: 1300.00,
    couponAmount: 0.00,
    receivableAmount: 18500.00,
    actualAmount: 18500.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-21 10:15:00',
    payTime: '2026-09-21 10:16:22',
    goodsDelivery: 'delivered',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'referral',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'ALI20260921101622010',
    verifyRemark: '远洋校区新报班常规学费'
  },
  {
    id: 'ord-006',
    orderNo: '260921113000z06',
    studentId: 'std-006',
    studentName: '郑泽洋',
    studentNo: 'S449811',
    phone: '136****5566',
    courseName: '电子钱包预存资金池',
    courseType: 'activity',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'wallet_recharge',
    chargeType: 'wallet_recharge',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 5000.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 5000.00,
    actualAmount: 5000.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 11:30:00',
    payTime: '2026-09-21 11:30:15',
    goodsDelivery: 'none',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'online',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260921113015011',
    verifyRemark: '学员电子钱包充值预收款'
  },
  {
    id: 'ord-007',
    orderNo: '260921142000a07',
    studentId: 'std-007',
    studentName: '崔雅琳',
    studentNo: 'S892398',
    phone: '137****6677',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    courseType: 'regular',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'void',
    orderStatus: 'void',
    originalPrice: 4800.00,
    discountAmount: 300.00,
    couponAmount: 0.00,
    receivableAmount: 4500.00,
    actualAmount: 4500.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-15 14:20:00',
    goodsDelivery: 'none',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'ground',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'void',
    isLocked: false,
    remark: '超时未支付系统自动作废释放锁位'
  },

  // --- 朝阳校区订单 (已驳回单、退费负数单、常规学费) ---
  {
    id: 'ord-004',
    orderNo: '260920141520xGH04',
    studentId: 'std-004',
    studentName: '赵子睿',
    studentNo: 'S652219',
    phone: '177****2233',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    courseType: 'regular',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'rejected',
    orderStatus: 'rejected',
    originalPrice: 8320.00,
    discountAmount: 320.00,
    couponAmount: 0.00,
    receivableAmount: 8000.00,
    actualAmount: 8000.00,
    paymentMethod: 'pos',
    signupTime: '2026-09-20 14:15:20',
    goodsDelivery: 'none',
    creator: '钱学管',
    submitter: '钱学管',
    performanceOwner: '周顾问',
    salesOwner: '周顾问',
    channel: 'ground',
    classId: 'class-kiro-401',
    className: 'KIRO大颗粒机械启蒙1班 (周六 10:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'unsigned',
    auditor: '赵六审核员',
    isLocked: false,
    remark: '银行流水凭证模糊，请重新上传后提审'
  },
  {
    id: 'ord-008',
    orderNo: '260921151000b08',
    studentId: 'std-008',
    studentName: '吴雨桐',
    studentNo: 'S551203',
    phone: '138****7788',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    courseType: 'regular',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    orderType: 'refund',
    chargeType: 'refund',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 0.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: -3200.00,
    actualAmount: -3200.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 15:10:00',
    payTime: '2026-09-21 15:15:30',
    goodsDelivery: 'none',
    creator: '钱学管',
    submitter: '钱学管',
    performanceOwner: '周顾问',
    salesOwner: '周顾问',
    channel: 'online',
    classId: 'class-python-302',
    className: 'Python数据可视化B班 (周日 09:30)',
    studentStatus: 'transferred',
    abnormalStatus: 'refund',
    invoiceStatus: 'unissued',
    contractSigned: 'void',
    auditor: '王财务',
    isLocked: true,
    transactionId: 'REF20260921151530012',
    verifyRemark: '三级审批通过：出纳微信原路退费 ¥3,200.00'
  },
  {
    id: 'ord-009',
    orderNo: '260921160000c09',
    studentId: 'std-009',
    studentName: '彭宇轩',
    studentNo: 'S774510',
    phone: '139****8899',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    courseType: 'regular',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'unpaid',
    orderStatus: 'unpaid',
    originalPrice: 6800.00,
    discountAmount: 400.00,
    couponAmount: 0.00,
    receivableAmount: 6400.00,
    actualAmount: 6400.00,
    paymentMethod: 'pos',
    signupTime: '2026-09-21 16:00:00',
    goodsDelivery: 'undelivered',
    creator: '钱学管',
    submitter: '钱学管',
    performanceOwner: '周顾问',
    salesOwner: '周顾问',
    channel: 'ground',
    classId: 'class-kiro-401',
    className: 'KIRO大颗粒机械启蒙1班 (周六 10:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    isLocked: false
  },

  // --- 海淀分校订单 (季度扣费、服务费、换课差额、退费) ---
  {
    id: 'ord-010',
    orderNo: '260921163000d10',
    studentId: 'std-010',
    studentName: '孙羽涵',
    studentNo: 'S773412',
    phone: '150****1122',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    orderType: 'quarterly',
    chargeType: 'quarterly',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 5000.00,
    discountAmount: 200.00,
    couponAmount: 0.00,
    receivableAmount: 4800.00,
    actualAmount: 4800.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 16:30:00',
    payTime: '2026-09-21 16:32:10',
    goodsDelivery: 'delivered',
    creator: '李老师',
    submitter: '李老师',
    performanceOwner: '李老师',
    salesOwner: '李老师',
    channel: 'referral',
    classId: 'class-cpp-202',
    className: 'C++算法联赛1班 (周日 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260921163210013',
    verifyRemark: '海淀分校Q3季度课程学费扣缴成功'
  },
  {
    id: 'ord-011',
    orderNo: '260921170000e11',
    studentId: 'std-011',
    studentName: '冯俊杰',
    studentNo: 'S338722',
    phone: '151****2233',
    courseName: '全国青少年信息素养大赛代报考服务',
    courseType: 'activity',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    orderType: 'service_fee',
    chargeType: 'service_fee',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 600.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 600.00,
    actualAmount: 600.00,
    paymentMethod: 'pos',
    signupTime: '2026-09-21 17:00:00',
    payTime: '2026-09-21 17:01:45',
    goodsDelivery: 'none',
    creator: '李老师',
    submitter: '李老师',
    performanceOwner: '李老师',
    salesOwner: '李老师',
    channel: 'online',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'POS20260921170145014',
    verifyRemark: '白名单国家级赛考报名代办费'
  },
  {
    id: 'ord-012',
    orderNo: '260921172000f12',
    studentId: 'std-012',
    studentName: '董博文',
    studentNo: 'S665621',
    phone: '152****3344',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    orderType: 'refund',
    chargeType: 'refund',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 0.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: -1500.00,
    actualAmount: -1500.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 17:20:00',
    payTime: '2026-09-21 17:25:10',
    goodsDelivery: 'none',
    creator: '李老师',
    submitter: '李老师',
    performanceOwner: '李老师',
    salesOwner: '李老师',
    channel: 'online',
    studentStatus: 'suspended',
    abnormalStatus: 'suspend',
    invoiceStatus: 'unissued',
    contractSigned: 'void',
    auditor: '王财务',
    isLocked: true,
    transactionId: 'REF20260921172510015',
    verifyRemark: '因病停课休学退费差额'
  },
  {
    id: 'ord-013',
    orderNo: '260921174000g13',
    studentId: 'std-013',
    studentName: '沈奕辰',
    studentNo: 'S110176',
    phone: '153****4455',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    orderType: 'change_course_diff',
    chargeType: 'change_course_diff',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 2400.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 2400.00,
    actualAmount: 2400.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 17:40:00',
    payTime: '2026-09-21 17:41:30',
    goodsDelivery: 'delivered',
    creator: '李老师',
    submitter: '李老师',
    performanceOwner: '李老师',
    salesOwner: '李老师',
    channel: 'referral',
    classId: 'class-cpp-202',
    className: 'C++算法联赛1班 (周日 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'change_course',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260921174130016',
    verifyRemark: 'Scratch 转升 C++ 班级课时单价差额补交'
  },

  // --- 望京校区订单 (EV3机器人、代报考、常规未支付、驳回单) ---
  {
    id: 'ord-014',
    orderNo: '260921180000h14',
    studentId: 'std-014',
    studentName: '周子轩',
    studentNo: 'S662190',
    phone: '158****5566',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    courseType: 'regular',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    orderType: 'change_course_diff',
    chargeType: 'change_course_diff',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 13800.00,
    discountAmount: 1000.00,
    couponAmount: 0.00,
    receivableAmount: 12800.00,
    actualAmount: 12800.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-21 18:00:00',
    payTime: '2026-09-21 18:02:15',
    goodsDelivery: 'delivered',
    creator: '赵老师',
    submitter: '赵老师',
    performanceOwner: '赵老师',
    salesOwner: '赵老师',
    channel: 'ground',
    classId: 'class-ev3-501',
    className: 'EV3机器人工程实战1班 (周日 15:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'ALI20260921180215017',
    verifyRemark: '中鸣KIRO升级乐高EV3工程班学费'
  },
  {
    id: 'ord-015',
    orderNo: '260921183000i15',
    studentId: 'std-015',
    studentName: '袁铭泽',
    studentNo: 'S447843',
    phone: '159****6677',
    courseName: 'WRO机器人国际奥林匹克竞赛代报考',
    courseType: 'activity',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    orderType: 'service_fee',
    chargeType: 'service_fee',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 450.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 450.00,
    actualAmount: 450.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-21 18:30:00',
    payTime: '2026-09-21 18:31:05',
    goodsDelivery: 'none',
    creator: '赵老师',
    submitter: '赵老师',
    performanceOwner: '赵老师',
    salesOwner: '赵老师',
    channel: 'online',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260921183105018',
    verifyRemark: '赛考代办费'
  },
  {
    id: 'ord-016',
    orderNo: '260921190000j16',
    studentId: 'std-016',
    studentName: '陈思琪',
    studentNo: 'S227633',
    phone: '186****7788',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    courseType: 'regular',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'unpaid',
    orderStatus: 'unpaid',
    originalPrice: 16000.00,
    discountAmount: 1000.00,
    couponAmount: 0.00,
    receivableAmount: 15000.00,
    actualAmount: 15000.00,
    paymentMethod: 'bank_transfer',
    signupTime: '2026-09-21 19:00:00',
    goodsDelivery: 'undelivered',
    creator: '赵老师',
    submitter: '赵老师',
    performanceOwner: '赵老师',
    salesOwner: '赵老师',
    channel: 'referral',
    classId: 'class-ev3-501',
    className: 'EV3机器人工程实战1班 (周日 15:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'unsigned',
    isLocked: false
  },
  {
    id: 'ord-017',
    orderNo: '260921193000k17',
    studentId: 'std-017',
    studentName: '姜昊天',
    studentNo: 'S901287',
    phone: '187****8899',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    courseType: 'regular',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'rejected',
    orderStatus: 'rejected',
    originalPrice: 12500.00,
    discountAmount: 500.00,
    couponAmount: 0.00,
    receivableAmount: 12000.00,
    actualAmount: 12000.00,
    paymentMethod: 'pos',
    signupTime: '2026-09-21 19:30:00',
    goodsDelivery: 'none',
    creator: '赵老师',
    submitter: '赵老师',
    performanceOwner: '赵老师',
    salesOwner: '赵老师',
    channel: 'ground',
    classId: 'class-ev3-501',
    className: 'EV3机器人工程实战1班 (周日 15:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'unsigned',
    auditor: '王财务',
    isLocked: false,
    remark: '刷卡凭条商户号不匹配，驳回重新上传核验'
  },

  // --- 更多补充跨校区订单 ---
  {
    id: 'ord-018',
    orderNo: '260921200000l18',
    studentId: 'std-018',
    studentName: '蒋博文',
    studentNo: 'S116544',
    phone: '188****9900',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    courseType: 'regular',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'void',
    orderStatus: 'void',
    originalPrice: 10000.00,
    discountAmount: 400.00,
    couponAmount: 0.00,
    receivableAmount: 9600.00,
    actualAmount: 9600.00,
    paymentMethod: 'alipay',
    signupTime: '2026-09-12 10:00:00',
    goodsDelivery: 'none',
    creator: '张学管',
    submitter: '张学管',
    performanceOwner: '李销售',
    salesOwner: '李销售',
    channel: 'online',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'unissued',
    contractSigned: 'void',
    isLocked: false,
    remark: '学员家长撤销报名意向，订单作废'
  },
  {
    id: 'ord-019',
    orderNo: '260921203000m19',
    studentId: 'std-019',
    studentName: '韩雨诺',
    studentNo: 'S992388',
    phone: '133****1122',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    courseType: 'regular',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    orderType: 'quarterly',
    chargeType: 'quarterly',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 7500.00,
    discountAmount: 300.00,
    couponAmount: 0.00,
    receivableAmount: 7200.00,
    actualAmount: 7200.00,
    paymentMethod: 'wechat',
    signupTime: '2026-09-20 11:00:00',
    payTime: '2026-09-20 11:02:15',
    goodsDelivery: 'delivered',
    creator: '李老师',
    submitter: '李老师',
    performanceOwner: '李老师',
    salesOwner: '李老师',
    channel: 'referral',
    classId: 'class-cpp-202',
    className: 'C++算法联赛1班 (周日 14:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'WX20260920110215019',
    verifyRemark: '海淀分校季度扣费'
  },
  {
    id: 'ord-020',
    orderNo: '260921210000n20',
    studentId: 'std-020',
    studentName: '潘若曦',
    studentNo: 'S556732',
    phone: '134****2233',
    courseName: '电子钱包大额预存成长基金',
    courseType: 'activity',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    orderType: 'wallet_recharge',
    chargeType: 'wallet_recharge',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 10000.00,
    discountAmount: 0.00,
    couponAmount: 0.00,
    receivableAmount: 10000.00,
    actualAmount: 10000.00,
    paymentMethod: 'bank_transfer',
    signupTime: '2026-09-18 15:00:00',
    payTime: '2026-09-18 15:10:20',
    goodsDelivery: 'none',
    creator: '王学管',
    submitter: '王学管',
    performanceOwner: '赵金牌咨询师',
    salesOwner: '赵金牌咨询师',
    channel: 'online',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '王财务',
    isLocked: false,
    transactionId: 'BK20260918151020020',
    verifyRemark: '总部财务已确认对公来款 ¥10,000.00'
  },
  {
    id: 'ord-021',
    orderNo: '260921213000o21',
    studentId: 'std-021',
    studentName: '陆思彤',
    studentNo: 'S338954',
    phone: '135****3344',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    courseType: 'regular',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    orderType: 'regular',
    chargeType: 'regular',
    status: 'paid',
    orderStatus: 'paid',
    originalPrice: 22000.00,
    discountAmount: 1000.00,
    couponAmount: 0.00,
    receivableAmount: 21000.00,
    actualAmount: 21000.00,
    paymentMethod: 'bank_transfer',
    signupTime: '2026-09-17 09:30:00',
    payTime: '2026-09-17 09:45:10',
    goodsDelivery: 'delivered',
    creator: '孙学管',
    submitter: '孙学管',
    performanceOwner: '孙学管',
    salesOwner: '孙学管',
    channel: 'meituan',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    studentStatus: 'reading',
    abnormalStatus: 'normal',
    invoiceStatus: 'issued',
    contractSigned: 'signed',
    auditor: '李核算',
    isLocked: false,
    transactionId: 'BK20260917094510021',
    verifyRemark: '远洋校区招商银行对公入账'
  }
]

// ==========================================
// 业务与资金多级审批流单据 (支持 3 级状态流转)
// ==========================================
export const PRESET_MOCK_APPROVAL_RECORDS: ApprovalRecord[] = [
  {
    id: 'app-001',
    approvalNo: 'APPR-2026-0918-001',
    businessType: 'payment',
    sourceId: 'ord-001',
    applicantName: '张学管',
    applicantId: 'usr-zhang-01',
    studentName: '张小萌',
    studentNo: 'S948918',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    amount: 13000.00,
    status: 'approved',
    currentStep: 3,
    createdAt: '2026-09-18 17:31:05',
    orderNo: '260918173041mBA01_v2',
    reason: '秋季新签报读 Scratch 课程常规学费到账复核',
    timeline: [
      { step: '教学课消核实', operator: '王教学主管', comment: '合同信息及课程课时核实无误', time: '2026-09-18 17:35:00', status: 'passed' },
      { step: '校区校长审批', operator: '张校长', comment: '同意报读收款', time: '2026-09-18 17:40:00', status: 'passed' },
      { step: '总部财务终审', operator: '王财务', comment: '微信商户流水到账无误，完成核销', time: '2026-09-18 17:45:00', status: 'passed' }
    ]
  },
  {
    id: 'app-002',
    approvalNo: 'APPR-2026-0920-002',
    businessType: 'refund',
    sourceId: 'ord-008',
    applicantName: '钱学管',
    applicantId: 'usr-qian-02',
    studentName: '吴雨桐',
    studentNo: 'S551203',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    amount: 3200.00,
    status: 'approved',
    currentStep: 3,
    createdAt: '2026-09-20 14:00:00',
    orderNo: '260921151000b08',
    reason: '学员家庭因搬家跨区，申请退还剩余 16 课时费用 ¥3,200.00',
    timeline: [
      { step: '教学课消核实', operator: '刘教学主管', comment: '已上8课时，剩余16课时，扣除教材费后应退3200元', time: '2026-09-20 14:30:00', status: 'passed' },
      { step: '校区校长审批', operator: '李朝阳校长', comment: '沟通挽留无果，核准退款申请', time: '2026-09-20 15:00:00', status: 'passed' },
      { step: '总部财务终审', operator: '王财务', comment: '原路退回微信已执行下发', time: '2026-09-20 15:30:00', status: 'passed' }
    ]
  },
  {
    id: 'app-003',
    approvalNo: 'APPR-2026-0921-003',
    businessType: 'quarterly',
    sourceId: 'ord-003',
    applicantName: '孙学管',
    applicantId: 'usr-sun-03',
    studentName: '王紫涵',
    studentNo: 'S889920',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    amount: 16000.00,
    status: 'pending',
    currentStep: 2, // 待校区校长审批
    createdAt: '2026-09-21 09:30:00',
    orderNo: '260920092211pEF03',
    reason: '远洋校区2026Q3季度学费统筹扣缴划拨提审',
    timeline: [
      { step: '教学课消核实', operator: '王远洋教学总监', comment: '核对课表学员出勤率98%，符合季度扣款标准', time: '2026-09-21 10:00:00', status: 'passed' }
    ]
  },
  {
    id: 'app-004',
    approvalNo: 'APPR-2026-0921-004',
    businessType: 'refund',
    sourceId: 'ord-012',
    applicantName: '李老师',
    applicantId: 'usr-li-04',
    studentName: '董博文',
    studentNo: 'S665621',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    amount: 1500.00,
    status: 'pending',
    currentStep: 1, // 步骤1：教学课消核实
    createdAt: '2026-09-21 17:20:00',
    orderNo: '260921172000f12',
    reason: '学员突发疾病骨折需住院停课，申请退还本期未修课时费',
    timeline: []
  },
  {
    id: 'app-005',
    approvalNo: 'APPR-2026-0921-005',
    businessType: 'payment',
    sourceId: 'ord-004',
    applicantName: '钱学管',
    applicantId: 'usr-qian-02',
    studentName: '赵子睿',
    studentNo: 'S652219',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    amount: 8000.00,
    status: 'rejected',
    currentStep: 1,
    createdAt: '2026-09-20 14:15:20',
    orderNo: '260920141520xGH04',
    reason: '前台 POS 刷卡签约常规班提审',
    timeline: [
      { step: '教学课消核实', operator: '赵六审核员', comment: '银行流水凭证模糊且金额有涂改痕迹，请重新上传清晰凭证', time: '2026-09-20 14:45:00', status: 'rejected' }
    ]
  },
  {
    id: 'app-006',
    approvalNo: 'APPR-2026-0921-006',
    businessType: 'wallet_prestore',
    sourceId: 'ord-006',
    applicantName: '孙学管',
    applicantId: 'usr-sun-03',
    studentName: '郑泽洋',
    studentNo: 'S449811',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    amount: 5000.00,
    status: 'pending',
    currentStep: 3, // 待总部财务终审
    createdAt: '2026-09-21 11:30:00',
    orderNo: '260921113000z06',
    reason: '学员家长一次性预存 5000 元至系统钱包并申请赠送 500 元课消券',
    timeline: [
      { step: '教学课消核实', operator: '王远洋教学总监', comment: '符合预存赠送营销政策', time: '2026-09-21 11:40:00', status: 'passed' },
      { step: '校区校长审批', operator: '孙远洋校长', comment: '同意按协议预存赠券', time: '2026-09-21 11:50:00', status: 'passed' }
    ]
  }
]

// ==========================================
// 校区收费流水总账本 (资金进出风控)
// ==========================================
export const PRESET_MOCK_LEDGER_RECORDS: LedgerRecord[] = [
  {
    transNo: 'TX20260918001',
    orderNo: '260918173041mBA01_v2',
    date: '2026-09-18 17:31:05',
    student: '张小萌',
    studentNo: 'S948918',
    type: '新签报读',
    amount: 13000.00,
    method: '微信商户号',
    verifier: '王会计',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '线上微信扫码直付'
  },
  {
    transNo: 'TX20260919002',
    orderNo: '260919101235kCD02',
    date: '2026-09-19 10:45:12',
    student: '李浩轩',
    studentNo: 'S765585',
    type: '续费培优',
    amount: 58000.00,
    method: '招商银行对公',
    verifier: '王会计',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '招行网银对公电汇'
  },
  {
    transNo: 'TX20260920003',
    orderNo: '260909212611CF04',
    date: '2026-09-09 21:26:11',
    student: '徐森源',
    studentNo: 'S747184',
    type: '新签报读',
    amount: 3500.00,
    method: '银联POS',
    verifier: '李出纳',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '前台刷卡签购'
  },
  {
    transNo: 'TX20260921004',
    orderNo: '260905212114tRA05',
    date: '2026-09-05 21:21:16',
    student: '李有意',
    studentNo: 'S945819',
    type: '新签报读',
    amount: 3500.00,
    method: '微信商户号',
    verifier: '王会计',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '美团线上代金券核销'
  },
  {
    transNo: 'TX20260921005',
    orderNo: '260905194632ofj06',
    date: '2026-09-05 19:46:40',
    student: '陈鹏飞',
    studentNo: 'S945787',
    type: '新签报读',
    amount: 3500.00,
    method: '招商银行对公',
    verifier: '王会计',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '大额银行网银转账'
  },
  {
    transNo: 'TX20260921006',
    orderNo: '260921101500y05',
    date: '2026-09-21 10:16:22',
    student: '许子涵',
    studentNo: 'S883499',
    type: '新签报读',
    amount: 18500.00,
    method: '支付宝生活号',
    verifier: '李出纳',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: '已核销',
    remark: '支付宝花呗分期付款'
  },
  {
    transNo: 'TX20260921007',
    orderNo: '260921113000z06',
    date: '2026-09-21 11:30:15',
    student: '郑泽洋',
    studentNo: 'S449811',
    type: '钱包充值',
    amount: 5000.00,
    method: '微信商户号',
    verifier: '李出纳',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: '已核销',
    remark: '电子钱包资金充值'
  },
  {
    transNo: 'TX20260921008',
    orderNo: '260921151000b08',
    date: '2026-09-21 15:15:30',
    student: '吴雨桐',
    studentNo: 'S551203',
    type: '退费返还',
    amount: -3200.00,
    method: '微信商户号',
    verifier: '王会计',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    status: '已退款',
    remark: '三级审核退款出纳打款'
  },
  {
    transNo: 'TX20260921009',
    orderNo: '260921163000d10',
    date: '2026-09-21 16:32:10',
    student: '孙羽涵',
    studentNo: 'S773412',
    type: '季度扣费',
    amount: 4800.00,
    method: '微信商户号',
    verifier: '张出纳',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: '已核销',
    remark: 'Q3季度协议定时扣费'
  },
  {
    transNo: 'TX20260921010',
    orderNo: '260921170000e11',
    date: '2026-09-21 17:01:45',
    student: '冯俊杰',
    studentNo: 'S338722',
    type: '代报考服务费',
    amount: 600.00,
    method: '银联POS',
    verifier: '张出纳',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: '已核销',
    remark: '教育部白名单赛考代办费'
  },
  {
    transNo: 'TX20260921011',
    orderNo: '260921174000g13',
    date: '2026-09-21 17:41:30',
    student: '沈奕辰',
    studentNo: 'S110176',
    type: '换课差额',
    amount: 2400.00,
    method: '微信商户号',
    verifier: '张出纳',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: '已核销',
    remark: '转入金牌信奥班课消单价补差'
  },
  {
    transNo: 'TX20260921012',
    orderNo: '260921180000h14',
    date: '2026-09-21 18:02:15',
    student: '周子轩',
    studentNo: 'S662190',
    type: '换课差额',
    amount: 12800.00,
    method: '支付宝生活号',
    verifier: '李出纳',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: '已核销',
    remark: '乐高EV3升级报读'
  },
  {
    transNo: 'TX20260921013',
    orderNo: '260921183000i15',
    date: '2026-09-21 18:31:05',
    student: '袁铭泽',
    studentNo: 'S447843',
    type: '代报考服务费',
    amount: 450.00,
    method: '微信商户号',
    verifier: '李出纳',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: '已核销',
    remark: 'WRO国际赛代办'
  },
  {
    transNo: 'TX20260921014',
    orderNo: '260921210000n20',
    date: '2026-09-18 15:10:20',
    student: '潘若曦',
    studentNo: 'S556732',
    type: '钱包充值',
    amount: 10000.00,
    method: '招商银行对公',
    verifier: '王会计',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: '已核销',
    remark: '大额资金池充值'
  },
  {
    transNo: 'TX20260921015',
    orderNo: '260921213000o21',
    date: '2026-09-17 09:45:10',
    student: '陆思彤',
    studentNo: 'S338954',
    type: '新签报读',
    amount: 21000.00,
    method: '招商银行对公',
    verifier: '李出纳',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: '已核销',
    remark: '招行银企直联到账'
  }
]

// ==========================================
// 业务中台数据服务
// ==========================================

// 获取指定校区的订单流水列表
export function getOrdersByCampus(campusId?: string): OrderRecord[] {
  // 总部校区权限或未指定校区时，可统筹核算全量 5 大校区订单；分校区仅返回归属于本校区的订单
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001' || campusId === 'CAMPUS_HQ' || campusId === 'all') {
    return [...MOCK_ORDERS_DATA]
  }
  return MOCK_ORDERS_DATA.filter(o => isCampusMatch(o.campusId, campusId))
}

const ORDERS_STORAGE_KEY = 'yixiao_mock_orders_v3'

// 初始化从 localStorage 恢复自定义订单流水
try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const isCleared = localStorage.getItem('yixiao_mock_data_cleared') === 'true'
    const migrated = localStorage.getItem('yixiao_mock_v5_cleared')

    if (!migrated) {
      localStorage.removeItem(ORDERS_STORAGE_KEY)
    } else if (isCleared) {
      // 已清空模式：仅恢复测试期间用户新增自建的订单
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY)
      if (saved) {
        const list: OrderRecord[] = JSON.parse(saved)
        if (Array.isArray(list) && list.length > 0) {
          MOCK_ORDERS_DATA.length = 0
          MOCK_ORDERS_DATA.push(...list)
        }
      }
    } else {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY)
      if (saved) {
        const list: OrderRecord[] = JSON.parse(saved)
        if (Array.isArray(list) && list.length > 0) {
          MOCK_ORDERS_DATA.length = 0
          MOCK_ORDERS_DATA.push(...list)
        }
      }
    }
  }
} catch (e) {
  console.warn('[Mock Financial] Failed to restore orders from storage:', e)
}

if (typeof window === 'undefined') {
  restoreFinancialMockData()
}

export function syncOrdersToStorage() {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(MOCK_ORDERS_DATA))
    }
  } catch (e) {
    console.warn('[Mock Financial] Failed to sync orders to storage:', e)
  }
}

// 保存或更新订单
export function saveOrder(order: OrderRecord): OrderRecord {
  const index = MOCK_ORDERS_DATA.findIndex(o => o.id === order.id || o.orderNo === order.orderNo)
  let resultOrder: OrderRecord
  if (index >= 0) {
    MOCK_ORDERS_DATA[index] = { ...order }
    resultOrder = MOCK_ORDERS_DATA[index]
  } else {
    const newOrder: OrderRecord = {
      ...order,
      id: order.id || `ord-${Date.now()}`,
      orderNo: order.orderNo || `ORD${Date.now()}`
    }
    MOCK_ORDERS_DATA.unshift(newOrder)
    resultOrder = newOrder
  }
  syncOrdersToStorage()
  return resultOrder
}

// 订单作废 (边界防御：已支付订单禁止直接作废，必须走退费审批流)
export function voidOrder(orderId: string): boolean {
  const order = MOCK_ORDERS_DATA.find(o => o.id === orderId || o.orderNo === orderId)
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  if (order.status === 'paid' || order.orderStatus === 'paid') {
    throw new Error('Cannot void a paid order directly. Please initiate refund approval flow (必须走退费流)')
  }
  if (order.status === 'void' || order.orderStatus === 'void') {
    throw new Error('Order is already voided')
  }

  order.status = 'void'
  order.orderStatus = 'void'
  syncOrdersToStorage()
  return true
}

// 订单修改 (带锁定期校验)
export function updateOrder(payload: Partial<OrderRecord> & { id: string }): OrderRecord {
  const order = MOCK_ORDERS_DATA.find(o => o.id === payload.id)
  if (!order) {
    throw new Error(`Order not found: ${payload.id}`)
  }
  if (order.isLocked) {
    throw new Error('Order is locked by finance closing cycle, modification prohibited')
  }

  Object.assign(order, payload)
  syncOrdersToStorage()
  return order
}

// 更新收款凭证
export function updateOrderVoucher(orderId: string, voucherData: Partial<PaymentVoucherInfo>): OrderRecord {
  const order = MOCK_ORDERS_DATA.find(o => o.id === orderId || o.orderNo === orderId)
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  if (voucherData.transactionId) order.transactionId = voucherData.transactionId
  if (voucherData.voucherImages && voucherData.voucherImages.length > 0) {
    order.voucherUrl = voucherData.voucherImages[0]
  }
  if (voucherData.auditRemark) order.verifyRemark = voucherData.auditRemark
  if (voucherData.auditor) order.auditor = voucherData.auditor

  syncOrdersToStorage()
  return order
}

// 获取审批单列表
export function getApprovalRecords(campusId?: string, businessType?: string): ApprovalRecord[] {
  let list = [...MOCK_APPROVAL_RECORDS]
  if (campusId && campusId !== 'all' && campusId !== 'campus-bj-hq' && campusId !== 'CAMPUS_HQ' && campusId !== 'HQ001') {
    list = list.filter(a => isCampusMatch(a.campusId, campusId))
  }
  if (businessType && businessType !== 'all') {
    list = list.filter(a => a.businessType === businessType)
  }
  return list
}

// 推进单条审批单
export function processApprovalRecord(
  approvalId: string,
  action: 'pass' | 'reject',
  operator: string,
  comment: string = ''
): ApprovalRecord {
  const record = MOCK_APPROVAL_RECORDS.find(a => a.id === approvalId || a.approvalNo === approvalId)
  if (!record) {
    throw new Error(`Approval record not found: ${approvalId}`)
  }

  FinanceAggregator.processApproval(record, action, operator, comment)

  // 审批结果反哺联动：若退费终审通过，更新对应订单流水状态为退费完成
  if (record.businessType === 'refund' && record.status === 'approved' && record.sourceId) {
    const order = MOCK_ORDERS_DATA.find(o => o.id === record.sourceId || o.orderNo === record.orderNo)
    if (order) {
      order.actualAmount = -Math.abs(record.amount)
      order.receivableAmount = -Math.abs(record.amount)
      order.status = 'paid'
      order.orderStatus = 'paid'
      order.isLocked = true
      order.verifyRemark = `退费审批单 ${record.approvalNo} 终审通过已执行退款`
    }
  }

  return record
}

// 获取收费流水账本
export function getLedgerRecords(campusId?: string, query?: { method?: string; type?: string; startDate?: string; endDate?: string }): LedgerRecord[] {
  let list = [...MOCK_LEDGER_RECORDS]
  if (campusId && campusId !== 'all' && campusId !== 'campus-bj-hq' && campusId !== 'CAMPUS_HQ' && campusId !== 'HQ001') {
    list = list.filter(l => isCampusMatch(l.campusId, campusId))
  }
  if (query) {
    if (query.method && query.method !== 'all') {
      list = list.filter(l => l.method === query.method)
    }
    if (query.type && query.type !== 'all') {
      list = list.filter(l => l.type === query.type)
    }
    if (query.startDate) {
      list = list.filter(l => l.date.split(' ')[0] >= query.startDate!)
    }
    if (query.endDate) {
      list = list.filter(l => l.date.split(' ')[0] <= query.endDate!)
    }
  }
  return list
}
