import type {
  OrderRecord,
  OrderType,
  OrderStatus,
  PaymentMethod,
  GoodsDeliveryStatus,
  InvoiceStatus,
  ApprovalRecord,
  LedgerRecord
} from '@/types/financial';

export function normalizeOrder(raw: any): OrderRecord {
  if (!raw) return {} as OrderRecord;

  const orderType = (raw.orderType || raw.chargeType || 'regular') as OrderType;
  const status = (raw.status || raw.orderStatus || 'paid') as OrderStatus;
  const creator = raw.creator?.realName || (typeof raw.creator === 'string' ? raw.creator : '') || '教务顾问';
  const performanceOwner = raw.owner?.realName || raw.performanceOwner || raw.salesOwner || '校区校长';

  const originalPrice = Number(raw.originalPrice || 0);
  const discountAmount = Number(raw.discountAmount || 0);
  const couponAmount = Number(raw.couponAmount || 0);
  const receivableAmount = Number(raw.receivableAmount ?? raw.actualAmount ?? 0);
  const actualAmount = Number(raw.actualAmount || 0);

  const signupTime = raw.createdAt ? String(raw.createdAt).split('T')[0] : (raw.signupTime || '2026-09-01');
  const payTime = raw.payTime ? String(raw.payTime).split('T')[0] : undefined;
  const auditTime = raw.auditTime ? String(raw.auditTime).split('T')[0] : undefined;

  return {
    id: raw.id,
    orderNo: raw.orderNo || '',
    studentId: raw.studentId || raw.student?.id || '',
    studentName: raw.student?.name || raw.studentName || '学员',
    studentNo: raw.student?.studentNo || raw.studentNo || 'S001',
    phone: raw.student?.phone || raw.phone || '',
    courseId: raw.courseId || raw.course?.id || undefined,
    courseName: raw.course?.name || raw.courseName || '少儿编程课程',
    courseType: raw.courseType || raw.course?.type || undefined,
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '总部校区',
    orderType,
    chargeType: orderType,
    status,
    orderStatus: status,
    originalPrice,
    discountAmount,
    couponAmount,
    receivableAmount,
    actualAmount,
    paymentMethod: (raw.paymentMethod || 'wechat') as PaymentMethod,
    signupTime,
    payTime,
    auditTime,
    goodsDelivery: (raw.deliveryStatus || raw.goodsDelivery || 'none') as GoodsDeliveryStatus,
    invoiceStatus: (raw.invoiceStatus || 'unissued') as InvoiceStatus,
    creator,
    submitter: creator,
    performanceOwner,
    salesOwner: performanceOwner,
    channel: raw.channel || 'ground',
    classId: raw.classId || undefined,
    className: raw.className || undefined,
    isLocked: Boolean(raw.isLocked),
    voucherUrl: raw.voucherUrl || '',
    remark: raw.remark || '',
  };
}

export function normalizeApproval(raw: any): ApprovalRecord {
  if (!raw) return {} as ApprovalRecord;
  const applicantName = raw.applicantName || raw.creator?.realName || raw.applicant || raw.creatorName || '学管顾问';
  const orderNo = raw.order?.orderNo || raw.orderNo || 'ORD-001';
  const orderId = raw.orderId || raw.sourceId || '';
  const totalSteps = Number(raw.totalSteps || 3);
  const applyTime = raw.createdAt ? String(raw.createdAt).split('T')[0] : '2026-09-01';
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : (raw.timeline || []);

  const timeline = rawNodes.map((n: any) => ({
    step: n.stepName || n.step,
    stepName: n.stepName || n.step,
    operator: n.reviewer?.realName || n.auditorName || n.operator || '审核人',
    comment: n.comment || '',
    time: n.auditTime || (n.createdAt ? String(n.createdAt).replace('T', ' ').slice(0, 19) : '') || n.time || '2026-09-21 10:00:00',
    status: (n.status || (n.action === 'approve' ? 'passed' : n.action === 'reject' ? 'rejected' : 'pending')) as 'passed' | 'rejected' | 'pending',
    action: n.action,
  }));

  return {
    id: raw.id,
    approvalNo: raw.approvalNo || raw.flowNo || raw.id,
    businessType: raw.businessType || 'payment',
    sourceId: raw.sourceId || raw.orderId || '',
    orderId,
    orderNo,
    applicantName,
    applicant: applicantName,
    applicantId: raw.applicantId || raw.creatorId,
    studentName: raw.order?.student?.name || raw.studentName || raw.student?.name || '学员',
    studentNo: raw.order?.student?.studentNo || raw.studentNo || raw.student?.studentNo || 'S001',
    campusId: raw.order?.campusId || raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.order?.campus?.name || raw.campusName || raw.campus?.name || '总部校区',
    amount: Number(raw.order?.actualAmount || raw.amount || 0),
    currentStep: Number(raw.currentStep || 1),
    totalSteps,
    status: raw.status || 'pending',
    applyTime,
    createdAt: raw.createdAt ? String(raw.createdAt).replace('T', ' ').slice(0, 19) : '2026-09-01',
    timeline: timeline as any,
    reason: raw.reason || raw.remark,
    // 兼容历史审批流视图别名
    ...({
      auditNodes: rawNodes,
    } as any),
  };
}

export function normalizeLedgerRecord(o: any): LedgerRecord {
  if (!o) return {} as LedgerRecord;
  const actualAmount = Number(o.actualAmount || 0);
  const isRefund = o.orderType === 'refund';
  return {
    transNo: o.transNo || `TX${o.orderNo ? o.orderNo.replace(/\D/g, '') : Date.now()}`,
    orderNo: o.orderNo,
    date: o.payTime ? String(o.payTime).replace('T', ' ').slice(0, 19) : (o.createdAt ? String(o.createdAt).replace('T', ' ').slice(0, 19) : '2026-09-21 10:00:00'),
    campusId: o.campusId || o.campus?.id || 'campus-bj-hq',
    campusName: o.campus?.name || o.campusName || '总部校区',
    student: o.student?.name || o.studentName || '学员',
    studentNo: o.student?.studentNo || o.studentNo || 'S001',
    type: isRefund ? '退费冲减' : (o.orderType === 'quarterly' ? '季度学费' : '常规学费'),
    amount: isRefund ? -Math.abs(actualAmount) : actualAmount,
    method: o.paymentMethod === 'wechat' ? '微信商户号' : (o.paymentMethod === 'alipay' ? '支付宝生活号' : (o.paymentMethod === 'bank_transfer' ? '招商银行对公' : '银联POS')),
    verifier: o.creator?.realName || (typeof o.creator === 'string' ? o.creator : '') || '系统财务',
    status: o.status === 'paid' ? '已核销' : (o.status === 'void' ? '已作废' : '待处理'),
  };
}
