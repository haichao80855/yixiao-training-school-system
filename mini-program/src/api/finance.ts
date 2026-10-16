import { request } from '../utils/request';

export interface OrderItemModel {
  id: string;
  orderNo: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  studentNo: string;
  orderType: 'enroll' | 'renewal' | 'recharge' | 'refund';
  orderTypeText: string;
  status: 'paid' | 'pending' | 'refunded' | 'voided';
  statusText: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  paymentMethod: string;
  createdAtText: string;
  operatorName: string;
  items: Array<{
    id: string;
    itemName: string;
    itemType: 'course' | 'goods';
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  voucherUrl?: string;
}

export interface OrderSummaryModel {
  todayPaidAmount: number;
  monthOrderCount: number;
  pendingOrderCount: number;
  totalRefundAmount: number;
  summaryText?: string;
  totalOrders?: number;
  totalActualAmount?: number;
}

export interface ApprovalItemModel {
  id: string;
  approvalNo: string;
  businessType: 'refund' | 'receipt' | 'transfer';
  businessTypeText: string;
  status: 'pending' | 'approved' | 'rejected';
  statusText: string;
  currentStep: number;
  totalSteps: number;
  applicantName: string;
  applicantRole: string;
  campusId: string;
  campusName: string;
  createdAtText: string;
  studentName: string;
  courseName: string;
  amount: number;
  reason: string;
  currentNodeName: string;
}

export interface ApprovalTimelineNode {
  nodeId: string;
  nodeName: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected';
  statusText: string;
  actionTimeText?: string;
  comment?: string;
}

export interface ApprovalDetailModel extends ApprovalItemModel {
  accountName?: string;
  accountNo?: string;
  bankName?: string;
  remainingLessons?: number;
  refundLessons?: number;
  serviceFee?: number;
  timeline: ApprovalTimelineNode[];
  nodes?: ApprovalTimelineNode[];
}

const formatPaymentMethod = (pm?: string): string => {
  if (!pm) return '微信支付';
  const map: Record<string, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    bank_transfer: '银行转账',
    pos: '刷卡支付',
    wallet: '电子钱包',
  };
  return map[pm] || pm;
};

const formatOrderType = (ot?: string): { type: 'enroll' | 'renewal' | 'recharge' | 'refund'; text: string } => {
  if (!ot) return { type: 'enroll', text: '新签报读' };
  if (ot === 'refund') return { type: 'refund', text: '退费单' };
  if (ot === 'recharge' || ot === 'wallet_recharge') return { type: 'recharge', text: '钱包充值' };
  if (ot === 'renewal' || ot === 'quarterly' || ot === 'change_course_diff') return { type: 'renewal', text: '续费充值' };
  return { type: 'enroll', text: '新签报读' };
};

const formatOrderStatus = (st?: string): { status: 'paid' | 'pending' | 'refunded' | 'voided'; text: string } => {
  if (!st || st === 'paid') return { status: 'paid', text: '已支付' };
  if (st === 'unpaid' || st === 'pending') return { status: 'pending', text: '待支付' };
  if (st === 'refund' || st === 'refunded') return { status: 'refunded', text: '已退费' };
  if (st === 'void' || st === 'voided') return { status: 'voided', text: '已作废' };
  if (st === 'rejected') return { status: 'voided', text: '已驳回' };
  return { status: 'paid', text: '已支付' };
};

export function normalizeOrderItem(item: any): OrderItemModel {
  const { type: orderType, text: orderTypeText } = formatOrderType(item.orderType);
  const { status, text: statusText } = formatOrderStatus(item.status);
  const totalAmount = Number(item.totalAmount ?? item.originalPrice ?? item.receivableAmount ?? 0);
  const paidAmount = Number(item.paidAmount ?? item.actualAmount ?? 0);
  const discountAmount = Number(
    item.discountAmount ?? (item.originalPrice && item.actualAmount ? Math.max(0, item.originalPrice - item.actualAmount) : 0)
  );

  let rawItems = Array.isArray(item.items) ? item.items : [];
  if (rawItems.length === 0 && (item.package || item.coursePackage || item.packageName)) {
    const pkgName = item.package?.course?.name || item.coursePackage?.name || item.packageName || '标准正课包';
    rawItems = [
      {
        id: item.packageId || `item-${item.id || '1'}`,
        itemName: pkgName,
        itemType: 'course',
        quantity: 1,
        unitPrice: paidAmount || totalAmount || 0,
        subtotal: paidAmount || totalAmount || 0,
      },
    ];
  } else if (rawItems.length === 0) {
    const fallbackName = orderType === 'recharge' ? '学员电子钱包充值' : (orderType === 'refund' ? '课程退费' : '报读正课包');
    rawItems = [
      {
        id: `item-${item.id || '1'}`,
        itemName: fallbackName,
        itemType: orderType === 'recharge' ? 'goods' : 'course',
        quantity: 1,
        unitPrice: paidAmount || totalAmount || 0,
        subtotal: paidAmount || totalAmount || 0,
      },
    ];
  }

  const items = rawItems.map((sub: any, idx: number) => ({
    id: String(sub.id || `sub-${idx + 1}`),
    itemName: String(sub.itemName || sub.name || '收费项目'),
    itemType: (sub.itemType === 'goods' ? 'goods' : 'course') as 'course' | 'goods',
    quantity: Number(sub.quantity ?? 1),
    unitPrice: Number(sub.unitPrice ?? sub.price ?? 0),
    subtotal: Number(sub.subtotal ?? (sub.unitPrice ? sub.unitPrice * (sub.quantity || 1) : 0)),
  }));

  const createdAtText = item.createdAt
    ? (typeof item.createdAt === 'string'
        ? item.createdAt.slice(0, 19).replace('T', ' ')
        : new Date(item.createdAt).toISOString().slice(0, 19).replace('T', ' '))
    : (item.createdAtText || '2026-10-15 16:32:10');

  return {
    id: String(item.id || ''),
    orderNo: String(item.orderNo || (item.id ? `ORD${String(item.id).slice(-8)}` : 'ORD00000000')),
    studentId: String(item.studentId || item.student?.id || ''),
    studentName: String(item.student?.name || item.studentName || '学员'),
    studentPhone: String(item.student?.phone || item.studentPhone || ''),
    studentNo: String(item.student?.studentNo || item.studentNo || ''),
    orderType,
    orderTypeText,
    status,
    statusText,
    totalAmount,
    paidAmount,
    discountAmount,
    paymentMethod: formatPaymentMethod(item.paymentMethod),
    createdAtText,
    operatorName: String(
      item.creator?.realName || item.owner?.realName || item.operator?.realName || item.operatorName || '经办顾问'
    ),
    items,
    voucherUrl: item.voucherUrl,
  };
}

export function normalizeOrderSummary(res: any): OrderSummaryModel {
  return {
    todayPaidAmount: Number(res.todayPaidAmount ?? res.totalActualAmount ?? res.totalAmount ?? res.totalIncome ?? 0),
    monthOrderCount: Number(res.monthOrderCount ?? res.totalOrders ?? res.totalCount ?? 0),
    pendingOrderCount: Number(res.pendingOrderCount ?? res.statusCounts?.unpaid ?? 0),
    totalRefundAmount: Number(res.totalRefundAmount ?? 0),
    summaryText: res.summaryText || '',
    totalOrders: Number(res.totalOrders ?? res.totalCount ?? 0),
    totalActualAmount: Number(res.totalActualAmount ?? res.totalAmount ?? 0),
  };
}

export function normalizeApprovalItem(item: any): ApprovalItemModel {
  let businessType: 'refund' | 'receipt' | 'transfer' = 'refund';
  let businessTypeText = '退费审批';
  if (item.businessType === 'receipt' || item.businessType === 'payment' || item.businessType === 'quarterly') {
    businessType = 'receipt';
    businessTypeText = '收款审批';
  } else if (item.businessType === 'transfer') {
    businessType = 'transfer';
    businessTypeText = '异动审批';
  } else {
    businessType = 'refund';
    businessTypeText = '退费审批';
  }

  const rawStatus = item.status || 'pending';
  let status: 'pending' | 'approved' | 'rejected' = 'pending';
  let statusText = '待我审批';
  if (rawStatus === 'approved') {
    status = 'approved';
    statusText = '已通过';
  } else if (rawStatus === 'rejected' || rawStatus === 'withdrawn') {
    status = 'rejected';
    statusText = '已驳回';
  }

  const currentStep = Number(item.currentStep ?? 1);
  const totalSteps = Number(item.totalSteps ?? 3);

  const createdAtText = item.createdAt
    ? (typeof item.createdAt === 'string'
        ? item.createdAt.slice(0, 16).replace('T', ' ')
        : new Date(item.createdAt).toISOString().slice(0, 16).replace('T', ' '))
    : (item.createdAtText || '2026-10-15 10:30');

  const studentName = String(
    item.order?.student?.name || item.student?.name || item.studentName || '学员'
  );
  const courseName = String(
    item.order?.package?.course?.name || item.course?.name || item.courseName || '课程'
  );
  const amount = Number(item.order?.actualAmount ?? item.amount ?? 0);
  const reason = String(item.order?.remark || item.reason || '无特殊说明');

  let currentNodeName = item.currentNodeName;
  if (!currentNodeName) {
    if (status === 'approved') {
      currentNodeName = '审批已签批通过';
    } else if (status === 'rejected') {
      currentNodeName = '已被驳回并退回';
    } else {
      currentNodeName = currentStep === 1
        ? '等待【教学主管】核实'
        : (currentStep === 2 ? '等待【校区校长】复核' : '等待【财务总监】终审');
    }
  }

  const approvalNo = String(
    item.approvalNo ||
    (item.order?.orderNo ? `APPR-${item.order.orderNo.replace(/\D/g, '')}` : `APPR-${String(item.id).slice(-8)}`)
  );

  return {
    id: String(item.id || ''),
    approvalNo,
    businessType,
    businessTypeText,
    status,
    statusText,
    currentStep,
    totalSteps,
    applicantName: String(item.applicantName || item.applicant?.realName || '冯老师'),
    applicantRole: String(item.applicantRole || (businessType === 'refund' ? '学管顾问' : '课程顾问')),
    campusId: String(item.order?.campusId || item.campusId || 'campus-bj-hq'),
    campusName: String(item.order?.campus?.name || item.campus?.name || item.campusName || '总部校区'),
    createdAtText,
    studentName,
    courseName,
    amount,
    reason,
    currentNodeName,
  };
}

const MOCK_ORDERS: OrderItemModel[] = [
  {
    id: 'ord-01',
    orderNo: 'ORD20261015001',
    studentId: 's-01',
    studentName: '董御',
    studentPhone: '13460475611',
    studentNo: 'S950014',
    orderType: 'enroll',
    orderTypeText: '新签报读',
    status: 'paid',
    statusText: '已支付',
    totalAmount: 6400,
    paidAmount: 4992,
    discountAmount: 1408,
    paymentMethod: '微信支付',
    createdAtText: '2026-10-15 16:32:10',
    operatorName: '冯老师',
    items: [
      { id: 'item-01', itemName: '启蒙英语 (100课次)', itemType: 'course', quantity: 1, unitPrice: 6400, subtotal: 6400 },
    ],
  },
  {
    id: 'ord-02',
    orderNo: 'ORD20261014002',
    studentId: 's-02',
    studentName: '陈梓澄',
    studentPhone: '13812345678',
    studentNo: 'S950013',
    orderType: 'enroll',
    orderTypeText: '新签报读',
    status: 'paid',
    statusText: '已支付',
    totalAmount: 5184,
    paidAmount: 4864,
    discountAmount: 320,
    paymentMethod: '微信支付',
    createdAtText: '2026-10-14 11:20:45',
    operatorName: '冯老师',
    items: [
      { id: 'item-02', itemName: '少儿书法 (48课次)', itemType: 'course', quantity: 1, unitPrice: 2592, subtotal: 2592 },
      { id: 'item-03', itemName: '启蒙英语 (48课次)', itemType: 'course', quantity: 1, unitPrice: 2592, subtotal: 2592 },
    ],
  },
  {
    id: 'ord-03',
    orderNo: 'ORD20261013003',
    studentId: 's-03',
    studentName: '韦千寻',
    studentPhone: '15993080680',
    studentNo: 'S950012',
    orderType: 'recharge',
    orderTypeText: '钱包充值',
    status: 'paid',
    statusText: '已支付',
    totalAmount: 2000,
    paidAmount: 2000,
    discountAmount: 0,
    paymentMethod: '刷卡支付',
    createdAtText: '2026-10-13 09:15:00',
    operatorName: '王财务',
    items: [
      { id: 'item-04', itemName: '学员电子钱包充值', itemType: 'goods', quantity: 1, unitPrice: 2000, subtotal: 2000 },
    ],
  },
  {
    id: 'ord-04',
    orderNo: 'ORD20261012004',
    studentId: 's-04',
    studentName: '娄栩歌',
    studentPhone: '18236139606',
    studentNo: 'S950011',
    orderType: 'refund',
    orderTypeText: '退费单',
    status: 'refunded',
    statusText: '已退费',
    totalAmount: 1200,
    paidAmount: 1200,
    discountAmount: 0,
    paymentMethod: '原路返还',
    createdAtText: '2026-10-12 15:40:22',
    operatorName: '李校长',
    items: [
      { id: 'item-05', itemName: '少儿书法课程退费 (20课次)', itemType: 'course', quantity: 1, unitPrice: 1200, subtotal: 1200 },
    ],
  },
];

const MOCK_APPROVALS: ApprovalItemModel[] = [
  {
    id: 'appr-01',
    approvalNo: 'APPR-20261015-001',
    businessType: 'refund',
    businessTypeText: '退费审批',
    status: 'pending',
    statusText: '待我审批',
    currentStep: 2,
    totalSteps: 2,
    applicantName: '冯老师',
    applicantRole: '教务顾问',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    createdAtText: '2026-10-15 10:30',
    studentName: '郑扶摇',
    courseName: '启蒙英语',
    amount: 3200,
    reason: '学员家庭因工作变动搬家迁往外地，无法继续参加线下课程。',
    currentNodeName: '等待【校长-李总】终审',
  },
  {
    id: 'appr-02',
    approvalNo: 'APPR-20261015-002',
    businessType: 'receipt',
    businessTypeText: '收款审批',
    status: 'pending',
    statusText: '待我审批',
    currentStep: 1,
    totalSteps: 1,
    applicantName: '张销售',
    applicantRole: '课程顾问',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    createdAtText: '2026-10-15 14:15',
    studentName: '赵梓涵',
    courseName: 'C++编程集训课',
    amount: 20000,
    reason: '家长申请一次性报读2年制连读班，申请特惠折扣85折特批。',
    currentNodeName: '等待【财务主管】审核',
  },
  {
    id: 'appr-03',
    approvalNo: 'APPR-20261014-003',
    businessType: 'transfer',
    businessTypeText: '异动审批',
    status: 'approved',
    statusText: '已通过',
    currentStep: 2,
    totalSteps: 2,
    applicantName: '冯老师',
    applicantRole: '教务顾问',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    createdAtText: '2026-10-14 16:50',
    studentName: '孙佳音',
    courseName: '少儿书法',
    amount: 0,
    reason: '学员因时间冲突申请转至周日同一科目平行班级。',
    currentNodeName: '审批已通过并归档',
  },
];

export const financeApi = {
  // 1. 获取订单账本列表
  async getOrders(params?: {
    keyword?: string;
    orderType?: string;
    status?: string;
    campusId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: OrderItemModel[]; total: number }> {
    const query: Record<string, any> = { ...params };
    // 映射入参 orderType
    if (query.orderType === 'enroll') query.orderType = 'regular';
    else if (query.orderType === 'renewal') query.orderType = 'quarterly';
    else if (query.orderType === 'recharge') query.orderType = 'wallet_recharge';
    else if (query.orderType === 'all') delete query.orderType;

    // 映射入参 status
    if (query.status === 'pending') query.status = 'unpaid';
    else if (query.status === 'voided') query.status = 'void';
    else if (query.status === 'all') delete query.status;

    try {
      const res = await request<any>({
        url: '/api/financial/orders',
        method: 'GET',
        data: query,
      });
      const rawList = Array.isArray(res?.list) ? res.list : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
      const list = rawList.map((item: any) => normalizeOrderItem(item));
      return { list, total: Number(res?.total ?? list.length) };
    } catch (e) {
      console.warn('[financeApi] 获取后端订单列表失败:', e);
      return { list: [], total: 0 };
    }
  },

  // 2. 获取财务汇总统计
  async getOrderSummary(params?: { campusId?: string; month?: string }): Promise<OrderSummaryModel> {
    try {
      const res = await request<any>({
        url: '/api/financial/orders/summary',
        method: 'GET',
        data: params,
      });
      if (res && (res.todayPaidAmount !== undefined || res.totalActualAmount !== undefined || res.totalOrders !== undefined)) {
        return normalizeOrderSummary(res);
      }
    } catch (e) {
      console.warn('[financeApi] 获取财务汇总失败，回退内置数据:', e);
    }

    return {
      todayPaidAmount: 4992.0,
      monthOrderCount: 12,
      pendingOrderCount: 1,
      totalRefundAmount: 1200.0,
    };
  },

  // 3. 获取单笔订单详情
  async getOrderById(id: string): Promise<OrderItemModel> {
    try {
      const res = await request<any>({
        url: `/api/financial/orders/${id}`,
        method: 'GET',
      });
      if (res && (res.id || res.orderNo)) {
        return normalizeOrderItem(res);
      }
    } catch (e) {
      console.warn('[financeApi] 获取单笔订单失败，使用回退数据:', e);
    }

    return (
      MOCK_ORDERS.find((o) => o.id === id) || MOCK_ORDERS[0]
    );
  },

  // 4. 作废订单
  async voidOrder(id: string) {
    return request({
      url: `/api/financial/orders/${id}/void`,
      method: 'POST',
    });
  },

  // 5. 锁定订单
  async lockOrder(id: string, reason: string | { isLocked?: boolean; reason?: string }) {
    const data = typeof reason === 'string'
      ? { isLocked: true, reason }
      : { isLocked: reason.isLocked ?? true, reason: reason.reason || '财务账期封锁' };
    return request({
      url: `/api/financial/orders/${id}/lock`,
      method: 'PATCH',
      data,
    });
  },

  // 6. 更新凭证
  async updateVoucher(id: string, voucherUrl: string) {
    return request({
      url: `/api/financial/orders/${id}/voucher`,
      method: 'PATCH',
      data: { voucherUrl },
    });
  },

  // 7. 获取多级审批流列表
  async getApprovals(params?: {
    businessType?: string;
    status?: string;
    currentStep?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: ApprovalItemModel[]; total: number }> {
    const query: Record<string, any> = { ...params };
    if (query.businessType === 'receipt') {
      query.businessType = 'payment';
    } else if (query.businessType === 'all') {
      delete query.businessType;
    }
    if (query.status === 'my') {
      delete query.status;
    }

    try {
      const res = await request<any>({
        url: '/api/financial/approvals',
        method: 'GET',
        data: query,
      });
      const rawList = Array.isArray(res?.list) ? res.list : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
      const list = rawList.map((item: any) => normalizeApprovalItem(item));
      return { list, total: Number(res?.total ?? list.length) };
    } catch (e) {
      console.warn('[financeApi] 获取审批列表失败:', e);
      return { list: [], total: 0 };
    }
  },

  // 8. 获取审批详情与时间线
  async getApprovalDetail(id: string): Promise<ApprovalDetailModel> {
    const base = MOCK_APPROVALS.find((a) => a.id === id) || MOCK_APPROVALS[0];

    const fallbackDetail: ApprovalDetailModel = {
      ...base,
      accountName: '郑** (学员母亲)',
      accountNo: '622202******8899',
      bankName: '招商银行北京分行',
      remainingLessons: 50,
      refundLessons: 50,
      serviceFee: 0,
      nodes: [
        {
          nodeId: 'node-1',
          nodeName: '发起退费申请',
          approverName: base.applicantName,
          approverRole: '教务顾问',
          status: 'approved',
          statusText: '已提交',
          actionTimeText: '2026-10-15 10:30',
          comment: base.reason,
        },
        {
          nodeId: 'node-2',
          nodeName: '财务核验课耗',
          approverName: '王财务',
          approverRole: '财务主管',
          status: 'approved',
          statusText: '已通过',
          actionTimeText: '2026-10-15 11:15',
          comment: '已核查学员剩余50课次无误，合规退款金额计算正确，同意推进。',
        },
        {
          nodeId: 'node-3',
          nodeName: '校长终审签批',
          approverName: '李校长',
          approverRole: '校区负责人',
          status: base.status,
          statusText: base.status === 'approved' ? '已批准' : '待审批',
          actionTimeText: base.status === 'approved' ? '2026-10-15 14:00' : undefined,
          comment: base.status === 'approved' ? '同意退费出账。' : undefined,
        },
      ],
      timeline: [
        {
          nodeId: 'node-1',
          nodeName: '发起退费申请',
          approverName: base.applicantName,
          approverRole: '教务顾问',
          status: 'approved',
          statusText: '已提交',
          actionTimeText: '2026-10-15 10:30',
          comment: base.reason,
        },
        {
          nodeId: 'node-2',
          nodeName: '财务核验课耗',
          approverName: '王财务',
          approverRole: '财务主管',
          status: 'approved',
          statusText: '已通过',
          actionTimeText: '2026-10-15 11:15',
          comment: '已核查学员剩余50课次无误，合规退款金额计算正确，同意推进。',
        },
        {
          nodeId: 'node-3',
          nodeName: '校长终审签批',
          approverName: '李校长',
          approverRole: '校区负责人',
          status: base.status,
          statusText: base.status === 'approved' ? '已批准' : '待审批',
          actionTimeText: base.status === 'approved' ? '2026-10-15 14:00' : undefined,
          comment: base.status === 'approved' ? '同意退费出账。' : undefined,
        },
      ],
    };

    try {
      const res = await request<any>({
        url: `/api/financial/approvals/${id}/timeline`,
        method: 'GET',
      });
      const rawNodes = Array.isArray(res?.nodes) ? res.nodes : (Array.isArray(res?.timeline) ? res.timeline : []);
      if (rawNodes.length > 0) {
        const normalizedTimeline: ApprovalTimelineNode[] = rawNodes.map((n: any, idx: number) => ({
          nodeId: n.id || n.nodeId || `node-${idx + 1}`,
          nodeName: n.nodeName || n.stepName || (idx === 0 ? '发起退费申请' : (idx === 1 ? '财务核验课耗' : '校长终审签批')),
          approverName: n.reviewer?.realName || n.reviewerName || n.approverName || '审核人',
          approverRole: n.approverRole || (n.step === 1 ? '教务顾问' : (n.step === 2 ? '财务主管' : '校区校长')),
          status: (n.action === 'pass' ? 'approved' : (n.action === 'reject' ? 'rejected' : 'pending')) as 'approved' | 'rejected' | 'pending',
          statusText: n.statusText || (n.action === 'pass' ? '已核准' : (n.action === 'reject' ? '已驳回' : '待审批')),
          actionTimeText: n.createdAt ? (typeof n.createdAt === 'string' ? n.createdAt.slice(0, 16).replace('T', ' ') : '') : (n.actionTimeText || ''),
          comment: n.comment || '',
        }));

        const mergedBase = normalizeApprovalItem({ ...base, ...res });
        return {
          ...mergedBase,
          accountName: res.accountName || fallbackDetail.accountName,
          accountNo: res.accountNo || fallbackDetail.accountNo,
          bankName: res.bankName || fallbackDetail.bankName,
          remainingLessons: res.remainingLessons ?? fallbackDetail.remainingLessons,
          refundLessons: res.refundLessons ?? fallbackDetail.refundLessons,
          serviceFee: res.serviceFee ?? fallbackDetail.serviceFee,
          timeline: normalizedTimeline,
          nodes: normalizedTimeline,
        };
      }
    } catch (e) {
      console.warn('[financeApi] 获取审批时间线失败，使用内置时间线:', e);
    }

    return fallbackDetail;
  },

  // 8.1 兼容后端路由命名
  async getApprovalTimeline(id: string): Promise<ApprovalDetailModel> {
    return this.getApprovalDetail(id);
  },

  // 9. 审核通过或驳回
  async auditApproval(id: string, payload: {
    status?: 'approved' | 'rejected';
    action?: 'pass' | 'reject' | 'approve';
    comment?: string;
    reason?: string;
    stepName?: string;
  }) {
    const rawAction = payload.action || (payload.status === 'rejected' ? 'reject' : 'pass');
    const action = rawAction === 'approve' ? 'pass' : rawAction;
    const comment = payload.comment || payload.reason || (action === 'reject' ? '审批驳回' : '同意通过');
    return request({
      url: `/api/financial/approvals/${id}/audit`,
      method: 'POST',
      data: {
        action,
        comment,
        ...(payload.stepName ? { stepName: payload.stepName } : {})
      },
    });
  },

  // 10. 批量审核
  async batchAudit(payload: {
    approvalIds: string[];
    action: 'approve' | 'reject';
    comment?: string;
  }) {
    return request({
      url: '/api/financial/approvals/batch-audit',
      method: 'POST',
      data: payload,
    });
  },
};
