import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxNotificationDispatcher } from './notification/outbox-notification.dispatcher';
import {
  PrepareFulfillmentQuery,
  FulfillmentWorkbenchView,
  FulfillmentStudentView,
  FulfillLessonCommand,
  FulfillmentReceipt,
  ReverseFulfillmentCommand,
  FulfillmentReversalReceipt,
  CampusScopeContext,
  CampusScopeMismatchException,
  ScheduleCancelledException,
  RefundLockedException,
  AttendanceStatus,
} from './lesson-fulfillment.types';

// 预设默认课程知识点与评语框架 (智能水化默认值)
const DEFAULT_SYLLABUS_TEMPLATES: Record<string, { title: string; content: string; comment: string }> = {
  scratch: {
    title: '图形化创意交互与物理碰撞引擎',
    content: `<p><strong>【核心素养与知识点】</strong></p><ul><li>1. 掌握克隆体机制（当作为克隆体启动时、删除此克隆体）及生命周期管理</li><li>2. 私有变量与全局变量作用域在多角色粒子系统中的应用</li><li>3. 广播机制（Broadcast & Receive）联动与边缘碰撞反弹算法</li><li>4. 逻辑条件判断嵌套与坐标映射计算</li></ul>`,
    comment: '本堂课思维敏锐，能主动思考多角色并发下的广播时序，在完成主线避障任务后，还为作品增添了个性化音效与分数榜，表现非常优秀！',
  },
  python: {
    title: 'Python算法进阶与数据结构应用',
    content: `<p><strong>【核心素养与知识点】</strong></p><ul><li>1. 列表推导式（List Comprehension）的优雅表达与内存时空权衡</li><li>2. 二分查找边界条件指针移动与递归展开</li><li>3. 函数参数解构与异常保护（try-except-finally）规范</li></ul>`,
    comment: '对边界条件的处理非常扎实，现场盲写算法一次性通过全部测试用例，展现出优秀的工程严谨度与计算思维！',
  },
  robotics: {
    title: '单片机传感器联动与差速转向避障',
    content: `<p><strong>【核心素养与知识点】</strong></p><ul><li>1. 数字引脚与模拟引脚输入电平读取及电压阈值校准</li><li>2. 红外避障光电传感器抗环境光干扰调试</li><li>3. 左右电机差速 PWM 占空比调速算法，实现自主避障巡线</li></ul>`,
    comment: '动手接线规范沉稳，能利用示波器与串口打印快速排查虚焊与接触不良，工程排障能力表现突出！',
  },
  default: {
    title: '综合科创随堂实践与计算思维进阶',
    content: `<p><strong>【随堂核心知识点】</strong></p><ul><li>1. 本课核心算法结构与逻辑分支嵌套实现</li><li>2. 软硬件系统调试与异常边界排查流程</li><li>3. 课后拓展挑战任务布置与代码工程规范</li></ul>`,
    comment: '随堂专注度高，动手探索与互动表达积极，能够独立排查代码逻辑 Bug，综合素养表现优秀！',
  },
};

@Injectable()
export class LessonFulfillmentCoordinator {
  private readonly logger = new Logger(LessonFulfillmentCoordinator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxDispatcher: OutboxNotificationDispatcher,
  ) {}

  /**
   * 1. 智能水化结课履约工作台全景 (prepareFulfillmentWorkbench)
   * 教师点击结课按钮即刻获取：
   * - 班级在读花名册（默认全部到课 present，预置 1 课时，预置 5 星评级与默认评语）
   * - 课程重难点大纲富文本抽取
   * - 家长微信绑定全景透视
   * 达成 90% 课堂的 Zero-ceremony Happy Path（零心智负担直接提交）
   */
  async prepareFulfillmentWorkbench(
    query: PrepareFulfillmentQuery,
    scope?: CampusScopeContext,
  ): Promise<FulfillmentWorkbenchView> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: query.scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
            studentPackages: {
              where: { status: 'active' },
              include: {
                student: true,
              },
            },
          },
        },
        classroom: true,
        teacher: true,
        evaluation: {
          include: {
            studentItems: true,
          },
        },
        attendances: {
          where: { isReversed: false },
          include: {
            student: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ID: ${query.scheduleEventId}`);
    }

    // 校区隔离校验
    if (query.campusId && schedule.campusId !== query.campusId) {
      throw new CampusScopeMismatchException(`查询校区 [${query.campusId}] 与排课实际校区 [${schedule.campusId}] 不匹配`);
    }
    const effectiveCampusId = scope?.targetCampusId;
    if (effectiveCampusId && !scope?.isSuperAdmin && schedule.campusId !== effectiveCampusId) {
      throw new CampusScopeMismatchException();
    }

    if (schedule.status === 'cancelled') {
      throw new ScheduleCancelledException(schedule.id);
    }

    const cls = schedule.class;
    const course = cls.course;
    const subject = (course?.subject || 'scratch').toLowerCase();
    const fallbackTemplate = DEFAULT_SYLLABUS_TEMPLATES[subject] || DEFAULT_SYLLABUS_TEMPLATES.default;

    // 建立已有考勤与已有课评学员映射
    const attendanceMap = new Map(schedule.attendances.map((a) => [a.studentId, a]));
    const studentItemMap = new Map(
      (schedule.evaluation?.studentItems || []).map((item) => [item.studentId, item]),
    );

    // 水化学员花名册
    let wechatBoundCount = 0;
    let wechatUnboundCount = 0;
    const students: FulfillmentStudentView[] = [];

    // 收集所有候选学员：优先取当前班级激活课包中的在读学员，合并已有考勤学员
    const studentPackageMap = new Map<string, any>();
    for (const pkg of cls.studentPackages) {
      studentPackageMap.set(pkg.studentId, pkg);
    }

    // 确定唯一学员集合
    const candidateStudentIds = Array.from(
      new Set([
        ...cls.studentPackages.map((p) => p.studentId),
        ...schedule.attendances.map((a) => a.studentId),
      ]),
    );

    for (const studentId of candidateStudentIds) {
      const recorded = attendanceMap.get(studentId);
      const pkg = studentPackageMap.get(studentId);
      const student = pkg?.student || recorded?.student;
      if (!student) continue;

      const isBound = Boolean(student.wechatOpenId);
      if (isBound) wechatBoundCount++;
      else wechatUnboundCount++;

      const isLowBalance = (pkg?.remainingLessons ?? 0) <= 3;
      const evalItem = studentItemMap.get(studentId);

      // 默认到课、扣 1 课时、默认 5 星评级
      const recordedStatus = recorded?.status as AttendanceStatus | undefined;
      const defaultStatus: AttendanceStatus = recordedStatus || 'present';
      const defaultDeductLessons = recorded ? recorded.deductLessons : 1;
      const defaultRating = evalItem?.rating || 5.0;

      students.push({
        studentId: student.id,
        studentNo: student.studentNo,
        studentName: student.name,
        phone: student.phone,
        gender: student.gender || undefined,
        packageId: pkg?.id,
        remainingLessons: pkg?.remainingLessons ?? 0,
        bonusLessons: pkg?.bonusLessons ?? 0,
        totalLessons: pkg?.totalLessons ?? 0,
        isLowBalance,
        wechatOpenId: student.wechatOpenId,
        isWechatBound: isBound,
        defaultStatus,
        defaultDeductLessons,
        defaultRating,
        isRecorded: !!recorded,
        recordedStatus,
        currentComment: evalItem?.comment || recorded?.comment || '',
        currentRating: evalItem?.rating || recorded?.rating || 5.0,
      });
    }

    const existingEval = schedule.evaluation;
    let photoList: string[] = [];
    if (existingEval?.photoList) {
      try {
        photoList = JSON.parse(existingEval.photoList);
      } catch {
        photoList = [];
      }
    }

    const defaultPresentCount = students.filter(
      (s) => (s.recordedStatus || s.defaultStatus) === 'present' || (s.recordedStatus || s.defaultStatus) === 'late',
    ).length;
    const estimatedDeductLessons = students.reduce(
      (sum, s) => sum + (s.recordedStatus ? s.defaultDeductLessons : 1),
      0,
    );

    return {
      schedule: {
        id: schedule.id,
        date: schedule.date,
        timeSlot: `${schedule.startTime} - ${schedule.endTime}`,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        classId: cls.id,
        className: cls.name,
        classroomId: schedule.classroomId,
        classroomName: schedule.classroom?.name || '指定教室',
        courseId: course?.id || '',
        courseName: course?.name || '综合精品课',
        subject,
        teacherId: schedule.teacherId,
        teacherName: schedule.teacher?.realName || '主教讲师',
        status: schedule.status,
        canSettle: schedule.status !== 'completed',
      },
      evaluationDraft: {
        isExisting: !!existingEval,
        evaluationStatus: existingEval?.status,
        templateId: existingEval?.templateId || query.preferredTemplateId || 'tmpl-common',
        templateName:
          existingEval?.templateName ||
          (subject === 'python'
            ? 'Python高阶代码进阶模板'
            : subject === 'robotics'
              ? '单片机硬件科创课评模板'
              : '通用课评模板'),
        lessonTitle: existingEval?.lessonTitle || `${cls.name} - ${fallbackTemplate.title}`,
        studyContentHtml: existingEval?.studyContent || fallbackTemplate.content,
        overallRating: existingEval?.overallRating ?? 5.0,
        teacherComment: existingEval?.teacherComment || fallbackTemplate.comment,
        voiceUrl: existingEval?.voiceUrl || undefined,
        voiceDuration: existingEval?.voiceDuration || 0,
        videoUrl: existingEval?.videoUrl || undefined,
        photoList,
        aiPolished: existingEval?.aiPolished ?? false,
        lastPublishedAt: existingEval?.publishedAt ? existingEval.publishedAt.toISOString() : undefined,
        revisionNumber: existingEval?.currentRevision || 0,
      },
      students,
      summary: {
        totalStudents: students.length,
        defaultPresentCount,
        wechatBoundCount,
        wechatUnboundCount,
        estimatedDeductLessons,
      },
    };
  }

  /**
   * 2. 一键全量结课履约 (fulfillLesson)
   * 单一数据库物理原子事务 (ACID)：
   * - 随堂消课 (Regular-First 正课优先扣除与课包余额更新)
   * - 考勤落盘与学情雷达双向渗透 (AttendanceRecord)
   * - 课评聚合根持久化 (LessonEvaluation + 单学员特写)
   * - 不可变版本快照归档与 SHA-256 数据指纹 (LessonEvaluationRevision)
   * - 事务性出站信箱灌装 (LessonEvaluationOutbox)
   * - 排课日程跃迁为 completed
   */
  async fulfillLesson(
    command: FulfillLessonCommand,
    scope?: CampusScopeContext,
  ): Promise<FulfillmentReceipt> {
    const mode = command.mode || 'FULL_SETTLE';

    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: command.scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
            studentPackages: {
              where: { status: 'active' },
              include: {
                student: true,
              },
            },
          },
        },
        classroom: true,
        teacher: true,
        evaluation: true,
        attendances: {
          where: { isReversed: false },
          include: {
            student: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ID: ${command.scheduleEventId}`);
    }

    // 校区隔离校验
    if (command.campusId && schedule.campusId !== command.campusId) {
      throw new CampusScopeMismatchException(`操作校区 [${command.campusId}] 与排课实际校区 [${schedule.campusId}] 不匹配`);
    }
    const effectiveCampusId = scope?.targetCampusId;
    if (effectiveCampusId && !scope?.isSuperAdmin && schedule.campusId !== effectiveCampusId) {
      throw new CampusScopeMismatchException();
    }

    if (schedule.status === 'cancelled') {
      throw new ScheduleCancelledException(schedule.id);
    }

    // 状态防重保护
    if (schedule.status === 'completed' && mode !== 'PUBLISH_EVALUATION') {
      if (
        command.idempotencyKey &&
        schedule.evaluation?.idempotencyKey === command.idempotencyKey
      ) {
        this.logger.warn(`命中幂等键重放: ${command.idempotencyKey}`);
      } else {
        throw new BadRequestException('该排课日程已结课，如需变更请先执行反结课冲正');
      }
    }

    const operator = command.operatorName || scope?.operatorName || '任课教师';
    const cls = schedule.class;
    const course = cls.course;
    const subject = (course?.subject || 'scratch').toLowerCase();
    const fallbackTemplate = DEFAULT_SYLLABUS_TEMPLATES[subject] || DEFAULT_SYLLABUS_TEMPLATES.default;

    // 提取异常学员覆写增量映射
    const overrideMap = new Map(
      (command.anomalyOverrides || []).map((ov) => [ov.studentId, ov]),
    );

    // 准备全员名单：以班级在读激活课包学员为主，合并已有考勤学员
    const studentPackageMap = new Map<string, any>();
    for (const pkg of cls.studentPackages) {
      studentPackageMap.set(pkg.studentId, pkg);
    }

    const candidateStudentIds = Array.from(
      new Set([
        ...cls.studentPackages.map((p) => p.studentId),
        ...schedule.attendances.map((a) => a.studentId),
      ]),
    );

    // 课评图文多媒体组装
    const lessonTitle = command.lessonTitle || `${cls.name} - ${fallbackTemplate.title}`;
    const studyContentHtml = command.studyContentHtml || fallbackTemplate.content;
    const overallRating = command.overallRating ?? 5.0;
    const teacherComment = command.teacherComment || fallbackTemplate.comment;
    const photoListJson = JSON.stringify(command.photoList || []);

    return this.prisma.$transaction(async (tx) => {
      const settlementDetails: FulfillmentReceipt['settlement']['details'] = [];
      let totalDeductedLessons = 0;
      let regularLessonsBurned = 0;
      let bonusLessonsBurned = 0;
      let presentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      // ----------------------------------------------------------------------
      // 步骤 1 & 2: 点名消课与正课优先扣减 (FULL_SETTLE 或 ATTENDANCE_ONLY 模式)
      // ----------------------------------------------------------------------
      if (mode === 'FULL_SETTLE' || mode === 'ATTENDANCE_ONLY') {
        for (const studentId of candidateStudentIds) {
          const override = overrideMap.get(studentId);
          const studentStatus: AttendanceStatus = override?.status || 'present';

          if (studentStatus === 'present') presentCount++;
          else if (studentStatus === 'late') lateCount++;
          else if (studentStatus === 'leave') leaveCount++;
          else if (studentStatus === 'absent') absentCount++;

          const isDeductible = studentStatus === 'present' || studentStatus === 'late';
          const requestedDeduct =
            override?.deductLessons !== undefined ? Number(override.deductLessons) : 1;
          const actualDeduct = isDeductible ? requestedDeduct : 0;

          let targetPkg: any = null;
          let itemRegularBurned = 0;
          let itemBonusBurned = 0;

          if (actualDeduct > 0) {
            targetPkg = studentPackageMap.get(studentId);
            if (!targetPkg) {
              targetPkg = await tx.studentCoursePackage.findFirst({
                where: {
                  studentId,
                  courseId: cls.courseId,
                  status: 'active',
                },
                orderBy: { createdAt: 'asc' },
              });
            }

            if (targetPkg) {
              // 盛通资产风控规则：正课优先消耗算法 (Regular-First)
              const regularRemaining = Math.max(0, targetPkg.remainingLessons - targetPkg.bonusLessons);
              if (regularRemaining >= actualDeduct) {
                itemRegularBurned = actualDeduct;
                itemBonusBurned = 0;
              } else {
                itemRegularBurned = regularRemaining;
                itemBonusBurned = actualDeduct - regularRemaining;
              }

              const updatedPkg = await tx.studentCoursePackage.update({
                where: { id: targetPkg.id },
                data: {
                  remainingLessons: { decrement: actualDeduct },
                  consumedLessons: { increment: actualDeduct },
                  status: targetPkg.remainingLessons - actualDeduct <= 0 ? 'completed' : 'active',
                },
              });

              totalDeductedLessons += actualDeduct;
              regularLessonsBurned += itemRegularBurned;
              bonusLessonsBurned += itemBonusBurned;

              settlementDetails.push({
                studentId,
                packageId: targetPkg.id,
                deductLessons: actualDeduct,
                regularBurned: itemRegularBurned,
                bonusBurned: itemBonusBurned,
                remainingAfter: updatedPkg.remainingLessons,
              });
            }
          }

          // 计算星级与评分等第归一化折算
          const studentRating = override?.rating ?? overallRating;
          let score = 95;
          let ratingStr = 'A+';
          if (studentRating >= 4.8) {
            score = 98;
            ratingStr = 'A+';
          } else if (studentRating >= 4.3) {
            score = 92;
            ratingStr = 'A+';
          } else if (studentRating >= 3.8) {
            score = 88;
            ratingStr = 'A';
          } else if (studentRating >= 3.3) {
            score = 80;
            ratingStr = 'B+';
          } else {
            score = 72;
            ratingStr = 'B';
          }

          const studentComment = override?.personalizedComment || teacherComment;

          // Upsert AttendanceRecord
          const existingAtt = await tx.attendanceRecord.findFirst({
            where: {
              scheduleEventId: schedule.id,
              studentId,
              isReversed: false,
            },
          });

          if (existingAtt) {
            await tx.attendanceRecord.update({
              where: { id: existingAtt.id },
              data: {
                packageId: targetPkg ? targetPkg.id : existingAtt.packageId,
                status: studentStatus,
                deductLessons: actualDeduct,
                regularBurned: itemRegularBurned,
                bonusBurned: itemBonusBurned,
                comment: studentComment,
                score,
                rating: ratingStr,
                operator,
              },
            });
          } else {
            await tx.attendanceRecord.create({
              data: {
                scheduleEventId: schedule.id,
                studentId,
                packageId: targetPkg ? targetPkg.id : null,
                status: studentStatus,
                deductLessons: actualDeduct,
                regularBurned: itemRegularBurned,
                bonusBurned: itemBonusBurned,
                comment: studentComment,
                score,
                rating: ratingStr,
                operator,
                isReversed: false,
              },
            });
          }
        }
      }

      // ----------------------------------------------------------------------
      // 步骤 3, 4, 5: 课评聚合根落盘、不可变快照与出站信箱灌装 (FULL_SETTLE 或 PUBLISH_EVALUATION 模式)
      // ----------------------------------------------------------------------
      let evalRecordResult: any = null;
      let revisionNumber = 0;
      let fingerprint = '';
      let outboxEnqueuedCount = 0;
      let wechatSkippedCount = 0;
      const dispatchStrategy = command.dispatchStrategy || 'ATTENDED_ONLY';

      if (mode === 'FULL_SETTLE' || mode === 'PUBLISH_EVALUATION') {
        const existingEval = await tx.lessonEvaluation.findUnique({
          where: { scheduleEventId: schedule.id },
        });

        revisionNumber = (existingEval?.currentRevision || 0) + 1;

        evalRecordResult = await tx.lessonEvaluation.upsert({
          where: { scheduleEventId: schedule.id },
          update: {
            lessonTitle,
            templateId: command.templateId || 'tmpl-common',
            templateName: command.templateName || '通用课评模板',
            studyContent: studyContentHtml,
            overallRating,
            teacherComment,
            voiceUrl: command.voiceUrl || null,
            voiceDuration: command.voiceDuration || 0,
            videoUrl: command.videoUrl || null,
            photoList: photoListJson,
            aiPolished: command.aiPolished ?? false,
            status: 'published',
            currentRevision: revisionNumber,
            publishedAt: new Date(),
            idempotencyKey: command.idempotencyKey || null,
          },
          create: {
            campusId: schedule.campusId,
            scheduleEventId: schedule.id,
            classId: schedule.classId,
            teacherId: schedule.teacherId,
            lessonTitle,
            templateId: command.templateId || 'tmpl-common',
            templateName: command.templateName || '通用课评模板',
            studyContent: studyContentHtml,
            overallRating,
            teacherComment,
            voiceUrl: command.voiceUrl || null,
            voiceDuration: command.voiceDuration || 0,
            videoUrl: command.videoUrl || null,
            photoList: photoListJson,
            aiPolished: command.aiPolished ?? false,
            status: 'published',
            currentRevision: revisionNumber,
            publishedAt: new Date(),
            idempotencyKey: command.idempotencyKey || null,
          },
        });

        // 落盘单学员特写项
        for (const [studentId, ov] of overrideMap.entries()) {
          await tx.lessonEvaluationStudentItem.upsert({
            where: {
              evaluationId_studentId: {
                evaluationId: evalRecordResult.id,
                studentId,
              },
            },
            update: {
              rating: ov.rating,
              comment: ov.personalizedComment,
              performanceTag: ov.performanceTag,
            },
            create: {
              evaluationId: evalRecordResult.id,
              studentId,
              rating: ov.rating,
              comment: ov.personalizedComment,
              performanceTag: ov.performanceTag,
            },
          });
        }

        // 不可变快照归档并计算 SHA-256 数据指纹
        const snapshotObj = {
          evaluationId: evalRecordResult.id,
          scheduleEventId: schedule.id,
          className: cls.name,
          lessonTitle,
          studyContent: studyContentHtml,
          overallRating,
          teacherComment,
          photoList: command.photoList || [],
          revisionNumber,
          publishedBy: operator,
          timestamp: new Date().toISOString(),
        };

        fingerprint = crypto
          .createHash('sha256')
          .update(JSON.stringify(snapshotObj, Object.keys(snapshotObj).sort()))
          .digest('hex');

        await tx.lessonEvaluationRevision.create({
          data: {
            evaluationId: evalRecordResult.id,
            revisionNumber,
            snapshotData: JSON.stringify(snapshotObj),
            revisionReason: revisionNumber === 1 ? '随堂一键结课履约发布' : '结课课评修订更新',
            fingerprint,
            publishedBy: operator,
          },
        });

        // 重新获取最新考勤记录灌装出站信箱
        const latestAttendances = await tx.attendanceRecord.findMany({
          where: { scheduleEventId: schedule.id, isReversed: false },
          include: { student: true },
        });

        const targetAttendances = latestAttendances.filter((att) => {
          if (dispatchStrategy === 'ATTENDED_ONLY') {
            return att.status === 'present' || att.status === 'late';
          }
          if (dispatchStrategy === 'NONE') {
            return false;
          }
          return true;
        });

        for (const att of targetAttendances) {
          const st = att.student;
          const ov = overrideMap.get(st.id);
          const stRating = ov?.rating ?? overallRating;
          const stComment = ov?.personalizedComment || teacherComment;

          const outboxPayload = {
            evaluationId: evalRecordResult.id,
            revisionNumber,
            studentId: st.id,
            studentName: st.name,
            parentPhone: st.phone,
            className: cls.name,
            courseName: course?.name || '综合课程',
            lessonTitle,
            rating: stRating,
            ratingText: `${stRating} 星卓越表现`,
            teacherComment: stComment,
            photoCount: (command.photoList || []).length,
            hasVoice: Boolean(command.voiceUrl),
            hasVideo: Boolean(command.videoUrl),
            publishedAt: new Date().toISOString(),
          };

          const outboxIdempotencyKey = `outbox_${evalRecordResult.id}_rev${revisionNumber}_st_${st.id}`;

          if (st.wechatOpenId) {
            await tx.lessonEvaluationOutbox.create({
              data: {
                campusId: schedule.campusId,
                evaluationId: evalRecordResult.id,
                revisionNumber,
                studentId: st.id,
                channel: 'wechat_template',
                status: 'pending',
                idempotencyKey: outboxIdempotencyKey,
                recipientTarget: st.wechatOpenId,
                payload: JSON.stringify(outboxPayload),
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: new Date(),
              },
            });
            outboxEnqueuedCount++;
          } else {
            wechatSkippedCount++;
            await tx.lessonEvaluationOutbox.create({
              data: {
                campusId: schedule.campusId,
                evaluationId: evalRecordResult.id,
                revisionNumber,
                studentId: st.id,
                channel: 'none',
                status: 'skipped_no_openid',
                idempotencyKey: outboxIdempotencyKey,
                recipientTarget: st.phone,
                payload: JSON.stringify(outboxPayload),
                retryCount: 0,
                maxRetries: 0,
                lastError: '家长未绑定微信号',
              },
            });
          }
        }
      }

      // ----------------------------------------------------------------------
      // 步骤 6: 更新排课日程状态为 completed (盛通绿色标签)
      // ----------------------------------------------------------------------
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'completed',
          semanticType: 'completed',
        },
      });

      const receiptId = `REC-FLM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      return {
        receiptId,
        scheduleEventId: schedule.id,
        mode,
        completedAt: new Date().toISOString(),
        operator,
        totalStudents: candidateStudentIds.length,
        settlement: {
          totalDeductedLessons,
          regularBurned: regularLessonsBurned,
          bonusBurned: bonusLessonsBurned,
          presentCount,
          lateCount,
          leaveCount,
          absentCount,
          details: settlementDetails,
        },
        evaluation: evalRecordResult
          ? {
              evaluationId: evalRecordResult.id,
              revisionNumber,
              status: 'published',
              syncedAttendanceCount: candidateStudentIds.length,
              fingerprint,
            }
          : null,
        outbox:
          mode === 'FULL_SETTLE' || mode === 'PUBLISH_EVALUATION'
            ? {
                enqueuedCount: outboxEnqueuedCount,
                skippedCount: wechatSkippedCount,
                strategy: dispatchStrategy,
              }
            : null,
        message:
          mode === 'FULL_SETTLE'
            ? `随堂结课履约成功！实消 ${totalDeductedLessons} 课时，同步课评与学情档案，排入 ${outboxEnqueuedCount} 条微信通知。`
            : mode === 'ATTENDANCE_ONLY'
              ? `随堂点名消课成功！已结算 ${candidateStudentIds.length} 名学员，扣减 ${totalDeductedLessons} 课时。`
              : `随堂课评补录发布成功！已排入 ${outboxEnqueuedCount} 条微信通知。`,
      };
    }).then((receipt) => {
      // 事务提交后异步触发微信出站信箱派发
      if (receipt.evaluation?.evaluationId && (receipt.outbox?.enqueuedCount || 0) > 0) {
        this.outboxDispatcher.triggerImmediateDispatch(receipt.evaluation.evaluationId);
      }
      return receipt;
    });
  }

  /**
   * 3. 统一级联反结课冲正 (reverseFulfillment)
   * 彻底消除幽灵课评与幽灵通知：
   * - FULL_ROLLBACK: 课包课时原路退还 + ACB 财务防腐屏障强阻断 + 考勤冲正 + 课评作废 (revoked) + 在途信箱微信通知作废 (cancelled)
   * - REOPEN_EVALUATION: 仅作废旧课评与通知、重置考勤评语，保持课时扣减财务零扰动，支持教师无痛重写
   */
  async reverseFulfillment(
    command: ReverseFulfillmentCommand,
    scope?: CampusScopeContext,
  ): Promise<FulfillmentReversalReceipt> {
    const strategy = command.strategy || 'FULL_ROLLBACK';

    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: command.scheduleEventId },
      include: {
        class: true,
        attendances: true,
        evaluation: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ID: ${command.scheduleEventId}`);
    }

    // 校区隔离校验
    if (command.campusId && schedule.campusId !== command.campusId) {
      throw new CampusScopeMismatchException(`操作校区 [${command.campusId}] 与排课实际校区 [${schedule.campusId}] 不匹配`);
    }
    const effectiveCampusId = scope?.targetCampusId;
    if (effectiveCampusId && !scope?.isSuperAdmin && schedule.campusId !== effectiveCampusId) {
      throw new CampusScopeMismatchException();
    }

    const activeAttendances = schedule.attendances.filter((a) => !a.isReversed);
    if (strategy === 'FULL_ROLLBACK' && activeAttendances.length === 0 && schedule.status !== 'completed') {
      throw new BadRequestException('该排课日程未曾结课或已被冲正，严禁重复反结课（防重放刷课）');
    }

    const operator = command.operatorName || scope?.operatorName || '教务主管';
    const reason = command.reason || (strategy === 'FULL_ROLLBACK' ? '统一结课履约反结课退还课时' : '教务重开课评重新编辑');
    const receiptId = `REC-REV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.$transaction(async (tx) => {
      let refundedLessonTotal = 0;
      let refundedRegularTotal = 0;
      let refundedBonusTotal = 0;
      const reversalSubDetails: any[] = [];

      // ----------------------------------------------------------------------
      // 策略 A: FULL_ROLLBACK (全量回滚课消并原路返还课时)
      // ----------------------------------------------------------------------
      if (strategy === 'FULL_ROLLBACK') {
        for (const att of activeAttendances) {
          if (att.deductLessons > 0) {
            let pkg: any = null;
            if (att.packageId) {
              pkg = await tx.studentCoursePackage.findUnique({
                where: { id: att.packageId },
              });
            }

            if (!pkg) {
              pkg = await tx.studentCoursePackage.findFirst({
                where: {
                  studentId: att.studentId,
                  courseId: schedule.class.courseId,
                },
              });
            }

            if (pkg) {
              // 核心财务防腐屏障 (ACB)：严禁复活已退费课包 (RefundLocked Guard)
              if (pkg.status === 'refunded') {
                throw new RefundLockedException(pkg.id);
              }

              // 原路退还课时并安全复苏课包状态 (仅完结课包才恢复 active，已冻结保持 frozen)
              const nextStatus = pkg.status === 'frozen' ? 'frozen' : 'active';
              const updatedPkg = await tx.studentCoursePackage.update({
                where: { id: pkg.id },
                data: {
                  remainingLessons: { increment: att.deductLessons },
                  consumedLessons: { decrement: att.deductLessons },
                  status: nextStatus,
                },
              });

              refundedLessonTotal += att.deductLessons;
              refundedRegularTotal += att.regularBurned || att.deductLessons;
              refundedBonusTotal += att.bonusBurned || 0;

              reversalSubDetails.push({
                studentId: att.studentId,
                packageId: pkg.id,
                refundedLessons: att.deductLessons,
                remainingAfter: updatedPkg.remainingLessons,
              });
            }
          }

          // 考勤记录置为已冲正
          await tx.attendanceRecord.update({
            where: { id: att.id },
            data: {
              isReversed: true,
              reversedAt: new Date(),
              reversedBy: operator,
              reversalReason: reason,
              comment: att.comment ? `${att.comment} [已由 ${operator} 反结课冲正]` : `[已由 ${operator} 反结课冲正]`,
            },
          });
        }

        // 排课日程恢复待上课 (scheduled, regular)
        await tx.scheduleEvent.update({
          where: { id: schedule.id },
          data: {
            status: 'scheduled',
            semanticType: 'regular',
          },
        });
      }

      // ----------------------------------------------------------------------
      // 级联处理课评与出站信箱 (彻底消灭幽灵通知与幽灵课评)
      // ----------------------------------------------------------------------
      let cancelledOutboxCount = 0;
      let previousStatus: string | undefined = undefined;
      const nextEvalStatus = strategy === 'FULL_ROLLBACK' ? 'revoked' : 'draft';

      if (schedule.evaluation) {
        previousStatus = schedule.evaluation.status;

        // 1. 更新课评状态
        await tx.lessonEvaluation.update({
          where: { id: schedule.evaluation.id },
          data: {
            status: nextEvalStatus,
          },
        });

        // 2. 级联作废出站信箱所有处于 pending 状态的在途微信通知
        const cancelOutboxRes = await tx.lessonEvaluationOutbox.updateMany({
          where: {
            evaluationId: schedule.evaluation.id,
            status: 'pending',
          },
          data: {
            status: 'cancelled',
            lastError:
              strategy === 'FULL_ROLLBACK'
                ? `反结课冲正级联作废在途通知 (操作人: ${operator})`
                : `重开课评级联作废旧在途通知 (操作人: ${operator})`,
          },
        });
        cancelledOutboxCount = cancelOutboxRes.count;

        // 若是重开课评策略，重置考勤记录中的评语与评分，以便重新水化
        if (strategy === 'REOPEN_EVALUATION') {
          for (const att of activeAttendances) {
            await tx.attendanceRecord.update({
              where: { id: att.id },
              data: {
                comment: null,
                score: null,
                rating: null,
              },
            });
          }
        }
      }

      return {
        receiptId,
        scheduleEventId: schedule.id,
        strategy,
        reversedAt: new Date().toISOString(),
        operator,
        reason,
        settlementReversal:
          strategy === 'FULL_ROLLBACK'
            ? {
                reversedAttendanceCount: activeAttendances.length,
                refundedTotalLessons: refundedLessonTotal,
                refundedRegularLessons: refundedRegularTotal,
                refundedBonusLessons: refundedBonusTotal,
                details: reversalSubDetails,
              }
            : null,
        evaluationReversal: schedule.evaluation
          ? {
              evaluationId: schedule.evaluation.id,
              previousStatus,
              nextStatus: nextEvalStatus,
              cancelledOutboxCount,
            }
          : null,
        message:
          strategy === 'FULL_ROLLBACK'
            ? `反结课冲正成功！已退还 ${refundedLessonTotal} 课时，作废随堂课评，级联取消 ${cancelledOutboxCount} 条微信在途推送。`
            : `课评重开成功！课时财务扣减完全保留，原课评已转为草稿，作废 ${cancelledOutboxCount} 条在途推送。`,
      };
    });
  }
}
