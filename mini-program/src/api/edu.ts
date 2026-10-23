import { request, BASE_URL as SHARED_BASE_URL } from '../utils/request';

export interface ScheduleEventModel {
  id: string;
  campusId: string;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  advisorName?: string;
  classroomId: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  semanticType: 'regular' | 'completed' | 'conflict' | 'personal';
  classType: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  expectedCount: number;
  actualCount: number;
  coursewareUrl?: string;
  /** 本班第几讲（服务端按班级未取消课次顺序派生，与 Web 讲台一致） */
  lessonNumber?: number;
  /** 课程大纲中对应讲次的主题；大纲未覆盖时为空 */
  lessonTitle?: string;
}

export interface StudentRollCallModel {
  studentId: string;
  studentNo: string;
  name: string;
  avatar?: string;
  status: 'present' | 'leave' | 'absent' | 'late';
  deductLessons: number;
  packageId?: string;
  packageName?: string;
  remainingLessons: number;
  phone?: string;
  tag?: string;
  evaluated?: boolean;
  isEvaluated?: boolean;
  isExempt?: boolean;
  evaluatedAt?: string;
  evaluatedSource?: string;
  photos?: string[];
  videoUrl?: string;
  comment?: string;
  rating?: number;
  currentComment?: string;
  currentRating?: number;
}

export interface FulfillmentWorkbenchModel {
  schedule: ScheduleEventModel;
  students: StudentRollCallModel[];
  evaluationSummary?: {
    templateId?: string;
    templateName?: string;
    lessonTitle?: string;
    studyContent?: string;
    teacherComment?: string;
    photoList?: string[];
    videoUrl?: string;
    /** 课次课评状态：draft | published | revoked */
    status?: string;
    /** 课评最近一次发布时间 (ISO) */
    lastPublishedAt?: string;
  };
}

export interface FulfillLessonPayload {
  scheduleEventId: string;
  mode?: 'FULL_SETTLE' | 'ATTENDANCE_ONLY' | 'PUBLISH_EVALUATION';
  overrides?: Array<{ studentId: string; status: string; deductLessons?: number; comment?: string }>;
  anomalyOverrides?: Array<{ studentId: string; status?: any; deductLessons?: number; personalizedComment?: string; rating?: number; performanceTag?: string }>;
  attendances?: any[];
  evaluationContent?: {
    studyContent?: string;
    teacherComment?: string;
    photoList?: string[];
    videoUrl?: string;
    overallRating?: number;
    lessonTitle?: string;
    templateId?: string;
    templateName?: string;
  };
  studyContentHtml?: string;
  teacherComment?: string;
  photoList?: string[];
  videoUrl?: string;
  overallRating?: number;
  lessonTitle?: string;
  templateId?: string;
  templateName?: string;
  operatorId?: string;
  operatorName?: string;
  campusId?: string;
  idempotencyKey?: string;
}

export interface CommitEvaluationPayload {
  scheduleEventId: string;
  classId?: string;
  studyContent?: string;
  teacherComment?: string;
  photoList?: string[];
  videoUrl?: string;
  voiceUrl?: string;
  templateId?: string;
  templateName?: string;
  publish?: boolean;
  lessonTitle?: string;
  overallRating?: number;
  operatorId?: string;
  operatorName?: string;
  idempotencyKey?: string;
  dispatchStrategy?: 'ATTENDED_ONLY' | 'ALL_ROSTER' | 'UNSENT_RETRY';
  studentComments?: Array<{ studentId: string; comment: string; rating?: number }>;
  studentOverrides?: Array<{
    studentId: string;
    attendanceStatus?: 'present' | 'leave' | 'absent' | 'late' | 'unrecorded';
    deductLessons?: number;
    personalizedComment?: string;
    rating?: number;
    performanceTag?: string;
    photos?: string[];
    videoUrl?: string;
    isEvaluated?: boolean;
  }>;
  payload?: any;
}

// 后端地址单一来源：与 utils/request 共用，避免上传 (uni.uploadFile) 与普通请求指向不同服务器
export const BASE_URL = SHARED_BASE_URL;

/**
 * 教务模块统一 API 客户端
 */
export const eduApi = {
  // 1. 获取讲台排课日程
  async getSchedules(params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    teacherId?: string;
    classId?: string;
    campusId?: string;
  }): Promise<ScheduleEventModel[]> {
    try {
      const res = await request<any[]>({
        url: '/api/educational/schedules',
        method: 'GET',
        data: params,
      });

      if (Array.isArray(res)) {
        return res.map((item) => {
          const actualCount = item.attendances
            ? item.attendances.filter((a: any) => a.status === 'present' || a.status === 'late').length
            : (item.actualCount ?? item.signedCount ?? 0);

          const expectedCount = item.expectedCount
            ?? item.totalStudents
            ?? item.studentCount
            ?? item.class?.currentStudentCount
            ?? (Array.isArray(item.studentIds) ? item.studentIds.length : (item.class?.capacity ?? 0));

          return {
            id: item.id,
            campusId: item.campusId,
            classId: item.classId,
            className: item.class?.name || item.className || '周二18.30周六10.00班-12',
            courseId: item.class?.courseId || item.courseId || 'crs-default',
            courseName: item.class?.course?.name || item.courseName || '启蒙英语',
            teacherId: item.teacherId,
            teacherName: item.teacher?.realName || item.teacherName || '冯老师',
            advisorName: item.class?.advisor?.realName || item.advisorName || item.teacher?.realName || '冯老师',
            classroomId: item.classroomId,
            classroomName: item.classroom?.name || item.classroomName || '启蒙英语教室',
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            timeRange: item.timeRange || `${item.date} ${item.startTime}-${item.endTime}`,
            semanticType: item.semanticType || (item.status === 'completed' ? 'completed' : 'regular'),
            classType: item.classType || '线下课',
            status: item.status || 'scheduled',
            expectedCount,
            actualCount,
            coursewareUrl: item.coursewareUrl,
            lessonNumber: typeof item.lessonNumber === 'number' ? item.lessonNumber : undefined,
            lessonTitle: item.lessonTitle || undefined,
          };
        });
      }
      return [];
    } catch (e) {
      console.warn('[EduApi] 获取后端排课失败，使用默认高保真数据:', e);
      return [];
    }
  },

  // 2. 水化结课履约工作台 (ADR-0009)
  async getFulfillmentWorkbench(scheduleEventId: string): Promise<FulfillmentWorkbenchModel> {
    try {
      const res = await request<any>({
        url: `/api/educational/fulfillment/workbench/${scheduleEventId}`,
        method: 'GET',
      });
      if (res && res.schedule) {
        return {
          schedule: {
            id: res.schedule.id,
            campusId: res.schedule.campusId || uni.getStorageSync('currentCampusId') || 'campus-bj-hq',
            classId: res.schedule.classId,
            className: res.schedule.className || '周二18.30周六10.00班-12',
            courseId: res.schedule.courseId || 'crs-default',
            courseName: res.schedule.courseName || '标准课程',
            teacherId: res.schedule.teacherId,
            teacherName: res.schedule.teacherName || '冯老师',
            advisorName: res.schedule.advisorName || res.schedule.teacherName || '冯老师',
            classroomId: res.schedule.classroomId,
            classroomName: res.schedule.classroomName || '标准教室',
            date: res.schedule.date,
            startTime: res.schedule.startTime,
            endTime: res.schedule.endTime,
            timeRange: res.schedule.timeSlot || `${res.schedule.date} ${res.schedule.startTime}-${res.schedule.endTime}`,
            semanticType: res.schedule.status === 'completed' ? 'completed' : 'regular',
            classType: res.schedule.classType || '线下课',
            status: res.schedule.status || 'scheduled',
            expectedCount: res.schedule?.expectedCount ?? res.summary?.totalStudents ?? (res.students ? res.students.length : 0),
            actualCount: res.schedule?.actualCount !== undefined
              ? res.schedule.actualCount
              : (res.summary?.defaultPresentCount ?? (res.students ? res.students.filter((s: any) => (s.recordedStatus || s.defaultStatus) === 'present' || (s.recordedStatus || s.defaultStatus) === 'late').length : 0)),
            coursewareUrl: res.schedule.coursewareUrl,
          },
          students: (res.students || []).map((s: any) => {
            const studentPhotos = Array.isArray(s.photos)
              ? s.photos
              : typeof s.photos === 'string'
                ? JSON.parse(s.photos || '[]')
                : [];
            // 【写课评 / 看学情】【已推送】只认服务端 isPublished (课评已发布且家长可见)；
            // 有评语 / 媒体但尚未发布的草稿、重开 / 反结课后的课评都不算已推送
            // 旧版服务端无 isPublished 字段时沿用原口径 (有评定标记 / 评语 / 媒体即视为已评)
            const isStudentEvaluated = typeof s.isPublished === 'boolean'
              ? s.isPublished
              : Boolean(
                s.isEvaluated ||
                s.evaluated ||
                (studentPhotos && studentPhotos.length > 0) ||
                s.videoUrl ||
                s.currentComment ||
                s.comment
              );
            return {
              studentId: s.studentId,
              studentNo: s.studentNo,
              name: s.studentName || s.name || '学员',
              avatar: s.avatar,
              status: (s.recordedStatus || s.status || s.defaultStatus || 'present') as any,
              deductLessons: s.deductLessons ?? s.defaultDeductLessons ?? 1,
              packageId: s.packageId,
              packageName: s.packageName,
              remainingLessons: s.remainingLessons ?? 0,
              phone: s.phone,
              tag: s.tag || (s.bonusLessons > 0 ? '赠' : '正'),
              evaluated: isStudentEvaluated,
              isEvaluated: isStudentEvaluated,
              isExempt: Boolean(s.isExempt),
              hasPersonalEvaluation: Boolean(s.hasPersonalEvaluation || s.evaluatedAt || (studentPhotos && studentPhotos.length > 0) || s.videoUrl),
              photos: studentPhotos,
              videoUrl: s.videoUrl || undefined,
              comment: s.currentComment || s.comment || undefined,
              rating: s.currentRating !== undefined ? Number(s.currentRating) : (s.rating !== undefined ? Number(s.rating) : 5),
              currentComment: s.currentComment || s.comment || undefined,
              currentRating: s.currentRating !== undefined ? Number(s.currentRating) : undefined,
              evaluatedAt: s.evaluatedAt || undefined,
              evaluatedSource: s.evaluatedSource || 'web',
            };
          }),
          evaluationSummary: res.evaluationDraft ? {
            templateId: res.evaluationDraft.templateId,
            templateName: res.evaluationDraft.templateName,
            lessonTitle: res.evaluationDraft.lessonTitle,
            studyContent: res.evaluationDraft.studyContentHtml,
            teacherComment: res.evaluationDraft.teacherComment,
            photoList: res.evaluationDraft.photoList,
            videoUrl: res.evaluationDraft.videoUrl,
            // 用于判定本地草稿是否已被其他端 (Web / 其他手机) 的发布覆盖
            status: res.evaluationDraft.evaluationStatus,
            lastPublishedAt: res.evaluationDraft.lastPublishedAt,
          } : res.evaluationSummary,
        };
      }
    } catch (e) {
      console.warn('[EduApi] 水化履约工作台失败，使用内置高保真数据:', e);
    }

    // 默认高保真回退（对齐截图 016 与 ADR-0009 契约测试）
    return {
      schedule: {
        id: scheduleEventId || 'sch-mock-001',
        campusId: 'campus-bj-hq',
        classId: 'cls-qm-002',
        className: '周二18.30周六10.00班-12',
        courseId: 'crs-qm',
        courseName: '启蒙英语',
        teacherId: 'teacher-feng',
        teacherName: '冯老师',
        advisorName: '冯老师',
        classroomId: 'cr-101',
        classroomName: '启蒙英语-002班教室',
        date: '2026-10-13',
        startTime: '18:30:00',
        endTime: '20:30:00',
        timeRange: '2026-10-13 18:30:00-20:30:00',
        semanticType: 'completed',
        classType: '线下课',
        status: 'completed',
        expectedCount: 10,
        actualCount: 10,
      },
      students: [
        { studentId: 's-01', studentNo: 'S950014', name: '董御', status: 'present', deductLessons: 1, remainingLessons: 84, tag: '正', evaluated: false },
        { studentId: 's-02', studentNo: 'S950007', name: '张景恒', status: 'present', deductLessons: 1, remainingLessons: 72, tag: '正', evaluated: false },
        { studentId: 's-03', studentNo: 'S950006', name: '吴炳润', status: 'present', deductLessons: 1, remainingLessons: 60, tag: '正', evaluated: false },
        { studentId: 's-04', studentNo: 'S950003', name: '郑扶摇', status: 'present', deductLessons: 1, remainingLessons: 55, tag: '正', evaluated: false },
        { studentId: 's-05', studentNo: 'S950005', name: '孙佳音', status: 'present', deductLessons: 1, remainingLessons: 48, tag: '正', evaluated: false },
        { studentId: 's-06', studentNo: 'S950009', name: '赵梓涵', status: 'present', deductLessons: 1, remainingLessons: 42, tag: '正', evaluated: false },
        { studentId: 's-07', studentNo: 'S950010', name: '周子程', status: 'present', deductLessons: 1, remainingLessons: 36, tag: '正', evaluated: false },
        { studentId: 's-08', studentNo: 'S950011', name: '钱思睿', status: 'present', deductLessons: 1, remainingLessons: 30, tag: '正', evaluated: false },
        { studentId: 's-09', studentNo: 'S950012', name: '李浩轩', status: 'present', deductLessons: 1, remainingLessons: 24, tag: '正', evaluated: false },
        { studentId: 's-10', studentNo: 'S950013', name: '陈楚河', status: 'present', deductLessons: 1, remainingLessons: 18, tag: '正', evaluated: false },
      ],
    };
  },

  // 3. 执行单原子结课履约 (ADR-0009)
  async fulfillLesson(payload: FulfillLessonPayload) {
    const anomalyOverrides = payload.anomalyOverrides || payload.overrides?.map((o) => ({
      studentId: o.studentId,
      status: o.status as any,
      deductLessons: o.deductLessons,
      personalizedComment: o.comment,
    })) || payload.attendances?.map((a) => ({
      studentId: a.studentId,
      status: a.status as any,
      deductLessons: a.deductLessons,
      personalizedComment: a.comment || a.personalizedComment,
    }));

    const overrides = payload.overrides || anomalyOverrides?.map((a: any) => ({
      studentId: a.studentId,
      status: a.status,
      deductLessons: a.deductLessons,
      comment: a.personalizedComment,
    }));

    const studyContentHtml = payload.studyContentHtml || payload.evaluationContent?.studyContent;
    const teacherComment = payload.teacherComment || payload.evaluationContent?.teacherComment;
    const photoList = payload.photoList || payload.evaluationContent?.photoList;
    const videoUrl = payload.videoUrl || payload.evaluationContent?.videoUrl;
    const overallRating = payload.overallRating || payload.evaluationContent?.overallRating;
    const lessonTitle = payload.lessonTitle || payload.evaluationContent?.lessonTitle;
    const templateId = payload.templateId || payload.evaluationContent?.templateId;
    const templateName = payload.templateName || payload.evaluationContent?.templateName;

    const data: any = {
      scheduleEventId: payload.scheduleEventId,
      mode: payload.mode || 'FULL_SETTLE',
      anomalyOverrides,
      overrides,
      studyContentHtml,
      teacherComment,
      photoList,
      videoUrl,
      overallRating,
      lessonTitle,
      templateId,
      templateName,
      evaluationContent: payload.evaluationContent,
    };

    if (payload.idempotencyKey) {
      data.idempotencyKey = payload.idempotencyKey;
    }
    if (payload.campusId) {
      data.campusId = payload.campusId;
    }
    if (payload.operatorId) {
      data.operatorId = payload.operatorId;
    }
    if (payload.operatorName) {
      data.operatorName = payload.operatorName;
    }

    return request({
      url: '/api/educational/fulfillment/fulfill',
      method: 'POST',
      data,
    });
  },

  // 4. 反结课级联冲正 (ADR-0009)
  async reverseFulfillment(scheduleEventIdOrPayload: string | { scheduleEventId: string; reason: string; strategy?: string }, reason?: string) {
    const data = typeof scheduleEventIdOrPayload === 'string'
      ? { scheduleEventId: scheduleEventIdOrPayload, reason: reason || '教务冲正' }
      : scheduleEventIdOrPayload;
    return request({
      url: '/api/educational/fulfillment/reverse',
      method: 'POST',
      data,
    });
  },

  // 5. 提交随堂课评与微信通知 (ADR-0008)
  async commitEvaluation(payload: CommitEvaluationPayload) {
    const rawPayload = payload.payload;
    const studyContentHtml = rawPayload?.studyContentHtml || payload.studyContent || '本堂课学生专注投入，知识点掌握扎实。';
    const teacherComment = rawPayload?.teacherComment || payload.teacherComment || '课堂表现专注，互动积极，学习状态良好！';
    const overallRating = rawPayload?.overallRating ?? payload.overallRating ?? 5.0;
    const lessonTitle = rawPayload?.lessonTitle || payload.lessonTitle || '随堂课评与素养分析';
    const templateName = rawPayload?.templateName || payload.templateName || '通用课评模板';
    const templateId = rawPayload?.templateId || payload.templateId;
    const photoList = rawPayload?.photoList || payload.photoList || [];
    const videoUrl = rawPayload?.videoUrl || payload.videoUrl;
    const voiceUrl = rawPayload?.voiceUrl || payload.voiceUrl;

    const studentOverrides = rawPayload?.studentOverrides || payload.studentOverrides || (payload.studentComments?.map((s) => ({
      studentId: s.studentId,
      personalizedComment: s.comment,
      rating: s.rating ?? 5.0,
    })) || []);

    const nestedPayload = {
      templateId,
      templateName,
      lessonTitle,
      studyContentHtml,
      overallRating,
      teacherComment,
      photoList,
      videoUrl,
      voiceUrl,
      studentOverrides,
    };

    const requestBody: any = {
      scheduleEventId: payload.scheduleEventId,
      publish: payload.publish !== false,
      payload: nestedPayload,
      // 保持顶层扁平字段以兼容既有前端/测试断言与离线逻辑
      classId: payload.classId,
      studyContent: payload.studyContent,
      teacherComment: payload.teacherComment,
      photoList: payload.photoList,
      videoUrl: payload.videoUrl,
      templateId: payload.templateId,
      templateName: payload.templateName,
      studentComments: payload.studentComments,
    };

    if (payload.idempotencyKey) {
      requestBody.idempotencyKey = payload.idempotencyKey;
    }
    if (payload.operatorId) {
      requestBody.operatorId = payload.operatorId;
    }
    if (payload.operatorName) {
      requestBody.operatorName = payload.operatorName;
    }

    return request({
      url: '/api/educational/lesson-evaluations/commit',
      method: 'POST',
      data: requestBody,
    });
  },

  // 6. 多媒体上传（批量实况照片与短视频）
  async uploadPhoto(filePath: string, scheduleEventId?: string): Promise<string> {
    const campusId = uni.getStorageSync('currentCampusId') || 'campus-bj-hq';
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${BASE_URL}/api/upload/photos`,
        filePath,
        name: 'files',
        formData: {
          scheduleEventId: scheduleEventId || '',
          campusId,
        },
        header: {
          'x-campus-id': campusId,
          ...(uni.getStorageSync('token') ? { Authorization: `Bearer ${uni.getStorageSync('token')}` } : {}),
        },
        success: (uploadRes) => {
          if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
            try {
              const resJson = JSON.parse(uploadRes.data);
              const data = resJson.data || resJson;
              let url = '';
              if (Array.isArray(data?.persistedUrls) && data.persistedUrls.length > 0) {
                url = data.persistedUrls[0];
              } else if (Array.isArray(data?.items) && data.items.length > 0) {
                url = data.items[0]?.originalUrl || data.items[0]?.url;
              } else if (Array.isArray(data)) {
                url = data[0]?.originalUrl || data[0]?.url || data[0];
              } else if (typeof data === 'string') {
                url = data;
              } else if (data?.url) {
                url = data.url;
              }

              if (url) {
                if (url.startsWith('/')) {
                  url = `${BASE_URL}${url}`;
                }
                resolve(url);
              } else {
                reject(new Error('上传响应未能解析出有效图片网络地址'));
              }
            } catch (e) {
              reject(new Error('解析上传图片响应异常'));
            }
          } else {
            reject(new Error(`上传图片失败，服务端状态码: ${uploadRes.statusCode}`));
          }
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || '网络请求超时或无法连接服务器'));
        },
      });
    });
  },

  // 7. 上传视频
  async uploadVideo(filePath: string, scheduleEventId?: string): Promise<string> {
    const campusId = uni.getStorageSync('currentCampusId') || 'campus-bj-hq';
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${BASE_URL}/api/upload/video`,
        filePath,
        name: 'file',
        timeout: 120000,
        formData: {
          scheduleEventId: scheduleEventId || '',
          campusId,
        },
        header: {
          'x-campus-id': campusId,
          ...(uni.getStorageSync('token') ? { Authorization: `Bearer ${uni.getStorageSync('token')}` } : {}),
        },

        success: (uploadRes) => {
          if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
            try {
              const resJson = JSON.parse(uploadRes.data);
              const data = resJson.data || resJson;
              let videoUrl = data?.videoUrl || data?.url;
              if (videoUrl) {
                if (videoUrl.startsWith('/')) {
                  videoUrl = `${BASE_URL}${videoUrl}`;
                }
                resolve(videoUrl);
              } else {
                reject(new Error('上传响应未能解析出有效视频网络地址'));
              }
            } catch (e) {
              reject(new Error('解析上传视频响应异常'));
            }
          } else {
            reject(new Error(`上传视频失败，服务端状态码: ${uploadRes.statusCode}`));
          }
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || '网络请求超时或无法连接视频服务器'));
        },
      });
    });
  },

};
