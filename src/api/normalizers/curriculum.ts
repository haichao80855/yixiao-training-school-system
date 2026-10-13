import type {
  CourseItem,
  CourseUnit,
  LessonItem,
  CourseAttribute,
  CourseStatus
} from '@/types/curriculum';

export function normalizeLesson(raw: any): LessonItem {
  if (!raw) return {} as LessonItem;
  return {
    id: raw.id,
    title: raw.title || raw.name || raw.lessonName || '',
    name: raw.name || raw.title || raw.lessonName || '',
    duration: Number(raw.duration || raw.durationMin || 60),
    order: Number(raw.order || raw.sort || 1),
    objective: raw.objective || '教学大纲核心知识与工程实操',
    pptUrl: raw.pptUrl || raw.courseware || '',
    codeTemplate: raw.codeTemplate || '',
    videoUrl: raw.videoUrl || '',
    quizCount: Number(raw.quizCount || 0),
    hasMedia: Boolean(raw.hasMedia || raw.courseware),
  };
}

export function normalizeCourseUnit(raw: any): CourseUnit {
  if (!raw) return {} as CourseUnit;
  const rawLessons = Array.isArray(raw.lessons) ? raw.lessons : [];
  return {
    id: raw.id,
    title: raw.title || raw.unitName || '',
    description: raw.description || '',
    order: Number(raw.order || raw.sort || 1),
    lessons: rawLessons.map(normalizeLesson),
  };
}

export function normalizeCourse(raw: any): CourseItem {
  if (!raw) return {} as CourseItem;

  const rawUnits = Array.isArray(raw.units) ? raw.units : [];
  let authCampusIds: string[] = [];
  if (Array.isArray(raw.authorizedCampusIds)) {
    authCampusIds = raw.authorizedCampusIds;
  } else if (Array.isArray(raw.campusAuths)) {
    authCampusIds = raw.campusAuths.map((a: any) => a.campusId).filter(Boolean);
  } else if (typeof raw.authorizedCampusIds === 'string') {
    try {
      authCampusIds = JSON.parse(raw.authorizedCampusIds);
    } catch {
      authCampusIds = raw.authorizedCampusIds.split(',').filter(Boolean);
    }
  }

  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || '',
    cover: raw.cover || '',
    pricePerLesson: Number(raw.pricePerLesson || 0),
    totalLessons: Number(raw.totalLessons || 0),
    subject: raw.subject || '少儿编程',
    grade: raw.grade || '小学全学段',
    attribute: (raw.attribute || 'regular') as CourseAttribute,
    status: (raw.status || 'enabled') as CourseStatus,
    authorizedCampusIds: authCampusIds.length > 0 ? authCampusIds : [raw.campusId || 'campus-bj-hq'],
    type: raw.type || '常规',
    description: raw.description || '',
    standardDuration: Number(raw.standardDuration || 90),
    maxCapacity: Number(raw.maxCapacity || 8),
    year: raw.year || '2026',
    period: raw.period || '秋季班',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    units: rawUnits.map(normalizeCourseUnit),
  };
}

export interface NormalizedPlatformLesson {
  sessionId: number;
  sessionCode: string;
  sessionName: string;
  pptUrl?: string;
  pptFileName?: string;
  downloadUrl?: string;
}

export function normalizePlatformLessons(units: any[], courseCode: string): NormalizedPlatformLesson[] {
  if (!Array.isArray(units)) return [];
  const dbLessons: NormalizedPlatformLesson[] = [];
  let sid = 1;
  units.forEach((u: any) => {
    (u.lessons || []).forEach((l: any) => {
      const name = l.lessonName || l.name || l.title || `第 ${sid} 课`;
      const url = l.courseware || l.pptUrl || '';
      dbLessons.push({
        sessionId: sid,
        sessionCode: `${courseCode}_${sid}`,
        sessionName: name,
        pptUrl: url,
        downloadUrl: url,
        pptFileName: `${name}.pptx`,
      });
      sid++;
    });
  });
  return dbLessons;
}
