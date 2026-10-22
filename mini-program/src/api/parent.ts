/**
 * 家长端接口 (/api/parent/*)
 * 媒体地址均为后端签发的限时签名链接；相对路径需拼接 BASE_URL (见 mediaUrl)。
 */
import { request, BASE_URL } from '../utils/request';

export interface ParentChild {
  studentId: string;
  name: string;
  campusId: string;
  campusName: string;
  status: string;
  access: 'full' | 'read_only';
  readOnlyUntil: string | null;
}

export interface ParentLoginResult {
  accessToken: string;
  expiresIn: number;
  account: { phoneMasked: string };
  currentStudentId: string;
  children: ParentChild[];
}

export interface ParentMe {
  account: { phoneMasked: string };
  currentStudentId: string | null;
  children: ParentChild[];
}

export interface ParentSessionItem {
  id: string;
  deviceLabel: string;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
}

export type LessonStatus = 'upcoming' | 'present' | 'leave' | 'absent' | 'cancelled' | 'not_recorded';

export interface ScheduleLesson {
  scheduleEventId: string;
  date: string;
  startTime: string;
  endTime: string;
  courseName: string | null;
  className: string | null;
  teacherName: string | null;
  classroomName: string | null;
  classType: string;
  status: LessonStatus;
  isLate: boolean;
  evaluationReady: boolean;
}

export interface CoursePackage {
  packageId: string;
  courseName: string | null;
  className: string | null;
  totalLessons: number;
  consumedLessons: number;
  remainingLessons: number;
  bonusLessons: number;
  expiryDate: string | null;
  status: string;
  lowHours: boolean;
  estimatedWeeksLeft: number | null;
}

export interface CourseUsage {
  packageId: string;
  courseName: string | null;
  entries: Array<{
    scheduleEventId: string;
    date: string | null;
    timeSlot: string | null;
    lessonTitle: string | null;
    attendance: string;
    hours: number;
    returned: boolean;
    returnedAt: string | null;
  }>;
}

export interface FeedItem {
  scheduleEventId: string;
  date: string | null;
  timeSlot: string | null;
  courseName: string | null;
  teacherName: string | null;
  attendance: string;
  evaluation: null | {
    lessonTitle: string;
    rating: number | null;
    tag: string | null;
    commentPreview: string | null;
    photoThumbs: string[];
    photoCount: number;
    hasVideo: boolean;
    publishedAt: string | null;
    unread: boolean;
  };
}

export interface PhotoLink {
  url: string;
  thumbUrl: string;
}

export interface EvaluationDetail {
  scheduleEventId: string;
  date: string;
  timeSlot: string;
  courseName: string | null;
  lessonTitle: string;
  teacherName: string | null;
  attendance: string;
  content: { html: string | null; keyPoints: string[] };
  overall: { rating: number | null; comment: string | null; voice: { url: string; seconds: number | null } | null };
  forChild: null | {
    rating: number | null;
    tag: string | null;
    comment: string | null;
    homework: string | null;
    photos: PhotoLink[];
    video: { url: string } | null;
  };
  classMedia: { photos: PhotoLink[]; video: { url: string } | null };
  publishedAt: string | null;
  revision: number;
}

export interface AlbumWeek {
  weekStart: string;
  weekEnd: string;
  lessonCount: number;
  photos: Array<PhotoLink & { scheduleEventId: string; date: string; lessonTitle: string; isOwn: boolean }>;
  videos: Array<{ url: string; scheduleEventId: string; date: string; lessonTitle: string; isOwn: boolean }>;
}

export interface GrowthSummary {
  lessonsAttended: number;
  evaluations: number;
  photos: number;
  videos: number;
}

/** 后端未配置 MEDIA_PUBLIC_BASE_URL 时返回相对路径，这里补全为可访问的完整地址 */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`;
}

const s = (studentId: string) => `/api/parent/students/${encodeURIComponent(studentId)}`;

export const parentApi = {
  login(data: { phone: string; password: string; wxCode?: string; deviceLabel?: string }) {
    return request<ParentLoginResult>({ url: '/api/parent/auth/login', method: 'POST', data });
  },
  logout() {
    return request<{ success: boolean }>({ url: '/api/parent/auth/logout', method: 'POST' });
  },
  me() {
    return request<ParentMe>({ url: '/api/parent/me' });
  },
  setCurrentChild(studentId: string) {
    return request<{ currentStudentId: string }>({ url: '/api/parent/me/current-child', method: 'PUT', data: { studentId } });
  },
  sessions() {
    return request<ParentSessionItem[]>({ url: '/api/parent/sessions' });
  },
  revokeSession(id: string) {
    return request<{ success: boolean }>({ url: `/api/parent/sessions/${encodeURIComponent(id)}`, method: 'DELETE' });
  },
  schedule(studentId: string, from: string, to: string) {
    return request<{ from: string; to: string; lessons: ScheduleLesson[] }>({ url: `${s(studentId)}/schedule`, data: { from, to } });
  },
  courses(studentId: string) {
    return request<CoursePackage[]>({ url: `${s(studentId)}/courses` });
  },
  courseUsage(studentId: string, packageId: string) {
    return request<CourseUsage>({ url: `${s(studentId)}/courses/${encodeURIComponent(packageId)}/usage` });
  },
  evaluations(studentId: string, cursor?: string | null, limit = 20) {
    return request<{ items: FeedItem[]; nextCursor: string | null }>({
      url: `${s(studentId)}/evaluations`,
      data: { cursor: cursor || undefined, limit },
    });
  },
  evaluationDetail(studentId: string, scheduleEventId: string) {
    return request<EvaluationDetail>({ url: `${s(studentId)}/evaluations/${encodeURIComponent(scheduleEventId)}` });
  },
  markRead(studentId: string, scheduleEventId: string) {
    return request<{ success: boolean }>({ url: `${s(studentId)}/evaluations/${encodeURIComponent(scheduleEventId)}/read`, method: 'POST' });
  },
  album(studentId: string, params: { cursor?: string | null; type?: 'photo' | 'video'; limit?: number } = {}) {
    return request<{ weeks: AlbumWeek[]; nextCursor: string | null }>({
      url: `${s(studentId)}/album`,
      data: { cursor: params.cursor || undefined, type: params.type, limit: params.limit },
    });
  },
  growthSummary(studentId: string) {
    return request<GrowthSummary>({ url: `${s(studentId)}/growth/summary` });
  },
};
