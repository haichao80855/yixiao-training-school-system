/**
 * 续费风控与决策六边形端口定义
 * Renewal Decision Hexagonal Port
 */

import type {
  RenewalDashboardFilter,
  RenewalDashboardView,
  RenewalDraftOptions,
  RenewalOrderDraft,
} from './types';

export interface RenewalDecisionPort {
  /**
   * 拉取校区学员课消预警大盘统计与流失名册
   */
  fetchWarningRoster(filter?: RenewalDashboardFilter): Promise<RenewalDashboardView>;

  /**
   * 单学员课消全景诊断
   */
  fetchStudentRisk(studentId: string): Promise<any>;

  /**
   * 服务端生成续费开单草案 (对齐 ADR-0006 课消风控与续费决策协议)
   */
  generateRenewalDraft(studentId: string, options?: RenewalDraftOptions): Promise<RenewalOrderDraft>;

  /**
   * 班级容量即时核验
   */
  checkClassCapacity?(classId: string): Promise<{ capacity: number; currentStudentCount: number; isFull: boolean }>;
}
