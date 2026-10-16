export interface RawParentSingleLessonDto {
  studentName?: string;
  avatar?: string;
  lesson?: {
    lessonId: string;
    scheduleEventId: string;
    dateFormatted: string;
    timeSlot: string;
    courseName: string;
    lessonTitle: string;
    teacherName: string;
    ratingScore?: number;
    performanceTag?: string;
    personalizedComment?: string;
    syllabusPoints?: string[];
    studyContentHtml?: string;
    badges?: Array<{ name: string; icon: string; desc: string }>;
    photos?: Array<{ url: string; thumbUrl?: string }>;
    video?: { videoUrl: string; coverUrl?: string };
    voice?: { voiceUrl: string; durationSeconds?: number };
    milestone?: { cumulativeLessonIndex: number; earnedStarCount: number };
  };
  campusContact?: {
    campusName: string;
    contactPhone: string;
  };
}

export interface RawWorkbenchDto {
  schedule: {
    id: string;
    campusId: string;
    className: string;
    courseName?: string;
    teacherName?: string;
    date: string;
    startTime: string;
    endTime: string;
    timeRange?: string;
    classType?: string;
    status: string;
  };
  students: Array<{
    studentId: string;
    studentNo?: string;
    name: string;
    phone?: string;
    status?: string;
    deductLessons?: number;
    remainingLessons?: number;
    rating?: number;
    comment?: string;
    evaluated?: boolean;
    performanceTag?: string;
  }>;
  evaluationSummary?: {
    templateName?: string;
    studyContent?: string;
    teacherComment?: string;
    photoList?: string[];
    videoUrl?: string;
    overallRating?: number;
  };
}

export interface GrowthQueryPort {
  /**
   * 视角 1: 尝试调用服务端专用的家长单课回执接口
   */
  fetchParentSingleLesson?(scheduleId: string, token?: string): Promise<RawParentSingleLessonDto | null>;

  /**
   * 视角 2: 降级调用教务结课履约工作台数据
   */
  fetchScheduleWorkbench(scheduleId: string): Promise<RawWorkbenchDto>;
}

export interface GrowthCachePort {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlMs?: number): void;
  remove(key: string): void;
  clearByPrefix(prefix: string): void;
}
