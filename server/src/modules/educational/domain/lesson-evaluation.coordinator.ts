import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxNotificationDispatcher } from './notification/outbox-notification.dispatcher';
import {
  HydrateEvaluationQuery,
  HydratedEvaluationWorkbench,
  HydratedRosterItem,
  CommitEvaluationCommand,
  EvaluationCommitReceipt,
  CampusScopeContext,
  CampusScopeMismatchException,
  ScheduleCancelledException,
} from './lesson-evaluation.types';

// 预设默认课程知识点与评语框架 (当排课初次打开且未保存过草稿时智能水化)
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
export class LessonEvaluationCoordinator {
  private readonly logger = new Logger(LessonEvaluationCoordinator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxDispatcher: OutboxNotificationDispatcher,
  ) {}

  /**
   * 1. 智能水化全景上下文 (hydrateEvaluation)
   * 打开课评弹窗即得：自动联查排课日程、课程大纲富文本、已考勤/在读学员花名册与微信绑定画像
   */
  async hydrateEvaluation(
    query: HydrateEvaluationQuery,
    scope?: CampusScopeContext,
  ): Promise<HydratedEvaluationWorkbench> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: query.scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
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

    const existingEval = schedule.evaluation;
    const isExisting = Boolean(existingEval);

    // 解析已存相册
    let photoList: string[] = [];
    if (existingEval?.photoList) {
      try {
        photoList = JSON.parse(existingEval.photoList);
      } catch {
        photoList = [];
      }
    }

    // 学员特写索引
    const studentItemMap = new Map<string, any>();
    if (existingEval?.studentItems) {
      for (const item of existingEval.studentItems) {
        studentItemMap.set(item.studentId, item);
      }
    }

    // 组装参课学员花名册 (Roster)
    const roster: HydratedRosterItem[] = [];
    let attendedCount = 0;
    let absentCount = 0;
    let wechatBoundCount = 0;
    let wechatUnboundCount = 0;

    if (schedule.attendances && schedule.attendances.length > 0) {
      // 存在随堂考勤记录
      for (const att of schedule.attendances) {
        const student = att.student;
        const isAttended = att.status === 'present' || att.status === 'late';
        if (isAttended) attendedCount++;
        else absentCount++;

        const isBound = Boolean(student.wechatOpenId);
        if (isBound) wechatBoundCount++;
        else wechatUnboundCount++;

        const override = studentItemMap.get(student.id);

        roster.push({
          studentId: student.id,
          studentNo: student.studentNo,
          studentName: student.name,
          parentPhone: student.phone,
          wechatOpenId: student.wechatOpenId,
          isWechatBound: isBound,
          attendanceStatus: att.status as any,
          deductLessons: att.deductLessons,
          personalizedComment: override?.comment || att.comment || undefined,
          studentRating: override?.rating || (att.rating === 'A+' ? 5 : att.rating === 'A' ? 4.5 : att.rating === 'B+' ? 4 : 3.5),
          performanceTag: override?.performanceTag || undefined,
        });
      }
    } else {
      // 尚未点名，从班级在读激活课包水化学员名单
      const activePackages = await this.prisma.studentCoursePackage.findMany({
        where: {
          classId: cls.id,
          status: 'active',
        },
        include: {
          student: true,
        },
      });

      for (const pkg of activePackages) {
        const student = pkg.student;
        const isBound = Boolean(student.wechatOpenId);
        if (isBound) wechatBoundCount++;
        else wechatUnboundCount++;

        const override = studentItemMap.get(student.id);

        roster.push({
          studentId: student.id,
          studentNo: student.studentNo,
          studentName: student.name,
          parentPhone: student.phone,
          wechatOpenId: student.wechatOpenId,
          isWechatBound: isBound,
          attendanceStatus: 'unrecorded',
          deductLessons: 1,
          personalizedComment: override?.comment || undefined,
          studentRating: override?.rating || 5,
          performanceTag: override?.performanceTag || undefined,
        });
      }
    }

    return {
      schedule: {
        id: schedule.id,
        date: schedule.date,
        timeSlot: `${schedule.startTime} - ${schedule.endTime}`,
        classId: cls.id,
        className: cls.name,
        classroomName: schedule.classroom?.name || '指定教室',
        courseId: course?.id || '',
        courseName: course?.name || '综合精品课',
        subject,
        scheduleStatus: schedule.status,
      },
      evaluation: {
        isExisting,
        status: (existingEval?.status as any) || 'draft',
        templateId: existingEval?.templateId || query.preferredTemplateId || 'tmpl-common',
        templateName: existingEval?.templateName || (subject === 'python' ? 'Python高阶代码进阶模板' : subject === 'robotics' ? '单片机硬件科创课评模板' : '通用课评模板'),
        lessonTitle: existingEval?.lessonTitle || `${cls.name} - ${fallbackTemplate.title}`,
        studyContentHtml: existingEval?.studyContent || fallbackTemplate.content,
        overallRating: existingEval?.overallRating ?? 5.0,
        voiceUrl: existingEval?.voiceUrl || undefined,
        voiceDuration: existingEval?.voiceDuration || 0,
        videoUrl: existingEval?.videoUrl || undefined,
        photoList,
        teacherComment: existingEval?.teacherComment || fallbackTemplate.comment,
        aiPolished: existingEval?.aiPolished ?? false,
        lastPublishedAt: existingEval?.publishedAt ? existingEval.publishedAt.toISOString() : undefined,
        revisionNumber: existingEval?.currentRevision || 0,
      },
      roster,
      summary: {
        totalEnrolled: roster.length,
        attendedCount,
        absentCount,
        wechatBoundCount,
        wechatUnboundCount,
      },
    };
  }

  /**
   * 2. 一键暂存或发布提交 (commitEvaluation)
   * 单一原子物理事务：
   * - 课评落盘 (聚合根 LessonEvaluation + 学员项)
   * - 不可变版本快照归档与 SHA-256 数据指纹
   * - 考勤双向渗透写回 (激活 ADR-0005 学情雷达与成长档案)
   * - 事务性出站信箱投递 (Transactional Outbox)
   */
  async commitEvaluation(
    command: CommitEvaluationCommand,
    scope?: CampusScopeContext,
  ): Promise<EvaluationCommitReceipt> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: command.scheduleEventId },
      include: {
        class: { include: { course: true } },
        attendances: {
          where: { isReversed: false },
          include: { student: true },
        },
        evaluation: {
          include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
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

    const { payload, publish } = command;

    // 发布完整性前置校验
    if (publish) {
      if (!payload.lessonTitle || payload.lessonTitle.trim().length === 0) {
        throw new BadRequestException('发布课评必须填写课次名称');
      }
      if (!payload.studyContentHtml || payload.studyContentHtml.trim().length < 5) {
        throw new BadRequestException('发布课评学习内容不能少于 5 个字符');
      }
      if (!payload.teacherComment || payload.teacherComment.trim().length < 5) {
        throw new BadRequestException('发布课评老师点评不能少于 5 个字符');
      }
      if (!payload.overallRating || payload.overallRating < 1 || payload.overallRating > 5) {
        throw new BadRequestException('发布课评综合星级必须在 1.0 至 5.0 之间');
      }
      if (payload.photoList && payload.photoList.length > 9) {
        throw new BadRequestException('随堂课堂照片最多允许上传 9 张');
      }
    }

    // 幂等防重放检测
    const existing = schedule.evaluation;
    if (
      command.idempotencyKey &&
      existing &&
      existing.idempotencyKey === command.idempotencyKey &&
      existing.status === 'published'
    ) {
      this.logger.warn(`[LessonEvaluation] 命中幂等键 ${command.idempotencyKey}，直接返回已发布的不可变凭据`);
      const latestRev = existing.revisions[0];
      return {
        receiptId: `REC-EVAL-${existing.id.slice(0, 8)}`,
        scheduleEventId: schedule.id,
        classId: schedule.classId,
        className: schedule.class.name,
        status: 'published',
        committedAt: existing.publishedAt ? existing.publishedAt.toISOString() : new Date().toISOString(),
        operator: command.operatorName,
        revisionNumber: latestRev?.revisionNumber || 1,
        attendanceSync: {
          syncedCount: schedule.attendances.length,
          scheduleSettled: schedule.status === 'completed',
        },
        dispatchResult: {
          strategy: command.dispatchStrategy || 'ATTENDED_ONLY',
          totalTargetCount: schedule.attendances.length,
          outboxEnqueuedCount: 0,
          wechatSkippedCount: 0,
          unboundStudents: [],
        },
        fingerprint: latestRev?.fingerprint || 'idempotent_cached',
        userMessage: '幂等拦截：该课评已发布成功，无须重复提交。',
      };
    }

    const nextRevisionNumber = existing ? (existing.currentRevision || 0) + 1 : 1;
    const photoListJson = JSON.stringify(payload.photoList || []);
    const studentOverrides = payload.studentOverrides || [];
    const overrideMap = new Map<string, (typeof studentOverrides)[0]>();
    for (const ov of studentOverrides) {
      overrideMap.set(ov.studentId, ov);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. 落盘课评聚合根 LessonEvaluation
      const evalRecord = await tx.lessonEvaluation.upsert({
        where: { scheduleEventId: schedule.id },
        update: {
          lessonTitle: payload.lessonTitle,
          templateId: payload.templateId || 'tmpl-common',
          templateName: payload.templateName || '通用课评模板',
          studyContent: payload.studyContentHtml,
          overallRating: payload.overallRating ?? 5.0,
          teacherComment: payload.teacherComment || '课堂教学进展顺利，随堂表现良好',
          voiceUrl: payload.voiceUrl || null,
          voiceDuration: payload.voiceDuration || 0,
          videoUrl: payload.videoUrl || null,
          photoList: photoListJson,
          aiPolished: payload.aiPolished ?? false,
          status: publish ? 'published' : 'draft',
          currentRevision: publish ? nextRevisionNumber : existing?.currentRevision || 0,
          publishedAt: publish ? new Date() : existing?.publishedAt,
          idempotencyKey: command.idempotencyKey || null,
        },
        create: {
          campusId: schedule.campusId,
          scheduleEventId: schedule.id,
          classId: schedule.classId,
          teacherId: schedule.teacherId,
          lessonTitle: payload.lessonTitle,
          templateId: payload.templateId || 'tmpl-common',
          templateName: payload.templateName || '通用课评模板',
          studyContent: payload.studyContentHtml,
          overallRating: payload.overallRating ?? 5.0,
          teacherComment: payload.teacherComment || '课堂教学进展顺利，随堂表现良好',
          voiceUrl: payload.voiceUrl || null,
          voiceDuration: payload.voiceDuration || 0,
          videoUrl: payload.videoUrl || null,
          photoList: photoListJson,
          aiPolished: payload.aiPolished ?? false,
          status: publish ? 'published' : 'draft',
          currentRevision: publish ? nextRevisionNumber : 0,
          publishedAt: publish ? new Date() : null,
          idempotencyKey: command.idempotencyKey || null,
        },
      });

      // 2. 落盘单学员特写条目 LessonEvaluationStudentItem
      for (const ov of studentOverrides) {
        await tx.lessonEvaluationStudentItem.upsert({
          where: {
            evaluationId_studentId: {
              evaluationId: evalRecord.id,
              studentId: ov.studentId,
            },
          },
          update: {
            rating: ov.rating,
            comment: ov.personalizedComment,
            performanceTag: ov.performanceTag,
          },
          create: {
            evaluationId: evalRecord.id,
            studentId: ov.studentId,
            rating: ov.rating,
            comment: ov.personalizedComment,
            performanceTag: ov.performanceTag,
          },
        });
      }

      let fingerprint = '';
      let syncedCount = 0;
      let outboxEnqueuedCount = 0;
      let wechatSkippedCount = 0;
      const unboundStudents: Array<{ studentId: string; studentName: string; parentPhone: string }> = [];

      // 3. 仅发布态触发：不可变版本快照 + 考勤双向渗透 + 事务性信箱
      if (publish) {
        // A. 构建不可变快照并计算 SHA-256 数据指纹
        const snapshotObj = {
          evaluationId: evalRecord.id,
          scheduleEventId: schedule.id,
          className: schedule.class.name,
          lessonTitle: payload.lessonTitle,
          studyContent: payload.studyContentHtml,
          overallRating: payload.overallRating,
          teacherComment: payload.teacherComment,
          photoList: payload.photoList || [],
          revisionNumber: nextRevisionNumber,
          publishedBy: command.operatorName,
          timestamp: new Date().toISOString(),
        };

        fingerprint = crypto
          .createHash('sha256')
          .update(JSON.stringify(snapshotObj, Object.keys(snapshotObj).sort()))
          .digest('hex');

        await tx.lessonEvaluationRevision.create({
          data: {
            evaluationId: evalRecord.id,
            revisionNumber: nextRevisionNumber,
            snapshotData: JSON.stringify(snapshotObj),
            revisionReason: nextRevisionNumber === 1 ? '随堂初次发布' : '教师随堂修订更新',
            fingerprint,
            publishedBy: command.operatorName,
          },
        });

        // B. 双向考勤防腐同步 (激活 ADR-0005 学情雷达)
        for (const att of schedule.attendances) {
          const ov = overrideMap.get(att.studentId);
          const studentRating = ov?.rating ?? payload.overallRating;
          const studentComment = ov?.personalizedComment || payload.teacherComment;

          // 星级到百分制分值与等第归一化折算
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

          await tx.attendanceRecord.update({
            where: { id: att.id },
            data: {
              comment: studentComment,
              score,
              rating: ratingStr,
            },
          });
          syncedCount++;
        }

        // 推进排课状态为 completed
        if (schedule.status !== 'completed') {
          await tx.scheduleEvent.update({
            where: { id: schedule.id },
            data: {
              status: 'completed',
              semanticType: 'completed',
            },
          });
        }

        // C. 事务性出站信箱灌装 (Transactional Outbox)
        const strategy = command.dispatchStrategy || 'ATTENDED_ONLY';
        const candidateStudents = schedule.attendances
          .filter((att) => {
            if (strategy === 'ATTENDED_ONLY') {
              return att.status === 'present' || att.status === 'late';
            }
            return true;
          })
          .map((att) => att.student);

        for (const st of candidateStudents) {
          const ov = overrideMap.get(st.id);
          const stRating = ov?.rating ?? payload.overallRating;
          const stComment = ov?.personalizedComment || payload.teacherComment;

          const outboxPayload = {
            evaluationId: evalRecord.id,
            revisionNumber: nextRevisionNumber,
            studentId: st.id,
            studentName: st.name,
            parentPhone: st.phone,
            className: schedule.class.name,
            courseName: schedule.class.course?.name || '综合课程',
            lessonTitle: payload.lessonTitle,
            rating: stRating,
            ratingText: `${stRating} 星卓越表现`,
            teacherComment: stComment,
            photoCount: (payload.photoList || []).length,
            hasVoice: Boolean(payload.voiceUrl),
            hasVideo: Boolean(payload.videoUrl),
            publishedAt: new Date().toISOString(),
          };

          const outboxIdempotencyKey = `outbox_${evalRecord.id}_rev${nextRevisionNumber}_st_${st.id}`;

          if (st.wechatOpenId) {
            await tx.lessonEvaluationOutbox.create({
              data: {
                campusId: schedule.campusId,
                evaluationId: evalRecord.id,
                revisionNumber: nextRevisionNumber,
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
            unboundStudents.push({
              studentId: st.id,
              studentName: st.name,
              parentPhone: st.phone,
            });
            await tx.lessonEvaluationOutbox.create({
              data: {
                campusId: schedule.campusId,
                evaluationId: evalRecord.id,
                revisionNumber: nextRevisionNumber,
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

      // 4. 事务成功后触发非阻塞出站调度
      if (publish && outboxEnqueuedCount > 0) {
        this.outboxDispatcher.triggerImmediateDispatch(evalRecord.id);
      }

      const receiptId = `REC-EVAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      return {
        receiptId,
        scheduleEventId: schedule.id,
        classId: schedule.classId,
        className: schedule.class.name,
        status: publish ? 'published' : 'draft',
        committedAt: new Date().toISOString(),
        operator: command.operatorName,
        revisionNumber: publish ? nextRevisionNumber : existing?.currentRevision || 0,
        attendanceSync: {
          syncedCount,
          scheduleSettled: true,
        },
        dispatchResult: {
          strategy: command.dispatchStrategy || 'ATTENDED_ONLY',
          totalTargetCount: schedule.attendances.length,
          outboxEnqueuedCount,
          wechatSkippedCount,
          unboundStudents,
        },
        fingerprint,
        userMessage: publish
          ? `课评发布成功！已双向同步 ${syncedCount} 条考勤成长评语，排入 ${outboxEnqueuedCount} 条微信推送队列。`
          : '课评草稿已持久化暂存成功。',
      };
    });
  }
}
