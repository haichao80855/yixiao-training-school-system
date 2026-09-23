// ==========================================
// 盛通教育「一校教培系统」财务中心核心数据契约类型定义
// 对应 PROJECT.md § Interface Contracts 4 & MODULE_ANALYSIS_DESIGN.md § 五、财务模块
// ==========================================

export type PaymentMethod = 'wechat' | 'alipay' | 'bank_transfer' | 'pos' | 'wallet';

export type OrderType =
  | 'regular'              // 常规学费
  | 'quarterly'            // 季度扣费
  | 'change_course_diff'   // 换课差额
  | 'refund'               // 退费申请
  | 'service_fee'          // 服务费/代报考
  | 'wallet_recharge';     // 钱包充值

export type OrderStatus = 'paid' | 'unpaid' | 'rejected' | 'void';

export type GoodsDeliveryStatus = 'delivered' | 'undelivered' | 'none';

export type FinancialStudentStatus = 'reading' | 'suspended' | 'transferred' | 'graduated' | 'all';

export type AbnormalStatus = 'normal' | 'transfer_class' | 'change_course' | 'suspend' | 'refund' | 'transfer_campus' | 'all';

export type InvoiceStatus = 'unissued' | 'issued' | 'processing' | 'all';

export type ContractSignedStatus = 'signed' | 'unsigned' | 'void' | 'all';

export type ApprovalBusinessType =
  | 'payment'              // 常规收款
  | 'quarterly'            // 季度扣费
  | 'refund'               // 退费复核
  | 'transfer'             // 学员转让/转校
  | 'make_over'            // 学员转让
  | 'wallet_prestore'      // 钱包预存
  | 'service_fee';         // 代报考服务费

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface OrderRecord {
  id: string;
  orderNo: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  phone: string;
  courseId?: string;
  courseName: string;
  courseType?: string;
  campusId: string;
  campusName: string;
  orderType: OrderType;
  chargeType?: string;         // 契约别名，如 regular / quarterly
  status: OrderStatus;
  orderStatus?: OrderStatus;   // 契约别名，与 status 保持一致
  originalPrice: number;
  discountAmount: number;
  couponAmount: number;
  receivableAmount?: number;
  actualAmount: number;
  paymentMethod: PaymentMethod;
  signupTime: string;
  payTime?: string;
  auditTime?: string;
  goodsDelivery: GoodsDeliveryStatus;
  creator: string;
  submitter?: string;          // 契约别名，与 creator 保持一致
  performanceOwner: string;
  salesOwner?: string;         // 契约别名，与 performanceOwner 保持一致
  channel?: string;
  classId?: string;
  className?: string;
  studentStatus?: string;
  abnormalStatus?: string;
  invoiceStatus?: string;
  couponUsed?: string;
  auditor?: string;
  contractSigned?: string;
  isLocked?: boolean;
  voucherUrl?: string;
  voucherThumbnail?: string;
  transactionId?: string;
  verifyRemark?: string;
  remark?: string;
}

export interface OrderCreationPayload {
  studentId: string;
  courseId: string;
  lessonCount: number;
  pricePerLesson: number;
  discountAmount: number;
  actualAmount: number;
  paymentMethod: PaymentMethod;
  campusId: string;
  orderType: OrderType;
  channel?: string;
  classId?: string;
  remark?: string;
}

// 3x8 矩阵筛选表单 (严格包含恰好 24 个查询参数字段)
export interface FinanceFilterForm {
  // Row 1 (8 控件)
  studentKeyword: string;      // 姓名/学号/手机号
  submitter: string;           // 提交人
  salesOwner: string;          // 业绩归属人
  channel: string;             // 渠道来源
  classId: string;             // 班级选择
  courseType: string;          // 课程类型
  chargeType: string;          // 收费类型 (常规/季度/全部)
  orderStatus: string;         // 订单状态 (已支付/未支付/已驳回/已作废/全部)

  // Row 2 (8 控件)
  studentStatus: string;       // 学员状态 (在读/休学/转校/结业)
  abnormalStatus: string;      // 异动状态 (正常/转班/换课/停课/退费)
  goodsDelivery: string;       // 商品出库状态
  paymentMethod: string;       // 支付方式 (微信/支付宝/银行转账/POS/钱包)
  minAmount: number | null;    // 最低金额
  maxAmount: number | null;    // 最高金额
  invoiceStatus: string;       // 发票开具状态
  campusId: string;            // 归属校区

  // Row 3 (8 控件)
  dateRangeType: string;       // 日期类型 (报名日期/支付日期/审核日期)
  startDate: string;           // 开始日期 (默认当月1号)
  endDate: string;             // 结束日期 (默认当月末)
  couponUsed: string;          // 优惠券使用
  auditor: string;             // 审核人
  contractSigned: string;      // 合同签署状态
  page: number;                // 当前页码
  pageSize: number;            // 每页条数
}

export interface FinanceSummaryResult {
  totalCount: number;
  totalAmount: number;
  formattedAmount: string;
  summaryText: string;
}

export interface ApprovalTimelineNode {
  step: string;
  operator: string;
  comment: string;
  time: string;
  status: 'passed' | 'rejected' | 'pending';
}

export interface ApprovalRecord {
  id: string;
  approvalNo: string;
  businessType: ApprovalBusinessType;
  sourceId: string;
  applicantName: string;
  applicantId?: string;
  studentName: string;
  studentNo: string;
  campusId: string;
  campusName: string;
  amount: number;
  status: ApprovalStatus;
  currentStep: number;
  timeline: ApprovalTimelineNode[];
  createdAt: string;
  updatedAt?: string;
  orderNo?: string;
  reason?: string;
  details?: Record<string, any>;
}

export interface LedgerRecord {
  transNo: string;
  orderNo?: string;
  date: string;
  student: string;
  studentNo?: string;
  type: string;
  amount: number;
  method: string;
  verifier: string;
  campusId: string;
  campusName: string;
  status?: string;
  remark?: string;
}

export interface PaymentVoucherInfo {
  orderNo: string;
  transactionId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  payTime: string;
  voucherImages: string[];
  verificationStatus: 'verified' | 'pending' | 'rejected';
  auditor?: string;
  auditRemark?: string;
}

export interface ColumnConfig {
  key: string;
  title: string;
  visible: boolean;
  disabled?: boolean;
}
