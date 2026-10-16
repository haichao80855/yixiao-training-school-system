import { request } from '../utils/request';

export interface ClassListItemModel {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending';
  statusText: string;
  startDateText: string;
  courseId: string;
  courseName: string;
  classType: string;
  completedLessons: number;
  totalLessons: number;
  currentStudentCount: number;
  capacity: number;
  teacherId: string;
  teacherName: string;
  advisorName: string;
  schedulePatternText: string;
}

export interface ClassScheduleItemModel {
  id: string;
  date: string;
  timeRange: string;
  semanticType: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  statusText: string;
  title: string;
  actualCount: number;
  expectedCount: number;
  deductLessons: number;
  teacherName: string;
  advisorName: string;
}

export interface ClassStudentItemModel {
  studentId: string;
  name: string;
  studentNo: string;
  phone: string;
  availableLessons: number;
  joinDateText: string;
}

export interface ClassDetailModel {
  id: string;
  name: string;
  status?: string;
  statusText: string;
  startDateText: string;
  courseName: string;
  classroomName: string;
  classType: string;
  capacity: number;
  currentStudentCount: number;
  teacherName: string;
  advisorName: string;
  schedulePatternText: string;
  completedLessons: number;
  totalLessons: number;
  schedules: ClassScheduleItemModel[];
  students: ClassStudentItemModel[];
}

const MOCK_CLASSES: ClassListItemModel[] = [
  {
    id: 'cls-01',
    name: '少儿书法-001班',
    status: 'active',
    statusText: '已开班',
    startDateText: '2026-09-01',
    courseId: 'crs-sf',
    courseName: '少儿书法',
    classType: '常规班',
    completedLessons: 0,
    totalLessons: 0,
    currentStudentCount: 1,
    capacity: 50,
    teacherId: 't-01',
    teacherName: '冯老师',
    advisorName: '冯老师',
    schedulePatternText: '--',
  },
  {
    id: 'cls-02',
    name: '启蒙英语-002班',
    status: 'active',
    statusText: '已开班',
    startDateText: '2026-09-01',
    courseId: 'crs-qm',
    courseName: '启蒙英语',
    classType: '常规班',
    completedLessons: 0,
    totalLessons: 100,
    currentStudentCount: 10,
    capacity: 10,
    teacherId: 't-01',
    teacherName: '冯老师',
    advisorName: '冯老师',
    schedulePatternText: '2026.10.17 周六 10:00 ~ 12:00',
  },
  {
    id: 'cls-03',
    name: '启蒙英语-001班',
    status: 'active',
    statusText: '已开班',
    startDateText: '2026-09-01',
    courseId: 'crs-qm',
    courseName: '启蒙英语',
    classType: '常规班',
    completedLessons: 0,
    totalLessons: 100,
    currentStudentCount: 5,
    capacity: 20,
    teacherId: 't-01',
    teacherName: '冯老师',
    advisorName: '冯老师',
    schedulePatternText: '2026.10.18 周日 10:00 ~ 12:00',
  },
];

export const classApi = {
  // 1. 获取班级列表 (019 & 051)
  async getClasses(params?: {
    keyword?: string;
    campusId?: string;
    courseId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ClassListItemModel[]> {
    try {
      const res = await request<any>({
        url: '/api/educational/classes',
        method: 'GET',
        data: {
          pageSize: params?.pageSize || 100,
          ...params,
        },
      });
      const rawList = Array.isArray(res)
        ? res
        : (res && Array.isArray((res as any).list) ? (res as any).list : (res && Array.isArray((res as any).items) ? (res as any).items : null));

      if (rawList !== null) {
        let list: ClassListItemModel[] = rawList.map((item: any) => ({
          id: item.id,
          name: item.name,
          status: item.status || 'active',
          statusText: item.status === 'completed' ? '已结课' : '已开班',
          startDateText: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '--',
          courseId: item.courseId || item.course?.id || '',
          courseName: item.course?.name || item.courseName || '未指定课程',
          classType: item.type === 'regular' ? '常规班' : (item.type || item.classType || '常规班'),
          completedLessons: item.completedLessons || 0,
          totalLessons: item.plannedLessons || item.totalLessons || 0,
          currentStudentCount: item.currentStudentCount ?? item.enrolledCount ?? item.students?.length ?? item._count?.studentPackages ?? 0,
          capacity: item.capacity || 0,
          teacherId: item.teacherId || item.teacher?.id || '',
          teacherName: item.teacher?.realName || item.teacherName || '未分配讲师',
          advisorName: item.advisor?.realName || item.advisorName || '未分配学管',
          schedulePatternText: item.schedulePatternText || '--',
        }));
        if (params?.keyword) {
          const kw = params.keyword.trim().toLowerCase();
          list = list.filter((c) => c.name.toLowerCase().includes(kw) || c.courseName.toLowerCase().includes(kw));
        }
        return list;
      }
    } catch (e) {
      console.warn('[classApi] 获取班级列表失败:', e);
      return [];
    }
    return [];
  },

  // 2. 获取班级详情 (020~022)
  async getClassDetail(id: string): Promise<ClassDetailModel> {
    try {
      const res = await request<any>({
        url: `/api/educational/classes/${id}`,
        method: 'GET',
      });
      if (res && res.id) {
        const rawStudents = res.studentPackages || res.students || [];
        const students: ClassStudentItemModel[] = rawStudents.map((s: any) => ({
          studentId: s.studentId || s.student?.id || s.id,
          name: s.student?.name || s.name || '学员',
          studentNo: s.student?.studentNo || s.studentNo || '--',
          phone: s.student?.phone || s.phone || '--',
          availableLessons: s.remainingLessons ?? s.availableLessons ?? 0,
          joinDateText: s.joinDate || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '--'),
        }));

        // 拉取或复用排课日程列表
        let rawSchedules = Array.isArray(res.schedules) ? res.schedules : [];
        if (rawSchedules.length === 0) {
          try {
            const schedRes = await request<any>({
              url: '/api/educational/schedules',
              method: 'GET',
              data: { classId: id, pageSize: 200 },
            });
            const sList = Array.isArray(schedRes)
              ? schedRes
              : (schedRes && Array.isArray((schedRes as any).data)
                ? (schedRes as any).data
                : (schedRes && Array.isArray((schedRes as any).list) ? (schedRes as any).list : []));
            if (Array.isArray(sList) && sList.length > 0) {
              rawSchedules = sList;
            }
          } catch (err) {
            console.warn('[classApi] 补充拉取班级排课日程失败:', err);
          }
        }

        const schedules: ClassScheduleItemModel[] = rawSchedules.map((s: any, idx: number) => {
          const dateStr = s.date ? String(s.date).replace(/-/g, '.') : '--';
          const timeRangeStr = s.timeRange || (s.startTime && s.endTime ? `${dateStr} ${s.startTime}~${s.endTime}` : `${dateStr}`);
          const isDone = s.status === 'completed';
          const isCancelled = s.status === 'cancelled';
          const statusText = isDone ? '已上' : (isCancelled ? '已取消' : '未上');
          const title = s.title || (s.lessonTitle || (res.name ? `${res.name} 第${idx + 1}讲` : `第${idx + 1}讲`));
          const actualCount = s.actualCount ?? s._count?.attendances ?? (Array.isArray(s.attendances) ? s.attendances.length : 0);
          const expectedCount = s.expectedCount ?? (students.length || res.currentStudentCount || 1);

          return {
            id: s.id,
            date: s.date || '',
            timeRange: timeRangeStr,
            semanticType: s.semanticType || 'regular',
            status: (s.status as any) || 'scheduled',
            statusText,
            title,
            actualCount,
            expectedCount,
            deductLessons: s.deductLessons || 1,
            teacherName: s.teacher?.realName || s.teacherName || res.teacher?.realName || '主教老师',
            advisorName: res.advisor?.realName || res.advisorName || '教务老师',
          };
        });

        const completedLessons = schedules.filter((s) => s.status === 'completed').length;
        const totalLessons = schedules.length > 0 ? schedules.length : (res.totalLessons || res.plannedLessons || 0);

        return {
          id: res.id,
          name: res.name || (res.course?.name ? `${res.course.name}` : '未命名班级'),
          status: res.status || (res.statusText === '已结班' || res.statusText === '已结课' ? 'completed' : 'active'),
          statusText: res.status === 'completed' ? '已结班' : (res.status === 'recruiting' ? '招生中' : '已开班'),
          startDateText: res.startDate ? new Date(res.startDate).toISOString().split('T')[0] : '--',
          courseName: res.course?.name || '未指定课程',
          classroomName: res.classroom?.name || '--',
          classType: res.type === 'regular' ? '常规班' : (res.classType || '常规班'),
          capacity: res.capacity || 10,
          currentStudentCount: students.length || res.currentStudentCount || 0,
          teacherName: res.teacher?.realName || res.teacherName || '未分配讲师',
          advisorName: res.advisor?.realName || res.advisorName || '未分配学管',
          schedulePatternText: res.schedulePatternText || (schedules[0] ? schedules[0].timeRange : '--'),
          completedLessons,
          totalLessons,
          schedules,
          students,
        };
      }
    } catch (e) {
      console.warn('[classApi] 获取班级详情失败:', e);
    }

    return {
      id: id || 'cls-01',
      name: id === 'cls-01' ? '启蒙英语-001班' : '少儿书法-001班',
      status: 'active',
      statusText: '已开班',
      startDateText: '2026-09-01',
      courseName: id === 'cls-01' ? '启蒙英语' : '少儿书法',
      classroomName: '启蒙一教室',
      classType: '常规班',
      capacity: 20,
      currentStudentCount: 5,
      teacherName: '冯老师',
      advisorName: '冯老师',
      schedulePatternText: '2026.10.18 周日 10:00 ~ 12:00',
      completedLessons: 0,
      totalLessons: 100,
      schedules: [],
      students: [
        {
          studentId: 's-01',
          name: '董御',
          studentNo: 'S950014',
          phone: '13460475611',
          availableLessons: 78,
          joinDateText: '2026-09-01',
        },
      ],
    };
  },

  // 3. 班级添加学员
  async addClassStudents(classId: string, studentIds: string[]) {
    return request({
      url: `/api/educational/classes/${classId}/students`,
      method: 'POST',
      data: { studentIds },
    });
  },

  // 4. 结班
  async completeClass(classId: string, options?: any) {
    return request({
      url: `/api/educational/classes/${classId}/complete`,
      method: 'POST',
      data: options || {
        disposition: { mode: 'fallback_unassigned' },
        cancelFutureSchedules: true,
      },
    });
  },

  // 5. 移出学员并回退待分班资产池 (ADR-0004)
  async removeStudent(data: { classId: string; studentId: string; reason?: string }) {
    return request({
      url: '/api/educational/roster/remove',
      method: 'POST',
      data,
    });
  },
};

