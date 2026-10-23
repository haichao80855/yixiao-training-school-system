import type {
  AttendanceStatus,
  FulfillmentMode,
  ReversalStrategy,
  ScheduleMetadata,
  SessionStudentItem,
  SessionEvaluationDraft,
  FulfillmentReceipt,
  FulfillmentReversalReceipt,
  FulfillmentCommitOptions,
  FulfillmentSession,
  FulfillmentWorkbenchSession,
  ClientLessonFulfillmentCoordinator,
  StudentFulfillmentOverride,
  StudentEvaluationDraft,
  QuickFulfillOptions,
  DraftSaveOptions,
} from './types';
import type { FulfillmentPort, DraftStoragePort } from './ports';
import { HttpFulfillmentAdapter } from './adapters/http-fulfillment.adapter';
import { UniStorageDraftAdapter, MemoryDraftStorageAdapter } from './adapters/storage-draft.adapter';
import { mediaPipeline } from '../../services/media-pipeline';

/**
 * 本地草稿是否已被服务端更新的写入覆盖 (草稿描述的是旧版本)：
 * - 单学员草稿：早于该学员课评的最近评定时间 (Web / 其他手机写入了该学员的课评)
 *   注意不能用课次发布时间：推送同班其他学员也会刷新课次发布时间，会误删本学员的草稿
 * - 整班草稿：早于课次课评最近一次发布时间
 */
function isDraftSupersededByServer(draftSavedAt: string | undefined, raw: any, targetStudent?: any): boolean {
  const savedAt = draftSavedAt ? Date.parse(draftSavedAt) : NaN;
  if (!Number.isFinite(savedAt)) return false;
  const serverTimes = (targetStudent
    ? [targetStudent?.evaluatedAt]
    : [raw?.evaluationDraft?.lastPublishedAt, raw?.evaluationSummary?.lastPublishedAt])
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((t) => Number.isFinite(t));
  return serverTimes.some((t) => t > savedAt);
}


interface StudentBaseline {
  status: AttendanceStatus;
  deductLessons: number;
  rating: number;
  comment?: string;
}

export class DefaultFulfillmentSession implements FulfillmentSession {
  readonly schedule: ScheduleMetadata;
  readonly students: SessionStudentItem[];
  readonly evaluation: SessionEvaluationDraft;
  private readonly baselineStudents: Map<string, StudentBaseline> = new Map();
  isDirty = false;
  isCommitted = false;

  constructor(
    schedule: ScheduleMetadata,
    students: SessionStudentItem[],
    evaluation: SessionEvaluationDraft,
    baseline: Map<string, StudentBaseline>,
    private readonly port: FulfillmentPort,
    private readonly storage: DraftStoragePort
  ) {
    this.schedule = schedule;
    this.students = students;
    this.evaluation = evaluation;
    this.baselineStudents = baseline;
  }

  toggleStudentAttendance(studentId: string): void {
    const student = this.students.find((s) => s.studentId === studentId);
    if (!student) return;

    const cycleMap: Record<AttendanceStatus, AttendanceStatus> = {
      present: 'leave',
      leave: 'absent',
      absent: 'present',
      late: 'present',
    };
    student.status = cycleMap[student.status] || 'present';
    student.deductLessons = student.status === 'present' ? 1 : 0;
    this.recalculateAnomaly(student);
    this.isDirty = true;
  }

  setStudentStatus(studentId: string, status: AttendanceStatus, deductLessons?: number): void {
    const student = this.students.find((s) => s.studentId === studentId);
    if (!student) return;

    student.status = status;
    student.deductLessons = deductLessons !== undefined ? deductLessons : (status === 'present' ? 1 : 0);
    this.recalculateAnomaly(student);
    this.isDirty = true;
  }

  batchMarkAttendance(status: AttendanceStatus): void {
    const defaultDeduct = status === 'present' ? 1 : 0;
    for (const student of this.students) {
      student.status = status;
      student.deductLessons = defaultDeduct;
      this.recalculateAnomaly(student);
    }
    this.isDirty = true;
  }

  updatePersonalizedComment(studentId: string, comment: string, rating?: number): void {
    const student = this.students.find((s) => s.studentId === studentId);
    if (!student) return;

    student.comment = comment;
    if (rating !== undefined) student.rating = rating;
    this.recalculateAnomaly(student);
    this.isDirty = true;
  }

  updateEvaluationDraft(patch: Partial<SessionEvaluationDraft>): void {
    Object.assign(this.evaluation, patch);
    this.isDirty = true;
  }

  async saveDraft(): Promise<void> {
    const draftPayload = {
      scheduleId: this.schedule.id,
      evaluation: this.evaluation,
      overrides: this.computeAnomalyOverrides(),
      savedAt: new Date().toISOString(),
    };
    this.storage.setDraft({ scheduleId: this.schedule.id }, draftPayload);

    // 兼顾单学员草稿：只写入该学员的专属评语 (comment)。
    // studyContent 是课次级大纲，不能放学员评语；班级公共照片 / 视频也不能写进学员草稿，
    // 否则打开【写课评】时会被当作该学员的专属媒体，推送后家长端出现两份
    for (const s of this.students) {
      if (s.comment) {
        const existing = this.storage.getDraft<any>({ scheduleId: this.schedule.id, studentId: s.studentId }) || {};
        this.storage.setDraft({ scheduleId: this.schedule.id, studentId: s.studentId }, {
          ...existing,
          scheduleId: this.schedule.id,
          studentId: s.studentId,
          comment: s.comment,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    this.isDirty = false;
  }

  async commit(options?: FulfillmentCommitOptions): Promise<FulfillmentReceipt> {
    if (this.isCommitted) {
      throw new Error(`当前排课 [${this.schedule.id}] 履约会话已完成落盘，禁止重复提交！`);
    }

    const anomalyOverrides = this.computeAnomalyOverrides();
    const mode: FulfillmentMode = options?.mode || 'FULL_SETTLE';
    const idempotencyKey = options?.idempotencyKey || `mp-ful-${this.schedule.id}-${Date.now()}`;

    const requestData: any = {
      scheduleEventId: this.schedule.id,
      mode,
      anomalyOverrides,
      // 保持与旧接口及测试断言兼容的 overrides 结构
      overrides: anomalyOverrides.map((a) => ({
        studentId: a.studentId,
        status: a.status,
        deductLessons: a.deductLessons,
        comment: a.personalizedComment,
      })),
      studyContentHtml: this.evaluation.studyContentHtml,
      teacherComment: this.evaluation.teacherComment,
      photoList: this.evaluation.photoList,
      videoUrl: this.evaluation.videoUrl,
      overallRating: this.evaluation.overallRating,
      lessonTitle: this.evaluation.lessonTitle,
      templateId: this.evaluation.templateId,
      templateName: this.evaluation.templateName,
      idempotencyKey,
    };

    const res = await this.port.commitFulfillment(requestData);

    // 履约成功后原子级联清除该排课全部草稿
    if (typeof this.storage.purgeScheduleDrafts === 'function') {
      this.storage.purgeScheduleDrafts(this.schedule.id);
    } else {
      this.storage.removeDraft({ scheduleId: this.schedule.id });
      this.storage.removeDraft(`eval_draft_${this.schedule.id}`);
      for (const s of this.students) {
        this.storage.removeDraft({ scheduleId: this.schedule.id, studentId: s.studentId });
        this.storage.removeDraft(`eval_draft_${this.schedule.id}_${s.studentId}`);
      }
    }

    this.isCommitted = true;
    this.isDirty = false;

    const presentCount = this.students.filter((s) => s.status === 'present').length;
    const leaveCount = this.students.filter((s) => s.status === 'leave').length;
    const absentCount = this.students.filter((s) => s.status === 'absent').length;
    const totalDeductedLessons = this.students.reduce((acc, s) => acc + s.deductLessons, 0);

    return {
      receiptId: res?.receiptId || `REC-FUL-${Date.now()}`,
      scheduleEventId: this.schedule.id,
      mode,
      completedAt: new Date().toISOString(),
      totalStudents: this.students.length,
      presentCount,
      leaveCount,
      absentCount,
      totalDeductedLessons,
      anomalyCount: anomalyOverrides.length,
      evaluationId: res?.evaluation?.id || res?.evaluationId,
      outboxCount: res?.outboxSummary?.enqueuedCount ?? presentCount,
    };
  }

  private recalculateAnomaly(student: SessionStudentItem): void {
    const base = this.baselineStudents.get(student.studentId);
    if (!base) {
      student.isAnomaly = student.status !== 'present' || student.deductLessons !== 1;
      return;
    }
    const hasStatusDiff = student.status !== base.status;
    const hasDeductDiff = student.deductLessons !== base.deductLessons;
    const hasCommentDiff = Boolean(student.comment && student.comment !== base.comment);
    const hasRatingDiff = student.rating !== base.rating;
    student.isAnomaly = hasStatusDiff || hasDeductDiff || hasCommentDiff || hasRatingDiff;
  }

  private computeAnomalyOverrides(): StudentFulfillmentOverride[] {
    const anomalies: StudentFulfillmentOverride[] = [];
    for (const s of this.students) {
      const base = this.baselineStudents.get(s.studentId);
      const isStatusChanged = base ? s.status !== base.status : s.status !== 'present';
      const isDeductChanged = base ? s.deductLessons !== base.deductLessons : s.deductLessons !== 1;
      const isCommentChanged = Boolean(s.comment && (base ? s.comment !== base.comment : true));
      const isRatingChanged = base ? s.rating !== base.rating : s.rating !== 5;

      if (isStatusChanged || isDeductChanged || isCommentChanged || isRatingChanged) {
        anomalies.push({
          studentId: s.studentId,
          status: s.status,
          deductLessons: s.deductLessons,
          personalizedComment: s.comment,
          rating: s.rating,
        });
      }
    }
    return anomalies;
  }
}

export class ClientLessonFulfillmentCoordinatorImpl implements ClientLessonFulfillmentCoordinator {
  private readonly debounceTimers: Map<string, any> = new Map();

  constructor(
    public readonly port: FulfillmentPort = new HttpFulfillmentAdapter(),
    public readonly storage: DraftStoragePort = new UniStorageDraftAdapter()
  ) {}

  static create(port?: FulfillmentPort, storage?: DraftStoragePort): ClientLessonFulfillmentCoordinator {
    return new ClientLessonFulfillmentCoordinatorImpl(port, storage);
  }

  /**
   * 1. 零心智极速履约 (90% 通途 Happy Path: quickFulfill / fulfill)
   */
  async quickFulfill(scheduleEventId: string, options?: QuickFulfillOptions): Promise<FulfillmentReceipt> {
    return this.fulfill(scheduleEventId, options);
  }

  async fulfill(scheduleEventId: string, options?: { idempotencyKey?: string }): Promise<FulfillmentReceipt> {
    const idempotencyKey = options?.idempotencyKey || `mp-ful-quick-${scheduleEventId}-${Date.now()}`;
    const payload = {
      scheduleEventId,
      mode: 'FULL_SETTLE',
      anomalyOverrides: [],
      overrides: [],
      idempotencyKey,
    };

    const res = await this.port.commitFulfillment(payload);

    // 一键原子出清该排课日程下的全部草稿
    if (typeof this.storage.purgeScheduleDrafts === 'function') {
      this.storage.purgeScheduleDrafts(scheduleEventId);
    } else {
      this.storage.removeDraft({ scheduleId: scheduleEventId });
      this.storage.removeDraft(`eval_draft_${scheduleEventId}`);
    }

    return {
      receiptId: res?.receiptId || `REC-FUL-${Date.now()}`,
      scheduleEventId,
      mode: 'FULL_SETTLE',
      completedAt: new Date().toISOString(),
      totalStudents: res?.summary?.totalStudents ?? (res?.students?.length ?? 0),
      presentCount: res?.summary?.defaultPresentCount ?? (res?.settlement?.presentCount ?? 0),
      leaveCount: res?.settlement?.leaveCount ?? 0,
      absentCount: res?.settlement?.absentCount ?? 0,
      totalDeductedLessons: res?.summary?.totalDeductedLessons ?? (res?.settlement?.totalDeductedLessons ?? 0),
      anomalyCount: 0,
      evaluationId: res?.evaluation?.id,
      outboxCount: res?.outboxSummary?.enqueuedCount ?? (res?.outbox?.enqueuedCount ?? 0),
    };
  }

  /**
   * 2. 加载交互式整班履约工作台会话 (openWorkbench / loadSession)
   */
  async openWorkbench(scheduleEventId: string): Promise<FulfillmentWorkbenchSession> {
    return this.loadSession(scheduleEventId);
  }

  /**
   * 3. 单学员随堂课评草稿智能水化 (hydrateStudentDraft)
   * 结合排课元数据、教研大纲标准、出勤基线与本地草稿，封闭 _baselineToken
   */
  async hydrateStudentDraft(scheduleEventId: string, studentId: string): Promise<StudentEvaluationDraft> {
    const raw = await this.port.fetchWorkbench(scheduleEventId);

    const schedule = raw?.schedule;
    const rawStudents: any[] = Array.isArray(raw?.students) ? raw.students : [];
    const targetStudent = rawStudents.find((s: any) => (s.studentId || s.id) === studentId);

    const baselineContent =
      raw?.evaluationDraft?.studyContentHtml ||
      raw?.evaluationSummary?.studyContent ||
      '本堂课学生专注投入，知识点掌握扎实。';
    const baselineRating = 5;

    // 读取本地存储草稿 (基于 DraftScope 强类型领域语义)
    // 草稿早于服务端最近一次发布 (Web / 其他手机 / 重新推送) 时作废，避免旧草稿覆盖已发布内容
    let singleDraft = this.storage.getDraft<any>({ scheduleId: scheduleEventId, studentId });
    if (singleDraft && isDraftSupersededByServer(singleDraft.updatedAt, raw, targetStudent || {})) {
      this.storage.removeDraft({ scheduleId: scheduleEventId, studentId });
      singleDraft = null;
    }
    let globalDraft = this.storage.getDraft<any>({ scheduleId: scheduleEventId });
    if (globalDraft && isDraftSupersededByServer(globalDraft.savedAt, raw)) {
      globalDraft = null;
    }
    const studentOverride = globalDraft?.overrides?.find((o: any) => o.studentId === studentId);

    const templateName =
      singleDraft?.templateName ||
      globalDraft?.evaluation?.templateName ||
      raw?.evaluationDraft?.templateName ||
      raw?.evaluationSummary?.templateName ||
      '通用课评模板';

    const templateId =
      singleDraft?.templateId ||
      globalDraft?.evaluation?.templateId ||
      raw?.evaluationDraft?.templateId ||
      raw?.evaluationSummary?.templateId ||
      'tpl-std';

    // 课程学习内容与知识点大纲（课次级）：本地草稿 (非空) > 服务端课次课评
    // 用 || 而非 ??：空白本地草稿 ('') 不能遮住服务端已有内容
    const studyContent =
      singleDraft?.studyContent ||
      raw?.evaluationDraft?.studyContentHtml ||
      raw?.evaluationSummary?.studyContent ||
      '';

    // 随堂特写评语（学员专属）：本地草稿 (非空) > 整班草稿覆写 > 服务端已落盘的学员评语。
    // 服务端评语无论是 Web 草稿还是已推送都是老师写下的真实内容，必须回显；
    // (不能以「已推送」为前提：isEvaluated 在小程序侧表示已推送，Web 保存的草稿评语会被丢掉)
    // 不再用模板 / 大纲预填
    const comment =
      singleDraft?.comment ||
      studentOverride?.personalizedComment ||
      targetStudent?.currentComment ||
      targetStudent?.comment ||
      '';

    const rating =
      singleDraft?.rating ??
      studentOverride?.rating ??
      targetStudent?.rating ??
      (targetStudent?.currentRating ? Number(targetStudent.currentRating) : undefined) ??
      raw?.evaluationDraft?.overallRating ??
      baselineRating;

    const isPersonalized = Boolean(
      targetStudent?.hasPersonalEvaluation ||
      targetStudent?.evaluatedAt ||
      (Array.isArray(targetStudent?.photos) && targetStudent.photos.length > 0) ||
      targetStudent?.videoUrl
    );

    let rawPhotos: string[] = [];
    if (Array.isArray(singleDraft?.uploadedPhotos)) {
      rawPhotos = singleDraft.uploadedPhotos;
    } else if (Array.isArray(singleDraft?.photos)) {
      rawPhotos = singleDraft.photos;
    } else if (isPersonalized) {
      // 专属课评下，严格以学员专属多媒体为准 (即使清空也保持清空，绝不倒灌公共大纲相册)
      rawPhotos = Array.isArray(targetStudent?.photos) ? targetStudent.photos : [];
    } else {
      // 尚未形成专属课评时，初始预填全班公共大纲相册
      rawPhotos = globalDraft?.evaluation?.photoList || raw?.evaluationDraft?.photoList || raw?.evaluationSummary?.photoList || [];
    }

    let rawVideo = '';
    if (singleDraft?.uploadedVideo !== undefined && singleDraft?.uploadedVideo !== null) {
      rawVideo = singleDraft.uploadedVideo;
    } else if (singleDraft?.videoUrl !== undefined && singleDraft?.videoUrl !== null) {
      rawVideo = singleDraft.videoUrl;
    } else if (isPersonalized) {
      // 专属课评下，严格以学员专属视频为准 (即使清空也保持清空，绝不倒灌公共大纲视频)
      rawVideo = targetStudent?.videoUrl || '';
    } else {
      // 尚未形成专属课评时，初始预填全班公共大纲视频
      rawVideo = globalDraft?.evaluation?.videoUrl || raw?.evaluationDraft?.videoUrl || raw?.evaluationSummary?.videoUrl || '';
    }

    const photos: string[] = rawPhotos
      .map((p) => mediaPipeline.canonicalizeUrl(p))
      .filter((p) => Boolean(p) && !p.startsWith('wxfile://'));

    const videoUrl: string = mediaPipeline.canonicalizeUrl(rawVideo);


    // 是否已评：只认服务端落盘状态，本地草稿 / 预填内容不算
    const isEvaluated = Boolean(targetStudent?.isEvaluated || targetStudent?.evaluated);

    const isModified = Boolean(
      Boolean(comment) ||
      (studyContent && studyContent !== baselineContent) ||
      rating !== baselineRating ||
      photos.length > 0 ||
      videoUrl ||
      isEvaluated
    );

    return {
      studentId,
      studentName: targetStudent?.name || targetStudent?.studentName || singleDraft?.studentName || '学员',
      className: schedule?.className || singleDraft?.className || '班级',
      courseName: schedule?.courseName || singleDraft?.courseName || '课程',
      lessonTitle: raw?.evaluationDraft?.lessonTitle || '随堂课评与素养分析',
      templateId,
      templateName,
      studyContent,
      comment,
      rating,
      photos,
      videoUrl,
      isModified,
      isEvaluated,
      _baselineToken: {
        baselineContent,
        baselineRating,
        studentId,
        scheduleId: scheduleEventId,
        hash: `base-${scheduleEventId}-${studentId}`,
      },
    };
  }

  /**
   * 4. 单学员课评草稿保存 (saveStudentDraft, 集成防抖引擎)
   */
  async saveStudentDraft(
    scheduleEventId: string,
    studentId: string,
    draft: Partial<StudentEvaluationDraft>,
    options?: DraftSaveOptions
  ): Promise<void> {
    const doSave = () => {
      const existing = this.storage.getDraft<any>({ scheduleId: scheduleEventId, studentId }) || {};
      const merged = {
        ...existing,
        scheduleId: scheduleEventId,
        studentId,
        studentName: draft.studentName || existing.studentName,
        className: draft.className || existing.className,
        courseName: draft.courseName || existing.courseName,
        templateId: draft.templateId || existing.templateId || 'tpl-std',
        templateName: draft.templateName || existing.templateName || '通用课评模板',
        studyContent: draft.studyContent ?? existing.studyContent ?? '',
        content: draft.studyContent ?? existing.content ?? '',
        comment: draft.comment ?? existing.comment ?? '',
        rating: draft.rating ?? existing.rating ?? 5,
        photos: draft.photos ?? existing.photos ?? [],
        uploadedPhotos: draft.photos ?? existing.uploadedPhotos ?? [],
        videoUrl: draft.videoUrl ?? existing.videoUrl ?? '',
        uploadedVideo: draft.videoUrl ?? existing.uploadedVideo ?? '',
        updatedAt: new Date().toISOString(),
      };
      this.storage.setDraft({ scheduleId: scheduleEventId, studentId }, merged);
    };

    if (options?.debounceMs && options.debounceMs > 0 && !options.immediate) {
      const timerKey = `${scheduleEventId}_${studentId}`;
      if (this.debounceTimers.has(timerKey)) {
        clearTimeout(this.debounceTimers.get(timerKey));
      }
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          doSave();
          this.debounceTimers.delete(timerKey);
          resolve();
        }, options.debounceMs);
        this.debounceTimers.set(timerKey, timer);
      });
    } else {
      doSave();
      return Promise.resolve();
    }
  }

  /**
   * 5. 单学员课评精准履约出站 (commitStudentEvaluation)
   * 差分推导异常学员覆写，模式设为 PUBLISH_EVALUATION，落盘后原子出清本地草稿
   */
  async commitStudentEvaluation(
    scheduleEventId: string,
    studentId: string,
    draft: Partial<StudentEvaluationDraft>
  ): Promise<FulfillmentReceipt> {
    // 两个字段分别落库：大纲 → 课次级 studyContent；特写评语 → 该学员 comment（不再互相顶替）
    const classContent = (draft.studyContent || '').trim();
    const personalComment = (draft.comment || '').trim();
    const currentRating = draft.rating ?? 5;
    const currentPhotos = draft.photos || [];
    const currentVideo = draft.videoUrl || '';

    const anomalyOverrides: StudentFulfillmentOverride[] = [
      {
        studentId,
        status: 'present',
        deductLessons: 1,
        personalizedComment: personalComment,
        rating: currentRating,
        photos: currentPhotos,
        videoUrl: currentVideo,
        isEvaluated: true,
      },
    ];

    const payload: any = {
      scheduleEventId,
      mode: 'PUBLISH_EVALUATION' as FulfillmentMode,
      targetStudentId: studentId,
      anomalyOverrides,
      overrides: anomalyOverrides.map((a) => ({
        studentId: a.studentId,
        status: a.status,
        deductLessons: a.deductLessons,
        comment: a.personalizedComment,
        photos: a.photos,
        videoUrl: a.videoUrl,
        isEvaluated: true,
      })),
      // 仅在填写了大纲时提交；服务端单学员更新时只更新大纲，不触碰班级公共媒体与评语
      ...(classContent ? { studyContentHtml: classContent } : {}),
      // 单学员课评：照片、视频、评语只写入该学员的 overrides，不作为课次公共内容提交
      // (否则同一份照片/视频会同时成为「专属」与「班级」媒体，家长端显示两份)
      photoList: [],
      overallRating: currentRating,
      templateName: draft.templateName || '通用课评模板',
      templateId: draft.templateId || 'tpl-std',
      idempotencyKey: `mp-ful-stu-${scheduleEventId}-${studentId}-${Date.now()}`,
    };

    const res = await this.port.commitFulfillment(payload);

    // 取消并清除该学员防抖定时器，防止滞后触发 doSave 将旧草稿重写回 Storage
    const timerKey = `${scheduleEventId}_${studentId}`;
    if (this.debounceTimers.has(timerKey)) {
      clearTimeout(this.debounceTimers.get(timerKey));
      this.debounceTimers.delete(timerKey);
    }

    // 原子清除该学员的草稿缓存
    this.storage.removeDraft({ scheduleId: scheduleEventId, studentId });

    return {
      receiptId: res?.receiptId || `REC-FUL-${Date.now()}`,
      scheduleEventId,
      mode: 'PUBLISH_EVALUATION',
      completedAt: new Date().toISOString(),
      totalStudents: 1,
      presentCount: 1,
      leaveCount: 0,
      absentCount: 0,
      totalDeductedLessons: 1,
      anomalyCount: 1,
      evaluationId: res?.evaluation?.id || res?.evaluationId,
      outboxCount: res?.outboxSummary?.enqueuedCount ?? 1,
    };
  }


  /**
   * 2. 加载交互式履约会话 (10% 异常定制与暂存工步)
   */
  async loadSession(scheduleEventId: string): Promise<FulfillmentSession> {
    const raw = await this.port.fetchWorkbench(scheduleEventId);

    const schedule: ScheduleMetadata = {
      id: raw?.schedule?.id || scheduleEventId,
      campusId: raw?.schedule?.campusId || 'campus-bj-hq',
      classId: raw?.schedule?.classId || '',
      className: raw?.schedule?.className || '班级',
      courseId: raw?.schedule?.courseId || '',
      courseName: raw?.schedule?.courseName || '课程',
      teacherId: raw?.schedule?.teacherId || '',
      teacherName: raw?.schedule?.teacherName || '讲师',
      advisorName: raw?.schedule?.advisorName || raw?.schedule?.teacherName || '教务',
      classroomId: raw?.schedule?.classroomId || '',
      classroomName: raw?.schedule?.classroomName || '教室',
      date: raw?.schedule?.date || '',
      startTime: raw?.schedule?.startTime || '',
      endTime: raw?.schedule?.endTime || '',
      timeRange: raw?.schedule?.timeRange || `${raw?.schedule?.date || ''} ${raw?.schedule?.startTime || ''}-${raw?.schedule?.endTime || ''}`.trim(),
      status: raw?.schedule?.status || 'scheduled',
      expectedCount: raw?.schedule?.expectedCount ?? (raw?.students?.length ?? 0),
      actualCount: raw?.schedule?.actualCount ?? (raw?.students ? raw.students.filter((s: any) => (s.recordedStatus || s.status) === 'present' || (s.recordedStatus || s.status) === 'late').length : 0),
      coursewareUrl: raw?.schedule?.coursewareUrl,
    };

    // 读取本地草稿（全局草稿或单人草稿，基于 DraftScope）；早于服务端最近一次发布的整班草稿作废
    let storedDraft = this.storage.getDraft<any>({ scheduleId: scheduleEventId });
    if (storedDraft && isDraftSupersededByServer(storedDraft.savedAt, raw)) {
      this.storage.removeDraft({ scheduleId: scheduleEventId });
      storedDraft = null;
    }

    const evaluation: SessionEvaluationDraft = {
      templateId: storedDraft?.evaluation?.templateId || raw?.evaluationDraft?.templateId || raw?.evaluationSummary?.templateId || 'tpl-std',
      templateName: storedDraft?.evaluation?.templateName || raw?.evaluationDraft?.templateName || raw?.evaluationSummary?.templateName || '通用课评模板',
      // 无内容时留空，由服务端沿用已有课评或教研模板；不再用占位文案顶替 (全部推送时会覆盖老师写好的内容)
      lessonTitle: storedDraft?.evaluation?.lessonTitle || raw?.evaluationDraft?.lessonTitle || raw?.evaluationSummary?.lessonTitle || '',
      studyContentHtml: storedDraft?.evaluation?.studyContentHtml || raw?.evaluationDraft?.studyContentHtml || raw?.evaluationSummary?.studyContent || '',
      teacherComment: storedDraft?.evaluation?.teacherComment || raw?.evaluationDraft?.teacherComment || raw?.evaluationSummary?.teacherComment || '',
      overallRating: storedDraft?.evaluation?.overallRating ?? 5.0,
      photoList: storedDraft?.evaluation?.photoList || raw?.evaluationDraft?.photoList || raw?.evaluationSummary?.photoList || [],
      videoUrl: storedDraft?.evaluation?.videoUrl || raw?.evaluationDraft?.videoUrl || raw?.evaluationSummary?.videoUrl,
    };

    const rawStudents: any[] = Array.isArray(raw?.students) ? raw.students : [];
    const students: SessionStudentItem[] = [];
    const baseline = new Map<string, StudentBaseline>();

    for (const s of rawStudents) {
      const studentId = s.studentId || s.id;
      const defaultStatus: AttendanceStatus = s.defaultStatus || 'present';
      const defaultDeduct = s.defaultDeductLessons ?? (defaultStatus === 'present' ? 1 : 0);

      // 记录服务端不可变基线
      baseline.set(studentId, {
        status: defaultStatus,
        deductLessons: defaultDeduct,
        rating: 5,
        comment: '',
      });

      // 检查草稿中是否有单人生效覆写
      const draftedOverride = storedDraft?.overrides?.find((o: any) => o.studentId === studentId);
      const singleDraft = this.storage.getDraft<any>({ scheduleId: scheduleEventId, studentId });

      const status: AttendanceStatus = draftedOverride?.status || s.status || s.recordedStatus || defaultStatus;
      const deductLessons: number = draftedOverride?.deductLessons ?? s.deductLessons ?? defaultDeduct;
      // 学员评语只取服务端 / 全班履约草稿覆写；单学员本地草稿不参与（未推送前不算已评）
      const comment: string = draftedOverride?.personalizedComment || s.currentComment || s.comment || '';
      const rating: number = draftedOverride?.rating || (s.currentRating !== undefined ? Number(s.currentRating) : (s.rating !== undefined ? Number(s.rating) : 5));

      const isAnomaly = status !== defaultStatus || deductLessons !== defaultDeduct || Boolean(comment) || rating !== 5;

      const studentPhotos: string[] = Array.isArray(s.photos)
        ? s.photos
        : typeof s.photos === 'string'
          ? JSON.parse(s.photos || '[]')
          : (singleDraft?.photos || []);
      const studentVideo: string | undefined = s.videoUrl || singleDraft?.videoUrl || undefined;

      // 是否已评只认服务端落盘状态（LessonEvaluationStudentItem.isEvaluated）
      const isStudentEvaluated = Boolean(s.isEvaluated || s.evaluated);

      students.push({
        studentId,
        studentNo: s.studentNo || '',
        name: s.name || s.studentName || '学员',
        phone: s.phone,
        avatar: s.avatar,
        status,
        deductLessons,
        remainingLessons: s.remainingLessons ?? 0,
        rating,
        comment,
        isAnomaly,
        isWechatBound: Boolean(s.wechatOpenId || s.isWechatBound),
        isEvaluated: isStudentEvaluated,
        isExempt: Boolean(s.isExempt),
        evaluatedAt: s.evaluatedAt,
        evaluatedSource: s.evaluatedSource || 'web',
        photos: studentPhotos,
        videoUrl: studentVideo,
      });
    }

    return new DefaultFulfillmentSession(
      schedule,
      students,
      evaluation,
      baseline,
      this.port,
      this.storage
    );
  }

  /**
   * 3. 随堂课评/考勤本地草稿原子暂存
   */
  async saveDraft(scheduleEventId: string, draft: Partial<SessionEvaluationDraft>): Promise<void> {
    const existing = this.storage.getDraft<any>({ scheduleId: scheduleEventId }) || {};
    const merged = {
      ...existing,
      scheduleId: scheduleEventId,
      evaluation: {
        ...(existing.evaluation || {}),
        ...draft,
      },
      updatedAt: new Date().toISOString(),
    };
    this.storage.setDraft({ scheduleId: scheduleEventId }, merged);
  }

  /**
   * 4. 级联安全反结课冲正与重开
   */
  async reverse(scheduleEventId: string, reason: string, strategy: ReversalStrategy = 'FULL_ROLLBACK'): Promise<FulfillmentReversalReceipt> {
    const res = await this.port.reverseFulfillment({
      scheduleEventId,
      reason: reason || '教务冲正',
      strategy,
    });

    return {
      receiptId: res?.receiptId || `REC-REV-${Date.now()}`,
      scheduleEventId,
      strategy,
      reversedAt: new Date().toISOString(),
      refundedLessons: res?.refundedLessons ?? 0,
      cancelledOutboxCount: res?.cancelledOutboxCount ?? 0,
    };
  }
}

export const fulfillmentCoordinator = new ClientLessonFulfillmentCoordinatorImpl();
(fulfillmentCoordinator as any).createCoordinator = (
  port?: FulfillmentPort,
  storage?: DraftStoragePort
) => new ClientLessonFulfillmentCoordinatorImpl(port, storage);
(fulfillmentCoordinator as any).CoordinatorClass = ClientLessonFulfillmentCoordinatorImpl;
(fulfillmentCoordinator as any).DefaultSessionClass = DefaultFulfillmentSession;
(fulfillmentCoordinator as any).UniStorageDraftAdapter = UniStorageDraftAdapter;
(fulfillmentCoordinator as any).MemoryDraftStorageAdapter = MemoryDraftStorageAdapter;
