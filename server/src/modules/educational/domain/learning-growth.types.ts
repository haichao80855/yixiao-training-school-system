import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * 业务领域异常定义
 */

/** 退费锁定硬阻断异常：严禁对已退费课包执行反结课冲正复活 */
export class RefundLockedException extends ConflictException {
  constructor(packageId: string, reason?: string) {
    super({
      code: 409,
      error: 'RefundLocked',
      message: `【财务防腐屏障拦截】课包 [${packageId}] 已完成退费归档（RefundLocked），严禁通过反结课冲正将其错误复活为 active 状态！${reason ? `原因: ${reason}` : ''}`,
    });
  }
}

/** 日程已结课防重复消课异常 */
export class ScheduleAlreadySettledException extends BadRequestException {
  constructor(scheduleId: string) {
    super({
      code: 400,
      error: 'ScheduleAlreadySettled',
      message: `排课日程 [${scheduleId}] 已经完成随堂点名结课，如需变更请先执行反结课冲正`,
    });
  }
}

/** 无有效考勤或防重放冲正异常 */
export class NoActiveAttendanceToReverseException extends BadRequestException {
  constructor(scheduleId: string) {
    super({
      code: 400,
      error: 'NoActiveAttendanceToReverse',
      message: `排课日程 [${scheduleId}] 无任何未冲正的有效考勤记录，严禁重复反结课（防重放刷课）`,
    });
  }
}

// ---------------------------------------------------------------------------
// 任务入参契约定义 (Task Inputs)
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'leave' | 'absent';

export interface RollCallAttendanceItem {
  studentId: string;
  status: AttendanceStatus;
  deductLessons?: number;      // 缺省时默认到课/迟到为 1 课时，请假/缺席为 0 课时
  packageId?: string;          // 目标扣减课包 ID；若缺省则内部自动按 FIFO 嗅探该课程下有效在读课包
  score?: number;              // 随堂测验打分 (0-100)
  rating?: string;             // 能力表现评级 (A+ | A | B+ | B)
  comment?: string;            // 随堂教师个性化成长评语
}

export interface SettleRollCallInput {
  scheduleEventId: string;     // 实体排课日程 ID
  operator: string;            // 经办教师/教务
  items: RollCallAttendanceItem[];
}

export interface ReverseRollCallInput {
  scheduleEventId: string;     // 实体排课日程 ID
  operator: string;            // 冲正操作人
  reason?: string;             // 冲正审计理由
  refundLockedPolicy?: 'STRICT_ABORT' | 'ESCROW_TO_WALLET'; // 遭遇退费课包时的策略，默认严格阻断
}

export interface PortfolioQueryOptions {
  courseId?: string;           // 按指定课程过滤
  subject?: string;            // 按科目过滤
  includeReversed?: boolean;   // 是否包含已冲正历史 (默认 false)
  limit?: number;              // 时间轴记录条数上限 (默认 50)
}

// ---------------------------------------------------------------------------
// 任务回执与投影模型定义 (Task Receipts & Projection Models)
// ---------------------------------------------------------------------------

export interface LessonSettlementReceipt {
  success: true;
  scheduleEventId: string;
  settledAt: string;
  operator: string;
  completedCount: number;
  totalDeductedLessons: number;
  regularLessonsBurned: number;
  bonusLessonsBurned: number;
  summary: {
    totalStudents: number;
    presentCount: number;
    lateCount: number;
    leaveCount: number;
    absentCount: number;
    totalLessonsDeducted: number;
  };
  details: Array<{
    studentId: string;
    packageId: string;
    deductLessons: number;
    regularBurned: number;
    bonusBurned: number;
    remainingAfter: number;
  }>;
  message: string;
}

export interface LessonReversalReceipt {
  success: true;
  scheduleEventId: string;
  reversedAt: string;
  operator: string;
  reversalReason: string;
  reversedCount: number;
  refundedLessons: number;
  refundedRegularLessons: number;
  refundedBonusLessons: number;
  details: Array<{
    studentId: string;
    packageId: string;
    refundedLessons: number;
    remainingAfter: number;
    statusAfter: string;
  }>;
  antiCorruptionSummary: {
    blockedRefundResurrections: number;
    divertedWalletAmount: number;
  };
  message: string;
}

/** 单条学情节点 (时间轴条目，支持全景多媒体与老旧数据优雅降级) */
export interface LearningTimelineItem {
  id: string;
  recordId: string;
  scheduleEventId: string;
  date: string;                // YYYY-MM-DD
  timeSlot: string;            // 09:00 - 10:30
  courseName: string;          // 课程名称
  className: string;           // 班级名称
  teacherName: string;         // 授课教师实名
  classroomName: string;       // 上课教室
  status: AttendanceStatus;
  deductLessons: number;
  score: number | null;        // 随堂得分 (0-100)
  rating: string | null;       // 综合评级 (A+, A, B+, B)
  comment: string;             // 随堂评语
  homeworkRating: string;      // 作业评级
  isReversed: boolean;
  reversalReason?: string;
  reversedAt?: string;

  // --- 接入多媒体课评相册流扩展 ---
  lessonTitle?: string;        // 课次主题大纲
  photoList?: string[];        // 随堂相册原始 URL 列表 (至多 9 张)
  photos?: NineGridPhoto[];    // 标准 9 宫格相册 (带缩略图与大图预览序列)
  videoUrl?: string;           // 随堂实操视频原链接
  videoMeta?: VideoPlayerMeta; // 视频播放器元数据 (含首帧封面图)
  voiceUrl?: string;           // 随堂教师语音原链接
  voiceMeta?: VoiceAudioMeta;  // 随堂教师语音元数据 (含格式化时长与波形参数)
  studyContent?: string;       // 教学大纲重难点
  studyContentHtml?: string;   // 教学大纲重难点富文本 HTML
  performanceTag?: string;     // 学员个性化表现亮点标签 (如 '算法标兵', '专注力卓越')
  shareToken?: string;         // 该单课免登录专属安全分享令牌
}

/** 9 宫格相册标准图片单元 (消灭前端胶水代码，开箱即食) */
export interface NineGridPhoto {
  id: string;
  index: number;               // 0-8 序列索引
  thumbnailUrl: string;        // 智能缩略裁剪图 (WebP, 300x300, 首屏极速加载)
  fullUrl: string;             // 高清原图 (大图缩放查看)
  previewList: string[];       // 预置全量大图预览序列 (从当前图片开始排列，直供 el-image-viewer)
  aspectRatio: '1:1' | '16:9' | '4:3';
  width?: number;
  height?: number;
}

/** 随堂语音播放元数据 */
export interface VoiceAudioMeta {
  audioUrl: string;
  durationSeconds: number;
  durationFormatted: string;   // 如 "01:28"
  waveformPeaks: number[];     // 20 点归一化振幅采样峰值序列 (0~1)，直接驱动跳动波形条动画
}

/** 随堂视频播放元数据 */
export interface VideoPlayerMeta {
  videoUrl: string;
  posterUrl: string;           // 自动嗅探或生成的视频封面图
  durationSeconds?: number;
}

/** 五维能力星级雷达模型 (归一化为 0-100) */
export interface CompetencyRadarProfile {
  logic: number;               // 逻辑思维
  creativity: number;          // 创新创意
  focus: number;               // 专注自律
  handsOn: number;             // 动手实操
  expression: number;          // 表达互动
  averageScore: number;        // 综合均分
}

/** 课消健康度与流失预警 (单一真值源 SSOT) */
export interface ConsumptionHealth {
  weeklyBurnRate: number;      // 近 30 天滑动周均消课速率 (课时/周)
  estimatedDepletionDays: number; // 预计剩余课时耗尽天数
  warningLevel: 'normal' | 'warning' | 'urgent'; // <=4 紧急, <=8 预警, 其余正常
  dormantRisk: boolean;        // 连续 14 天未上课休眠流失风险
  renewalWindowOpen: boolean;  // 是否处于续费跟进黄金窗口 (<=8课时 或 <=30天)
}

/** 课包履约进度信息 */
export interface CoursePackageProgress {
  packageId: string;
  courseId: string;
  courseName: string;
  className?: string;
  totalLessons: number;
  consumedLessons: number;
  remainingLessons: number;
  bonusLessons: number;
  progressPercent: number;     // 0-100
  pricePerLesson: number;
  expiryDate?: string;
  status: string;
  isRefundLocked: boolean;     // 是否处于退费锁定保护
  warningLevel: 'normal' | 'warning' | 'urgent';
}

/** 教师评语与高频词频作品集摘要 */
export interface GrowthPortfolioSummary {
  totalAttendedSessions: number;
  overallAttendanceRate: number; // 出勤率百分比 (0-100)
  averageQuizScore: number | null;
  ratingDistribution: {
    aPlusCount: number;
    aCount: number;
    bPlusCount: number;
    bCount: number;
  };
  highFrequencyTags: Array<{ tag: string; count: number }>;
  radar: CompetencyRadarProfile;
}

/** 360° 学员学情成长全景画像 */
export interface StudentLearningPortfolio {
  studentInfo: {
    id: string;
    studentNo: string;
    name: string;
    gender: string;
    phone: string;
    school?: string;
    grade?: string;
    campusName: string;
    status: string;
  };
  assetOverview: {
    totalRemainingLessons: number;
    totalConsumedLessons: number;
    totalLessons: number;
    overallWarningLevel: 'normal' | 'warning' | 'urgent';
    activeCourseCount: number;
  };
  packageProgressList: CoursePackageProgress[];
  timeline: LearningTimelineItem[];
  learningRecords: LearningTimelineItem[]; // 前端向下兼容别名
  growthSummary: GrowthPortfolioSummary;
  consumptionHealth: ConsumptionHealth;
  albumGallery?: Array<{
    photoUrl: string;
    thumbnailUrl: string;
    date: string;
    courseName: string;
    lessonTitle: string;
    teacherName: string;
  }>;
  portfolioShareToken?: string; // 学员全景成长大盘免登录分享 Token
}

// ============================================================================
// 双重视角工效契约 (Dual-Perspective Ergonomics Contracts)
// ============================================================================

/** 校区访问作用域上下文 */
export interface CampusScopeContext {
  targetCampusId?: string;
  operatorId?: string;
  operatorName?: string;
  isSuperAdmin?: boolean;
}

/** 视角 A 查询入参：后台抽屉全景 */
export interface AdminDossierQuery {
  studentId: string;
  courseId?: string;
  includeReversed?: boolean;   // 是否包含反结课冲正历史，默认 false
  limit?: number;              // 记录上限，默认 50
}

/** 视角 A 后台时间轴条目别名 */
export type AdminTimelineItem = LearningTimelineItem;

/** 视角 A：校区管理后台 360° 学员成长档案全景模型 */
export interface AdminLearningDossierView {
  studentInfo: {
    id: string;
    studentNo: string;
    name: string;
    gender: string;
    phone: string;
    school?: string;
    grade?: string;
    campusName: string;
    status: string;
    wechatBound: boolean;
  };
  assetOverview: {
    totalRemainingLessons: number;
    totalConsumedLessons: number;
    totalLessons: number;
    overallWarningLevel: 'normal' | 'warning' | 'urgent';
    activeCourseCount: number;
  };
  timeline: LearningTimelineItem[];
  albumGallery: Array<{
    photoUrl: string;
    thumbnailUrl: string;
    date: string;
    courseName: string;
    lessonTitle: string;
    teacherName: string;
  }>;
  growthRadar: CompetencyRadarProfile;
  consumptionHealth: ConsumptionHealth;
  packageProgressList: CoursePackageProgress[];
  portfolioShareToken: string;
}

/** 家长端激励勋章 */
export interface MotivationalBadge {
  id: string;
  code: string;
  title: string;               // 如 "逻辑探索官", "全勤小标兵", "动手小极客"
  description: string;
  level: 'bronze' | 'silver' | 'gold' | 'diamond';
}

/** 视角 B：家长端随堂单课特写卡片模型 (严格隐私脱敏与激励导向) */
export interface ParentLessonCardView {
  lessonId: string;
  scheduleEventId: string;
  dateFormatted: string;       // 如 "2026年10月14日 周三"
  timeSlot: string;            // 09:00 - 10:30
  courseName: string;
  lessonTitle: string;
  teacherName: string;
  ratingScore: number;         // 1-5 星
  performanceTag?: string;     // 如 "专注力极高"、"算法完成迅速"
  personalizedComment: string; // 针对该学员的专属定制评语
  syllabusPoints: string[];    // 提炼的大纲知识点 (纯文本切片)
  studyContentHtml: string;    // 详细大纲富文本 HTML
  badges: MotivationalBadge[]; // 激励勋章
  photos: NineGridPhoto[];     // 9 宫格相册
  voice?: VoiceAudioMeta;      // 随堂原声语音
  video?: VideoPlayerMeta;     // 随堂实操视频
  milestone: {
    cumulativeLessonIndex: number; // 这是该学员上的第 N 次课
    earnedStarCount: number;
  };
}

/** 视角 B1 查询入参：家长端全景瀑布流 */
export interface ParentFeedQuery {
  limit?: number;
  cursor?: string;
}

/** 视角 B1：家长端全景瀑布流成长脚印模型 */
export interface ParentGrowthFeedView {
  studentSummary: {
    studentId: string;
    studentName: string;       // 已安全脱敏 (如 "子豪同学")
    avatar: string;
    campusName: string;
    totalLessonsAttended: number;
    totalBadgesEarned: number;
    latestRating: number;
  };
  growthRadar: CompetencyRadarProfile;
  feed: ParentLessonCardView[];
  hasMore: boolean;
  nextCursor?: string;
}

/** 视角 B2 查询入参：微信通知直达单课 */
export interface ParentSingleLessonQuery {
  scheduleEventId: string;
}

/** 视角 B2：家长端单课特写落地页模型 */
export interface ParentSingleLessonView {
  studentName: string;
  avatar: string;
  lesson: ParentLessonCardView;
  campusContact: {
    campusName: string;
    contactPhone?: string;
  };
}

/** 单课安全访问令牌作用域 */
export type AccessTokenScope = 'single_lesson' | 'full_portfolio';

/** 安全令牌载荷 */
export interface GrowthAccessTokenPayload {
  sub: string;                 // studentId
  targetId?: string;           // 仅当 scope === 'single_lesson' 时为 scheduleEventId
  scope: AccessTokenScope;
  campusId: string;
  exp: number;                 // 秒级过期戳 (单课 30 天，全景 7 天)
  iat: number;
  nonce: string;
}

/** 签发访问令牌入参 */
export interface IssueParentTokenInput {
  studentId: string;
  scheduleEventId?: string;    // 有值则签发 single_lesson 令牌，无值则签发 full_portfolio 令牌
  ttlSeconds?: number;
}

/** 签发访问令牌回执 */
export interface ParentTokenReceipt {
  token: string;
  scope: AccessTokenScope;
  expiresAt: string;
  h5ReportUrl: string;         // 开箱即用的落地页链接，供微信模板消息直接灌装
}

