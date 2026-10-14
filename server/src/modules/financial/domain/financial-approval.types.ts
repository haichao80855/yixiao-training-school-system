/**
 * 财务多级审批流与履约策略领域类型规范
 */

export type ApprovalAction = 'pass' | 'approve' | 'reject';

export interface AuditDecision {
  action: ApprovalAction;
  comment: string;
  stepName?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export interface SingleAuditReceipt {
  success: boolean;
  flowId: string;
  orderId: string;
  action: ApprovalAction;
  previousStep: number;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  flow: any;
  settlementResult?: any;
}

export interface BatchAuditItemResult {
  flowId: string;
  success: boolean;
  status?: string;
  currentStep?: number;
  message?: string;
  error?: string;
}

export interface BatchAuditReceipt {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  items: BatchAuditItemResult[];
}

export interface ApprovalTimelineNode {
  step: number;
  stepName: string;
  reviewerId: string;
  reviewerName: string;
  action: string;
  comment: string;
  createdAt: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface ApprovalTimelineView {
  flowId: string;
  orderId: string;
  orderNo?: string;
  businessType: string;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: number;
  totalSteps: number;
  applicantName: string;
  createdAt: string;
  nodes: ApprovalTimelineNode[];
  canAudit: boolean;
}

export interface CreateApprovalIntent {
  orderId: string;
  businessType: string;
  applicantName: string;
  totalSteps?: number;
}
