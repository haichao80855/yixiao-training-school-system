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
    const evalData = wb.evaluationSummary || (wb as any).evaluationDraft;
    const photoList = Array.isArray(evalData?.photoList) ? evalData.photoList : [];
    const videoUrl = evalData?.videoUrl || '';

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
      students: (wb.students || []).map((s: any) => ({
        studentId: s.studentId,
        studentNo: s.studentNo,
        name: s.name || s.studentName || '学员',
        phone: s.phone,
        status: s.status,
        deductLessons: s.deductLessons,
        remainingLessons: s.remainingLessons,
        rating: s.rating ?? (s.currentRating ? Number(s.currentRating) : 5),
        comment: s.comment || s.currentComment || '',
        currentComment: s.currentComment || s.comment || '',
        photos: Array.isArray(s.photos) ? s.photos : [],
        videoUrl: s.videoUrl || undefined,
        evaluated: Boolean(s.evaluated || s.isEvaluated),
        isEvaluated: Boolean(s.isEvaluated || s.evaluated),
        hasPersonalEvaluation: Boolean(s.hasPersonalEvaluation),
        evaluatedAt: s.evaluatedAt,
        performanceTag: s.performanceTag || '专注标兵',
      })),
      evaluationSummary: evalData ? {
        templateName: evalData.templateName,
        studyContent: evalData.studyContent || evalData.studyContentHtml,
        teacherComment: evalData.teacherComment,
        photoList,
        videoUrl,
        overallRating: evalData.overallRating,
      } : undefined,
    };
  }
}

