export interface RadarDimension {
  key: string;       // 维度标识 (focus, expression, logic, practice, collaboration)
  label: string;     // 中文标签 (专注力, 表达力, 逻辑力, 动手力, 合作力)
  score: number;     // 百分制得分 (0 ~ 100)
}

export interface LessonGrowthPhoto {
  url: string;
  thumbUrl: string;
}

export interface LessonGrowthVideo {
  videoUrl: string;
  coverUrl?: string;
}

export interface LessonGrowthBadge {
  name: string;
  icon: string;
  desc: string;
}

export interface LessonGrowthView {
  readonly studentId: string;
  readonly studentName: string;
  readonly scheduleId: string;
  readonly className: string;
  readonly dateText: string;
  readonly timeSlotText: string;
  readonly score: number;                   // 综合折算得分 (如 98)
  readonly levelText: string;               // 表现等第 (如 'A+')
  readonly performanceTag: string;          // 表现标签 (如 '专注标兵')
  readonly teacherComment: string;          // 教师随堂个性化寄语
  readonly syllabusPoints: readonly string[];// 教学大纲知识点列表
  readonly photos: readonly LessonGrowthPhoto[]; // 9 宫格照片
  readonly video?: LessonGrowthVideo;       // 短视频直放元数据
  readonly badges: readonly LessonGrowthBadge[]; // 荣誉勋章
  readonly radarDimensions: readonly RadarDimension[]; // 5 维素养数据
  readonly radarSvgPolygonPoints: string;   // 原生 SVG 多边形顶点坐标序列
  readonly radarSvgDataUri?: string;        // 兼容微信小程序原生 WXML <image> 矢量雷达 Data URI
  readonly source: 'network_fresh' | 'cache_instant' | 'degraded_fallback';
  readonly queriedAt: number;
}

export interface LessonGrowthQuery {
  scheduleId: string;
  studentId: string;
  campusId?: string;
  forceRefresh?: boolean;
}

export interface LearningGrowthProjector {
  /**
   * 唯一核心接缝：按排课与学员维度投影多媒体学情卡片
   * 内部封装纯数学 SVG 几何折算、双数据源降级与短时缓存
   */
  projectLessonGrowth(
    query: LessonGrowthQuery | { scheduleId: string; studentId: string; forceRefresh?: boolean }
  ): Promise<LessonGrowthView>;

  /**
   * 清除指定排课的本地学情缓存
   */
  evictGrowthCache(scheduleId: string): void;

  /**
   * 原生 5 维多边形顶点坐标计算
   */
  generateRadarSvgPoints(dimensions: RadarDimension[]): string;

  /**
   * 兼容微信小程序原生 WXML <image> 渲染的完整 SVG Data URI 编码生成器
   */
  generateRadarSvgDataUri(points: string, dimensions?: RadarDimension[]): string;
}
