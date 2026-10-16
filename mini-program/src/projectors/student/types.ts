import type {
  StudentCourseItemModel,
  AttendanceRecordItemModel,
  CommunicationRecordItemModel,
} from '../../api/student';

/**
 * 权威学籍状态自洽语义描述符 (SSOT Status Normalizer)
 * - in_class: 在读（持有有效课包剩余课时且已编入在读班级）
 * - pending_assignment: 待分班资产池（持有有效课包剩余课时但未进班）
 * - not_enrolled: 未报读（无有效剩余课时且未编班）
 * - suspended: 停课（学员办理休学或停课保护）
 * - graduated: 已结业（课程与课时已全部消耗完毕并毕业）
 * - lost: 已流失（退学/流失）
 * - transferred: 已转校（学员异动转出校区）
 */
export type NormalizedStudentStatus =
  | 'in_class'
  | 'pending_assignment'
  | 'not_enrolled'
  | 'suspended'
  | 'graduated'
  | 'lost'
  | 'transferred';

/**
 * 课消流失风险星级评级（ADR-0005 映射）
 * - URGENT: ≤4 课时，紧急预警（标红警示，必须立即触发续费流转）
 * - WARNING: 5~8 课时，续费预警（标橙预警，处于续费跟进黄金窗口）
 * - HEALTHY: >8 课时，课消健康（标绿，课时存量充足）
 */
export type ConsumptionRiskLevel = 'URGENT' | 'WARNING' | 'HEALTHY';

export interface ConsumptionRiskProfile {
  level: ConsumptionRiskLevel;
  label: string; // '紧急预警' | '续费预警' | '课消健康'
  isUrgent: boolean;
  warningWindow: boolean;
  stars: number; // 1 (URGENT), 2 (WARNING), 3 (HEALTHY)
  color: string; // '#EF4444' | '#F59E0B' | '#10B981'
}

export interface NormalizedStatusResult {
  status: NormalizedStudentStatus;
  statusText: string; // '在读' | '待分班' | '未报读' | '停课' | '已结业' | '已流失' | '已转校'
  tagClass: string; // 'tag-active' | 'tag-pending' | 'tag-unassigned' | 'tag-suspended'
  isAssignedClass: boolean;
  inPendingAssetPool: boolean; // 是否处于待分班资产池
}

export interface StudentAssetSummary {
  totalRemainingLessons: number; // 剩余总课时（含冻结在内的全部剩余存量）
  activeRemainingLessons: number; // 可用正课课时（排他隔离冻结课时）
  frozenLessons: number; // 冻结课时
  totalRemainingAmount: number; // 总剩余加权金额 (元)
  weightedPricePerLesson: number; // 加权平均课时单价 (元/课时)
  walletBalance: number; // 钱包总余额 (本金 + 赠送金)
  principalBalance: number; // 本金钱包余额（可原路退费/消费）
  bonusBalance: number; // 赠送金钱包余额（仅限消费抵扣，不可折现）
  cardCount: number; // 关联卡包/次卡数
}

export interface ActionPermissionMatrix {
  canEnroll: boolean; // 是否允许继续报名/续费开单
  canAdjustClass: boolean; // 是否允许进班/调整班级
  canRecharge: boolean; // 是否允许充值钱包
  canDisable: boolean; // 是否允许执行停课/禁用
  canRefund: boolean; // 是否允许发起退费
}

export interface RosterQuery {
  keyword?: string;
  status?: string;
  warningLevel?: string;
  campusId?: string;
  page?: number;
  pageSize?: number;
}

export interface RosterItemView {
  id: string;
  name: string;
  studentNo: string;
  phone: string;
  avatar?: string;
  status: NormalizedStudentStatus;
  statusText: string;
  tagClass: string;
  remainingLessons: number;
  remainingAmount: number;
  enrolledClassesCount: number;
  campusId: string;
  campusName: string;
  isAssignedClass: boolean;
  inPendingAssetPool: boolean;
  frozenLessons: number;
  risk: ConsumptionRiskProfile;
}

export interface RosterResultView {
  list: RosterItemView[];
  total: number;
}

export interface StudentDossierView {
  id: string;
  name: string;
  studentNo: string;
  avatar?: string;
  gender: string;
  phone: string;
  guardianRelation: string;
  expireDateText: string;
  channelSource: string;
  campusName: string;
  campusId?: string;

  // 权威学籍归一化投影
  status: string; // 兼容旧视图绑定，如 '在读' / '待分班'
  normalizedStatus: NormalizedStudentStatus;
  statusText: string;
  tagClass: string;
  isAssignedClass: boolean;
  inPendingAssetPool: boolean;

  // 资产总览（多维加权与冻结隔离）
  totalRemainingLessons: number;
  activeRemainingLessons: number;
  totalRemainingAmount: number;
  walletBalance: number;
  principalBalance: number;
  bonusBalance: number;
  cardCount: number;
  frozenLessons: number;
  assets: StudentAssetSummary;

  // ADR-0005 课消流失风险星级
  consumptionRisk: ConsumptionRiskProfile;

  // 业务操作权限矩阵
  permissions: ActionPermissionMatrix;

  // 穿透子列表
  courses: StudentCourseItemModel[];
  attendances: AttendanceRecordItemModel[];
  communications: CommunicationRecordItemModel[];
}

export interface ProjectDossierOptions {
  forceRefresh?: boolean;
  ttlMs?: number;
}
