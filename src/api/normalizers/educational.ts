import type {
  ClassItem,
  ClassStatus,
  ScheduleEvent,
  ScheduleSemanticType,
  LessonClassType,
  ScheduleEventStatus,
  Classroom,
  AttendanceRecord,
  Teacher,
  WorkbenchLessonCard,
  StudentAttendanceItem,
  AttendanceStatus
} from '@/types/educational';

export function normalizeClass(raw: any): ClassItem {
  if (!raw) return {} as ClassItem;

  const studentPackages = Array.isArray(raw.studentPackages) ? raw.studentPackages : [];
  const studentIds = Array.isArray(raw.studentIds)
    ? raw.studentIds
    : studentPackages.map((p: any) => p.studentId).filter(Boolean);

  const currentStudentCount = raw.currentStudentCount !== undefined
    ? Number(raw.currentStudentCount)
    : (studentIds.length || studentPackages.length || 0);

  const startDate = raw.startDate ? String(raw.startDate).split('T')[0] : '2026-09-01';
  const endDate = raw.endDate ? String(raw.endDate).split('T')[0] : '2027-01-31';

  const students = studentPackages.map((p: any) => ({
    id: p.student?.id || p.studentId,
    name: p.student?.name || '未知学员',
    studentNo: p.student?.studentNo || '-',
    phone: p.student?.phone || '-',
    remainingLessons: Number(p.remainingLessons ?? 0),
    consumedLessons: Number(p.consumedLessons ?? 0),
  }));

  return {
    id: raw.id,
    code: raw.code || '',
    name: raw.name || '',
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '拓视未来-原阳校区',
    courseId: raw.courseId || raw.course?.id || '',
    courseName: raw.course?.name || raw.courseName || '标准课程',
    teacherId: raw.teacherId || raw.teacher?.id || '',
    teacherName: raw.teacher?.realName || raw.teacherName || '授课讲师',
    assistantId: raw.assistantId || raw.advisorId || raw.advisor?.id || undefined,
    assistantName: raw.assistantName || raw.advisor?.realName || raw.advisorName || undefined,
    classroomId: raw.classroomId || raw.classroom?.id || '',
    classroomName: raw.classroom?.name || raw.classroomName || '标准教室',
    capacity: Number(raw.capacity || 8),
    currentStudentCount,
    studentIds,
    startDate,
    endDate,
    status: (raw.status || 'in_progress') as ClassStatus,
    scheduleDesc: raw.scheduleDesc || '每周六 09:00-10:30',
    totalLessons: Number(raw.totalLessons || 48),
    completedLessons: Number(raw.completedLessons || 0),
    createdAt: raw.createdAt ? String(raw.createdAt).split('T')[0] : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt).split('T')[0] : undefined,
    // 兼容历史视图访问别名
    ...({
      currentCount: currentStudentCount,
      scheduleTime: raw.scheduleDesc || '每周六 09:00-10:30',
      students,
    } as any),
  };
}

export function normalizeSchedule(raw: any): ScheduleEvent {
  if (!raw) return {} as ScheduleEvent;

  const semanticType = (raw.semanticType || (raw.status === 'completed' ? 'completed' : 'regular')) as ScheduleSemanticType;
  const hasConflict = raw.hasConflict !== undefined
    ? Boolean(raw.hasConflict)
    : semanticType === 'conflict';

  const studentIds = Array.isArray(raw.studentIds)
    ? raw.studentIds
    : (raw.class?.studentPackages ? raw.class.studentPackages.map((p: any) => p.studentId) : []);

  const attendanceCount = Number(raw.attendanceCount ?? raw._count?.attendances ?? 0);
  const totalCount = Number(raw.totalCount ?? raw.class?.capacity ?? 8);
  const laneIndex = Number(raw.laneIndex ?? raw.lane ?? 0);

  return {
    id: raw.id,
    classId: raw.classId || raw.class?.id || undefined,
    className: raw.class?.name || raw.className || '精品班级',
    courseId: raw.class?.courseId || raw.courseId || raw.class?.course?.id || '',
    courseName: raw.class?.course?.name || raw.courseName || '标准编程课',
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '拓视未来-原阳校区',
    teacherId: raw.teacherId || raw.teacher?.id || '',
    teacherName: raw.teacher?.realName || raw.teacherName || '授课讲师',
    assistantId: raw.assistantId || undefined,
    assistantName: raw.assistantName || undefined,
    classroomId: raw.classroomId || raw.classroom?.id || '',
    classroomName: raw.classroom?.name || raw.classroomName || '标准教室',
    date: raw.date ? String(raw.date).split('T')[0] : '2026-09-26',
    startTime: raw.startTime || '09:00',
    endTime: raw.endTime || '10:30',
    durationMinutes: Number(raw.durationMinutes || 90),
    studentIds,
    semanticType,
    classType: (raw.classType || 'formal') as LessonClassType,
    status: (raw.status || 'scheduled') as ScheduleEventStatus,
    attendanceCount,
    totalCount,
    hasConflict,
    conflictType: raw.conflictType || undefined,
    conflictReason: raw.conflictReason || undefined,
    lessonNumber: raw.lessonNumber !== undefined ? Number(raw.lessonNumber) : undefined,
    lessonTitle: raw.lessonTitle || undefined,
    // 兼容历史工作台卡片与甘特视图别名
    ...({
      laneIndex,
      signedCount: attendanceCount,
    } as any),
  };
}

export function normalizeClassroom(raw: any): Classroom {
  if (!raw) return {} as Classroom;
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || raw.id || '',
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '拓视未来-原阳校区',
    capacity: Number(raw.capacity || 12),
    type: raw.type || 'regular',
    typeName: raw.typeName || '多媒体教室',
    status: (raw.status || 'available') as 'available' | 'maintenance' | 'disabled',
  };
}

export function normalizeTeacher(raw: any): Teacher {
  if (!raw) return {} as Teacher;
  return {
    id: raw.id,
    name: raw.realName || raw.name || '',
    campusId: raw.campusId || 'campus-bj-hq',
    campusName: raw.campusName || '拓视未来-原阳校区',
    phone: raw.phone || '',
    role: (raw.role || 'teacher') as 'teacher' | 'advisor' | 'head_teacher' | 'assistant',
    roleName: raw.roleName || (raw.role === 'advisor' ? '教务班主任' : '授课讲师'),
    subjects: Array.isArray(raw.subjects) ? raw.subjects : ['综合编程'],
    avatar: raw.avatar || '',
    maxWeeklyHours: raw.maxWeeklyHours || 40,
    currentWeeklyHours: raw.currentWeeklyHours || 0,
  };
}

export function normalizeAttendanceRecord(raw: any): AttendanceRecord {
  if (!raw) return {} as AttendanceRecord;
  return {
    id: raw.id,
    scheduleEventId: raw.scheduleEventId || raw.scheduleId || '',
    classId: raw.classId || raw.schedule?.classId || '',
    className: raw.className || raw.schedule?.class?.name || '',
    courseId: raw.courseId || raw.schedule?.class?.courseId,
    courseName: raw.courseName || raw.schedule?.class?.course?.name,
    campusId: raw.campusId || raw.schedule?.campusId || 'campus-bj-hq',
    campusName: raw.campusName || '拓视未来-原阳校区',
    date: raw.date ? String(raw.date).split('T')[0] : '2026-09-26',
    startTime: raw.startTime,
    endTime: raw.endTime,
    lessonNumber: Number(raw.lessonNumber || 1),
    lessonTitle: raw.lessonTitle || '',
    teacherId: raw.teacherId || '',
    teacherName: raw.teacherName || raw.teacher?.realName || '',
    studentAttendances: Array.isArray(raw.studentAttendances) ? raw.studentAttendances : (raw.items || []),
    totalStudents: Number(raw.totalStudents || 0),
    presentCount: Number(raw.presentCount || 0),
    leaveCount: Number(raw.leaveCount || 0),
    absentCount: Number(raw.absentCount || 0),
    lateCount: Number(raw.lateCount || 0),
    deductedLessonsTotal: Number(raw.deductedLessonsTotal || 0),
    isReversed: Boolean(raw.isReversed),
    reversedAt: raw.reversedAt ? String(raw.reversedAt) : undefined,
    reversedBy: raw.reversedBy,
    reversalReason: raw.reversalReason,
    createdAt: raw.createdAt ? String(raw.createdAt) : '',
    operator: raw.operator || '',
  };
}

export function normalizeWorkbenchLessonCard(raw: any): WorkbenchLessonCard {
  const evt = normalizeSchedule(raw);
  const studentCount = Number(raw.totalStudents ?? raw.totalCount ?? evt.totalCount ?? evt.studentIds?.length ?? 8);
  const signedCount = Number(raw.signedCount ?? raw.attendanceCount ?? evt.attendanceCount ?? 0);
  const evalStatus = (raw.evaluationStatus || 'none') as 'none' | 'draft' | 'published';

  return {
    ...evt,
    status: evt.status || 'scheduled',
    mode: raw.mode || 'offline',
    totalStudents: studentCount,
    signedCount,
    teachingAssistants: Array.isArray(raw.teachingAssistants)
      ? raw.teachingAssistants
      : [raw.assistantName || '教务助教'].filter(Boolean),
    evaluationStatus: evalStatus,
    playbackUrl: raw.playbackUrl || 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/playback/demo.mp4',
  };
}

export function normalizeRollCallStudent(raw: any, evt?: Partial<ScheduleEvent>): StudentAttendanceItem & { id?: string; name?: string; phone?: string; remainingLessons: number; totalRemainingLessons?: number } {
  if (!raw) return {} as any;
  const pkg = raw.coursePackages?.find((p: any) =>
    (evt?.courseId && p.courseId === evt.courseId) || (evt?.classId && p.classId === evt.classId)
  ) || raw.coursePackages?.[0];

  const studentId = raw.id || raw.studentId || '';
  const studentName = raw.name || raw.studentName || '在读学员';
  const studentNo = raw.studentNo || '-';
  const remainingLessons = Number(pkg?.remainingLessons ?? raw.totalRemainingLessons ?? raw.remainingLessons ?? 0);
  const deductionLessons = Number(raw.deductLessons ?? raw.deductionLessons ?? 1);
  const pricePerLesson = Number(pkg?.pricePerLesson ?? raw.pricePerLesson ?? 280);

  return {
    id: studentId,
    studentId,
    name: studentName,
    studentName,
    studentNo,
    phone: raw.phone || '-',
    status: (raw.attendanceStatus || raw.status || 'present') as AttendanceStatus,
    deductionLessons,
    remainingLessons,
    totalRemainingLessons: remainingLessons,
    pricePerLesson,
    packageId: raw.packageId || pkg?.id || '',
    isLowBalance: Boolean(raw.isLowBalance ?? (remainingLessons <= 3)),
    remark: raw.comment || raw.remark || '随堂实操任务完成良好',
  };
}

export interface NormalizedCollisionResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'teacher' | 'classroom' | 'class';
    reason: string;
    message?: string;
    conflictingScheduleId?: string;
    [key: string]: any;
  }>;
}

export function normalizeCollisionResult(raw: any): NormalizedCollisionResult {
  if (!raw) return { hasConflict: false, conflicts: [] };
  const rawConflicts = Array.isArray(raw.conflicts) ? raw.conflicts : [];
  const conflicts = rawConflicts.map((c: any) => ({
    type: c.type || 'teacher',
    reason: c.message || c.reason || '时段重叠冲突',
    message: c.message || c.reason || '时段重叠冲突',
    conflictingScheduleId: c.conflictingScheduleId,
    ...c,
  }));
  return {
    hasConflict: Boolean(raw.hasConflict || conflicts.length > 0),
    conflicts,
  };
}

