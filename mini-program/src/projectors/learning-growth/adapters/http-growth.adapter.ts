import { request } from '../../../utils/request';
import { eduApi } from '../../../api/edu';
import type {
  GrowthQueryPort,
  RawParentSingleLessonDto,
  RawWorkbenchDto,
} from '../ports';

export class HttpGrowthQueryAdapter implements GrowthQueryPort {
  async fetchParentSingleLesson(
    scheduleId: string,
    token?: string
  ): Promise<RawParentSingleLessonDto | null> {
    if (!token) return null;
    try {
      const res = await request<RawParentSingleLessonDto>({
        url: '/api/educational/public/growth/lesson',
        method: 'GET',
        data: {
          scheduleEventId: scheduleId,
          token,
        },
      });
      return res || null;
    } catch {
      return null;
    }
  }

  async fetchScheduleWorkbench(scheduleId: string): Promise<RawWorkbenchDto> {
    const wb = await eduApi.getFulfillmentWorkbench(scheduleId);
    return {
      schedule: {
        id: wb.schedule.id,
        campusId: wb.schedule.campusId,
        className: wb.schedule.className,
        courseName: wb.schedule.courseName,
        teacherName: wb.schedule.teacherName,
        date: wb.schedule.date,
        startTime: wb.schedule.startTime,
        endTime: wb.schedule.endTime,
        timeRange: wb.schedule.timeRange,
        classType: wb.schedule.classType,
        status: wb.schedule.status,
      },
      students: (wb.students || []).map((s) => ({
        studentId: s.studentId,
        studentNo: s.studentNo,
        name: s.name,
        phone: s.phone,
        status: s.status,
        deductLessons: s.deductLessons,
        remainingLessons: s.remainingLessons,
        rating: 5,
        comment: '',
        evaluated: s.evaluated,
        performanceTag: '专注标兵',
      })),
      evaluationSummary: wb.evaluationSummary,
    };
  }
}
