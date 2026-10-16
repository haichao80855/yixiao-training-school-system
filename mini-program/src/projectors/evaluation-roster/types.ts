export interface EvaluationRosterQuery {
  /** 校区作用域标识 (必须在当前校区上下文内检索) */
  campusId: string;
  /** 日期区间检索 (如 '2026-10-12 至 2026-10-18' 或结构化区间) */
  dateRange?: string | { startDate: string; endDate: string };
  /** 模糊检索关键字 (支持匹配学员姓名、手机号、学号) */
  keyword?: string;
  /** 课评推送履约状态筛选 */
  statusFilter?: 'all' | 'pending' | 'pushed';
  /** 是否强制穿透内存与本地缓存刷新 */
  forceRefresh?: boolean;
}

export interface EvaluationRosterItemView {
  readonly id: string;                      // 学员唯一标识
  readonly name: string;                    // 学员姓名
  readonly phone: string;                   // 联系电话
  readonly studentNo: string;               // 学号 (如 S950000)
  readonly className: string;               // 所属班级名称
  readonly scheduleId: string;              // 排课日程标识
  readonly signTime: string;                // 签到考勤时间 (格式化 YYYY-MM-DD HH:mm)
  readonly isPushed: boolean;               // 课评推送履约状态 (出站信箱已出站)
  readonly pushStatusText: '已推送' | '未推送';// 标签展示文本
  readonly isLowBalance?: boolean;          // 低额课时预警标记 (<= 3 课时)
  readonly remainingLessons?: number;       // 剩余课时数
  readonly courseTypeLabel?: string;        // 课程类型 (如 '线下课')
}

export interface EvaluationMetricsSummary {
  readonly pendingCount: number;     // 待评学员数
  readonly pushedCount: number;      // 已推送学员数
  readonly totalCount: number;       // 总学员人次
  readonly coverageRate: number;     // 评价覆盖率 (0 ~ 100)
  readonly coverageRateText: string; // 评价覆盖率百分比文本 (如 '85.7%')
}

export interface EvaluationRosterView {
  readonly campusId: string;
  readonly items: readonly EvaluationRosterItemView[];
  readonly metrics: EvaluationMetricsSummary;
  readonly source: 'cache_instant' | 'network_fresh' | 'degraded_fallback';
  readonly queriedAt: number;
}

export interface EvaluationRosterProjector {
  /**
   * 唯一业务入口：将后端分散的排课与履约数据投影为开箱即用的花名册全景
   * 支持 SWR 先发缓存，并在后台静默再校验后回调通知视图
   */
  projectRoster(
    query: EvaluationRosterQuery,
    onRevalidated?: (freshView: EvaluationRosterView) => void
  ): Promise<EvaluationRosterView>;

  /**
   * 清除指定校区的本地投影缓存
   */
  invalidateCampusCache(campusId: string): void;
}
