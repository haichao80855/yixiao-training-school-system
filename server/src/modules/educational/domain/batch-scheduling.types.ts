/**
 * 批量排课与多维碰撞调度引擎 - 领域核心契约
 * 遵循 GLOSSARY: 实体班级(Class)、排课日程(Schedule)、碰撞冲突(Collision)、课时(Lesson)
 */

export type ConflictResolutionPolicy =
  | 'STRICT_ABORT'   // 严格阻断：存在任何时段/容量碰撞立即中断并回滚，拒绝持久化
  | 'ALLOW_AND_FLAG'; // 容错放行：存在冲突仍生成日程，但受冲课次标记为 semanticType = 'conflict' (红标跳动高亮待调解)

export interface RecurrenceRule {
  /** 循环频率：weekly(每周规律), daily(每日连排), custom(自选离散日期) */
  frequency?: 'weekly' | 'daily' | 'custom';
  /** 计划排课课次数 (1 ~ 48 讲)，缺省时取 16 讲 */
  repeatCount?: number;
  /** 每周几重复 (0=周日, 1=周一, ..., 6=周六)。缺省时由起始日期(startDate)自动推导 */
  daysOfWeek?: number[];
  /** 自选离散日期列表 (当 frequency 为 custom 时生效，格式 YYYY-MM-DD) */
  customDates?: string[];
  /** 节假日/停课日避让策略：step_forward(遇假向后顺延一周期), skip(跳过该课次), ignore(强制排入) */
  holidayPolicy?: 'step_forward' | 'skip' | 'ignore';
  /** 排除的日期 (YYYY-MM-DD) */
  excludeDates?: string[];
}

export interface SchedulingIntent {
  /** 所属校区 ID (Campus Scope) */
  campusId: string;
  /** 目标实体班级 ID 列表（支持单班级 [classId] 或多班级一键联排 [id1, id2]） */
  classIds: string[];
  /** 计划首节上课日期 (YYYY-MM-DD) */
  startDate: string;
  /** 上课起始时间 (HH:mm, 07:00 ~ 21:45) */
  startTime: string;
  /** 上课结束时间 (HH:mm, 07:15 ~ 22:00) */
  endTime: string;
  /** 授课讲师 ID (缺省时自动读取班级预设主教老师) */
  teacherId?: string;
  /** 上课物理教室 ID (缺省时自动读取班级预设物理教室) */
  classroomId?: string;
  /** 循环排课规律 (缺省时视为 repeatCount=16 的每周规律排课) */
  recurrence?: RecurrenceRule;
  /** 课次性质 (formal=正课, make_up=补课, trial=体验课，默认 formal) */
  classType?: 'formal' | 'make_up' | 'trial';
  /** 冲突仲裁策略 (缺省为 ALLOW_AND_FLAG 容错标红) */
  conflictPolicy?: ConflictResolutionPolicy;
  /** 排除的已有排课日程 ID (日程调时编辑场景传入，避免与自身旧课次误判碰撞) */
  excludeScheduleId?: string;
  /** 操作人姓名 (用于审计流水记录) */
  operatorName?: string;
}

export type CollisionCategory =
  | 'TEACHER_CONFLICT'            // 讲师时段已被其他排课占用
  | 'CLASSROOM_OCCUPIED'          // 物理教室时段已被其他排课占用
  | 'CLASSROOM_CAPACITY_EXCEEDED' // 班级在读学员数超出教室额定容量上限
  | 'CLASS_OVERLAP'               // 班级自身在此时段已有其他排课
  | 'TIME_WINDOW_VIOLATION'       // 超出 07:00~22:00 营业时段或跨午夜
  | 'DELIVERY_UNAUTHORIZED'       // 课程未获得目标排课校区的跨校区授权
  | 'INTRA_BATCH_COLLISION';      // 批量任务内部多个班级互相抢占同一讲师/教室

export interface CollisionDetail {
  category: CollisionCategory;
  date: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  classroomId?: string;
  classroomName?: string;
  conflictingScheduleId?: string;
  conflictingTitle?: string;
  message: string;
}

export interface ProjectedScheduleSlot {
  slotIndex: number;            // 课次序号 (第 1 讲, 第 2 讲...)
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  classroomId: string;
  classroomName: string;
  date: string;
  dayOfWeek: string;           // "周六"、"周日" 等
  startTime: string;
  endTime: string;
  durationMinutes: number;
  laneIndex: number;           // 自适应贪心染色泳道索引 (0-3)
  hasConflict: boolean;
  conflicts: CollisionDetail[];
  semanticType: 'regular' | 'conflict' | 'completed' | 'personal';
}

export interface SchedulingPreview {
  success: boolean;
  totalPlannedSlots: number;     // 计划生成的课次总数
  cleanSlotsCount: number;       // 完全合规无冲突课次数
  conflictSlotsCount: number;    // 探测到冲突的课次数
  dateRange: {
    startDate: string;
    endDate: string;
    totalWeeks: number;
  };
  slots: ProjectedScheduleSlot[];// 模拟课次完整时间线（含 Lane 泳道排版）
  collisions: CollisionDetail[]; // 全量冲突诊断报告
  canCommitStrictly: boolean;    // 是否支持 STRICT_ABORT 零冲突提交
  summaryText: string;           // 摘要文本
}

export interface SchedulingReceipt {
  success: boolean;
  batchId: string;               // 批量排课流水号 (UUID)
  persistedCount: number;        // 实际持久化写入数据库的课次总数
  flaggedConflictCount: number;  // 标记为 conflict 的排课日程数
  affectedClassIds: string[];    // 关联同步刷新统计进度的班级 ID 列表
  schedules: Array<{
    id: string;
    classId: string;
    className: string;
    teacherName: string;
    classroomName: string;
    date: string;
    startTime: string;
    endTime: string;
    laneIndex: number;
    semanticType: string;
  }>;
  collisions: CollisionDetail[]; // 伴随生成的冲突留痕记录
  message: string;
}
