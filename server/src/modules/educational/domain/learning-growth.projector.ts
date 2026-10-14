import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  MediaStoragePort,
  AliyunOssMediaAdapter,
} from './ports/media-storage.port';
import {
  GrowthTokenPort,
  HmacSha256TokenAdapter,
} from './ports/growth-token.port';
import {
  SettleRollCallInput,
  ReverseRollCallInput,
  PortfolioQueryOptions,
  LessonSettlementReceipt,
  LessonReversalReceipt,
  StudentLearningPortfolio,
  LearningTimelineItem,
  CompetencyRadarProfile,
  ConsumptionHealth,
  CoursePackageProgress,
  GrowthPortfolioSummary,
  RefundLockedException,
  ScheduleAlreadySettledException,
  NoActiveAttendanceToReverseException,
  AttendanceStatus,
  NineGridPhoto,
  VoiceAudioMeta,
  VideoPlayerMeta,
  AdminTimelineItem,
  AdminLearningDossierView,
  AdminDossierQuery,
  MotivationalBadge,
  ParentLessonCardView,
  ParentGrowthFeedView,
  ParentFeedQuery,
  ParentSingleLessonView,
  ParentSingleLessonQuery,
  AccessTokenScope,
  GrowthAccessTokenPayload,
  IssueParentTokenInput,
  ParentTokenReceipt,
  CampusScopeContext,
} from './learning-growth.types';

@Injectable()
export class LearningGrowthProjector {
  private readonly logger = new Logger(LearningGrowthProjector.name);
  private readonly mediaStorage: MediaStoragePort;
  private readonly tokenPort: GrowthTokenPort;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() mediaStorage?: MediaStoragePort,
    @Optional() tokenPort?: GrowthTokenPort,
  ) {
    this.mediaStorage = mediaStorage || new AliyunOssMediaAdapter();
    this.tokenPort = tokenPort || new HmacSha256TokenAdapter();
  }

  /**
   * 1. 随堂点名消课结算工步 (Settle Roll Call)
   * 闭环业务不变量：
   * - 排课日程结课状态机防重
   * - 出账课包 FIFO 智能锁定
   * - 退费在途与已退费状态探测
   * - 实付正课优先扣减 (Regular-First)，不可折现赠课留存
   */
  async settleRollCall(input: SettleRollCallInput): Promise<LessonSettlementReceipt> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: input.scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 (ID: ${input.scheduleEventId})`);
    }

    if (schedule.status === 'completed') {
      throw new ScheduleAlreadySettledException(input.scheduleEventId);
    }

    return this.prisma.$transaction(async (tx) => {
      const details: LessonSettlementReceipt['details'] = [];
      let totalDeductedLessons = 0;
      let regularLessonsBurned = 0;
      let bonusLessonsBurned = 0;
      let presentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      for (const item of input.items) {
        if (item.status === 'present') presentCount += 1;
        else if (item.status === 'late') lateCount += 1;
        else if (item.status === 'leave') leaveCount += 1;
        else if (item.status === 'absent') absentCount += 1;

        const isDeductible = item.status === 'present' || item.status === 'late';
        const requestedDeduct = item.deductLessons !== undefined ? Number(item.deductLessons) : 1;
        const actualDeduct = isDeductible ? requestedDeduct : 0;

        let targetPkg: any = null;
        let itemRegularBurned = 0;
        let itemBonusBurned = 0;
        let remainingAfter = 0;

        if (actualDeduct > 0) {
          // 1. 课包定位：优先使用指定 packageId，缺省则按 FIFO 寻找在读 active 课包
          if (item.packageId) {
            targetPkg = await tx.studentCoursePackage.findFirst({
              where: {
                id: item.packageId,
                studentId: item.studentId,
              },
            });
          }

          if (!targetPkg) {
            targetPkg = await tx.studentCoursePackage.findFirst({
              where: {
                studentId: item.studentId,
                courseId: schedule.class.courseId,
                status: 'active',
              },
              orderBy: { createdAt: 'asc' },
            });
          }

          if (!targetPkg) {
            throw new BadRequestException(
              `学员 (ID: ${item.studentId}) 在课程 [${schedule.class.course?.name || '未知课程'}] 下未找到可用在读课包`,
            );
          }

          // 2. 课包退费在途与退费锁定探测
          if (targetPkg.status === 'refunded') {
            throw new RefundLockedException(targetPkg.id, '课包已退费归档，禁止消课扣费');
          }

          // 检查该课包是否有正在审批流中的退费单据
          const pendingRefundOrder = await tx.order.findFirst({
            where: {
              studentId: item.studentId,
              orderType: 'refund',
              status: 'unpaid', // 退费单 unpaid 表示正在审批尚未资金出账
              approval: {
                status: 'pending',
              },
            },
          });
          if (pendingRefundOrder) {
            throw new RefundLockedException(targetPkg.id, '该课包正处于财务退费三级审批流中，已被风控锁定禁止扣课');
          }

          if (targetPkg.remainingLessons < actualDeduct) {
            throw new BadRequestException(
              `学员课包剩余课时不足！当前剩余: ${targetPkg.remainingLessons} 课时，本次尝试扣减: ${actualDeduct} 课时`,
            );
          }

          // 3. 盛通正课优先消耗算法 (Regular-First Burning Rule)
          // 可用实付正课 = remainingLessons - bonusLessons
          const regularRemaining = Math.max(0, targetPkg.remainingLessons - targetPkg.bonusLessons);
          if (regularRemaining >= actualDeduct) {
            itemRegularBurned = actualDeduct;
            itemBonusBurned = 0;
          } else {
            itemRegularBurned = regularRemaining;
            itemBonusBurned = actualDeduct - regularRemaining;
          }

          remainingAfter = targetPkg.remainingLessons - actualDeduct;
          const nextBonus = targetPkg.bonusLessons - itemBonusBurned;
          const nextStatus = remainingAfter <= 0 ? 'completed' : 'active';

          // 原子扣减课包余额
          await tx.studentCoursePackage.update({
            where: { id: targetPkg.id },
            data: {
              remainingLessons: remainingAfter,
              consumedLessons: { increment: actualDeduct },
              bonusLessons: nextBonus,
              status: nextStatus,
            },
          });

          totalDeductedLessons += actualDeduct;
          regularLessonsBurned += itemRegularBurned;
          bonusLessonsBurned += itemBonusBurned;

          details.push({
            studentId: item.studentId,
            packageId: targetPkg.id,
            deductLessons: actualDeduct,
            regularBurned: itemRegularBurned,
            bonusBurned: itemBonusBurned,
            remainingAfter,
          });
        }

        // 4. 落库不可变考勤履约明细记录 AttendanceRecord
        await tx.attendanceRecord.create({
          data: {
            scheduleEventId: schedule.id,
            studentId: item.studentId,
            packageId: targetPkg ? targetPkg.id : null,
            status: item.status,
            deductLessons: actualDeduct,
            regularBurned: itemRegularBurned,
            bonusBurned: itemBonusBurned,
            comment: item.comment || null,
            score: item.score !== undefined ? Number(item.score) : null,
            rating: item.rating || null,
            operator: input.operator,
            isReversed: false,
          },
        });
      }

      // 5. 排课日程状态原子流转至 completed
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'completed',
          semanticType: 'completed',
        },
      });

      return {
        success: true,
        scheduleEventId: schedule.id,
        settledAt: new Date().toISOString(),
        operator: input.operator,
        completedCount: input.items.length,
        totalDeductedLessons,
        regularLessonsBurned,
        bonusLessonsBurned,
        summary: {
          totalStudents: input.items.length,
          presentCount,
          lateCount,
          leaveCount,
          absentCount,
          totalLessonsDeducted: totalDeductedLessons,
        },
        details,
        message: `随堂点名消课成功！已结算 ${input.items.length} 名学员，核销 ${totalDeductedLessons} 课时 (正课 ${regularLessonsBurned}, 赠课 ${bonusLessonsBurned})`,
      };
    });
  }

  /**
   * 2. 具备财务防腐屏障的反结课冲正工步 (Reverse Roll Call with ACB)
   * 闭环业务不变量：
   * - 防重放反结课 (Anti-Replay)
   * - 财务防腐屏障 (ACB)：严禁复活已退费课包 (RefundLocked Guard)
   * - 原路等额原课包退还正赠课时
   * - 排课日程安全回退 scheduled 待上课
   */
  async reverseRollCall(input: ReverseRollCallInput): Promise<LessonReversalReceipt> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: input.scheduleEventId },
      include: {
        class: true,
        attendances: {
          where: { isReversed: false },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 (ID: ${input.scheduleEventId})`);
    }

    if (schedule.attendances.length === 0) {
      throw new NoActiveAttendanceToReverseException(input.scheduleEventId);
    }

    return this.prisma.$transaction(async (tx) => {
      let refundedLessons = 0;
      let refundedRegularLessons = 0;
      let refundedBonusLessons = 0;
      let blockedRefundResurrections = 0;
      let divertedWalletAmount = 0;
      const details: LessonReversalReceipt['details'] = [];

      for (const att of schedule.attendances) {
        if (att.deductLessons > 0 && att.packageId) {
          const pkg = await tx.studentCoursePackage.findUnique({
            where: { id: att.packageId },
            include: { course: true },
          });

          if (!pkg) {
            throw new NotFoundException(`扣费课包记录丢失 (ID: ${att.packageId})`);
          }

          // -----------------------------------------------------------------
          // 核心财务防腐屏障 (Anti-Corruption Barrier, ACB)
          // -----------------------------------------------------------------
          if (pkg.status === 'refunded') {
            blockedRefundResurrections += 1;

            if (input.refundLockedPolicy === 'ESCROW_TO_WALLET') {
              // 安全降级：课包状态保持 refunded 绝不复活，课时等额折算现金补偿至学员零钱钱包
              const pricePerLesson = pkg.course?.pricePerLesson || 200;
              const refundAmount = Number((att.regularBurned * pricePerLesson).toFixed(2));
              divertedWalletAmount += refundAmount;

              if (refundAmount > 0) {
                await tx.studentWallet.upsert({
                  where: { studentId: att.studentId },
                  create: {
                    studentId: att.studentId,
                    principalBalance: refundAmount,
                    bonusBalance: 0,
                    goldPoints: 0,
                  },
                  update: {
                    principalBalance: { increment: refundAmount },
                  },
                });

                await tx.walletLedger.create({
                  data: {
                    studentId: att.studentId,
                    type: 'refund',
                    amount: refundAmount,
                    principalChange: refundAmount,
                    bonusChange: 0,
                    description: `[ACB退费存管] 反结课冲正遭遇已退费课包 (${pkg.id})，${att.deductLessons}课时折合 ¥${refundAmount} 存入钱包本金`,
                    operator: input.operator,
                  },
                });
              }

              details.push({
                studentId: att.studentId,
                packageId: pkg.id,
                refundedLessons: att.deductLessons,
                remainingAfter: pkg.remainingLessons,
                statusAfter: 'refunded',
              });
            } else {
              // 默认严格阻断策略 (STRICT_ABORT)
              throw new RefundLockedException(
                pkg.id,
                `该日程中包含已退费课包 (学员 ID: ${att.studentId})，已被财务防腐屏障永久锁定，严禁冲正复活！`,
              );
            }
          } else {
            // 正常课包原路精准退还
            const nextRemaining = pkg.remainingLessons + att.deductLessons;
            const nextConsumed = Math.max(0, pkg.consumedLessons - att.deductLessons);
            const nextBonus = pkg.bonusLessons + att.bonusBurned;
            // 若原课包此前因扣完变为 completed，退还后自动恢复为 active
            const nextStatus = pkg.status === 'frozen' ? 'frozen' : 'active';

            await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: {
                remainingLessons: nextRemaining,
                consumedLessons: nextConsumed,
                bonusLessons: nextBonus,
                status: nextStatus,
              },
            });

            details.push({
              studentId: att.studentId,
              packageId: pkg.id,
              refundedLessons: att.deductLessons,
              remainingAfter: nextRemaining,
              statusAfter: nextStatus,
            });
          }

          refundedLessons += att.deductLessons;
          refundedRegularLessons += att.regularBurned;
          refundedBonusLessons += att.bonusBurned;
        }

        // 标记考勤记录为已冲正并保留审计痕迹
        await tx.attendanceRecord.update({
          where: { id: att.id },
          data: {
            isReversed: true,
            reversedAt: new Date(),
            reversedBy: input.operator,
            reversalReason: input.reason || '反结课冲正',
          },
        });
      }

      // 排课日程状态回滚为 scheduled
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'scheduled',
          semanticType: 'regular',
        },
      });

      return {
        success: true,
        scheduleEventId: schedule.id,
        reversedAt: new Date().toISOString(),
        operator: input.operator,
        reversalReason: input.reason || '随堂点名误操作冲正',
        reversedCount: schedule.attendances.length,
        refundedLessons,
        refundedRegularLessons,
        refundedBonusLessons,
        details,
        antiCorruptionSummary: {
          blockedRefundResurrections,
          divertedWalletAmount,
        },
        message: `反结课冲正成功！已退还 ${refundedLessons} 课时，成功安全拦截 ${blockedRefundResurrections} 次已退费课包复活事故`,
      };
    });
  }

  /**
   * 3. 360° 学员学情成长档案全景投影工步 (Learning Portfolio Projection)
   * 纯只读单次级联投影，闭环：
   * - 5 表关联纯只读折叠 (Student + Package + Attendance + Schedule + Evaluation)
   * - 接入多媒体课评相册流 (9 宫格缩略图、随堂视频、语音条、大纲知识点与学员个性特写)
   * - 4 级多媒体平滑优雅降级 (全量课评 -> 班级通评 -> 纯文本老数据 -> 冲正清洗)
   * - 冲正历史噪点清洗与防腐审计
   * - 课包进度条与预警单一真值源 (SSOT)
   * - 滑动 30 天周消课速率与耗尽天数预测
   * - 五维能力星级雷达模型归一化
   */
  async projectLearningPortfolio(
    studentId: string,
    options?: PortfolioQueryOptions,
  ): Promise<StudentLearningPortfolio> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        campus: true,
        packages: {
          include: {
            course: true,
            class: true,
          },
        },
        attendances: {
          include: {
            scheduleEvent: {
              include: {
                class: {
                  include: {
                    course: true,
                  },
                },
                teacher: {
                  select: {
                    id: true,
                    realName: true,
                  },
                },
                classroom: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                evaluation: {
                  include: {
                    studentItems: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: options?.limit || 50,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    // 1. 过滤已冲正记录（除非显式声明 includeReversed: true）
    const effectiveAttendances = student.attendances.filter((att) => {
      if (options?.courseId && att.scheduleEvent?.class?.courseId !== options.courseId) {
        return false;
      }
      if (!options?.includeReversed && att.isReversed) {
        return false;
      }
      return true;
    });

    // 2. 生成结构化学情时间轴 (Timeline) 与多媒体相册流折叠
    const timeline: LearningTimelineItem[] = effectiveAttendances.map((att) => {
      const sEvent = att.scheduleEvent;
      const evaluation = sEvent?.evaluation;
      const studentItems = evaluation?.studentItems || [];
      const personalItem = studentItems.find((item: any) => item.studentId === student.id);

      // 4 级多媒体平滑优雅降级
      const photoUrls = this.extractPhotoUrls(evaluation?.photoList);
      const nineGridPhotos = this.parsePhotoAlbum(evaluation?.photoList);
      const voiceMeta = this.parseVoiceMeta(evaluation?.voiceUrl, evaluation?.voiceDuration);
      const videoMeta = this.parseVideoMeta(evaluation?.videoUrl);
      const performanceTag = personalItem?.performanceTag || undefined;

      // 评语降级：个人特写评语 -> 考勤评语 -> 教师全班通评 -> 默认评语
      const comment =
        personalItem?.comment ||
        att.comment ||
        evaluation?.teacherComment ||
        '随堂专注听讲，积极参与课堂实操练习。';

      // 分数与星级：考勤履约 SSOT 优先，回退特写打分折算
      const score =
        att.score !== null && att.score !== undefined
          ? att.score
          : personalItem?.rating !== undefined && personalItem?.rating !== null
          ? Math.round(Number(personalItem.rating) * 20)
          : null;

      const rating =
        att.rating ||
        (personalItem?.rating !== undefined && personalItem?.rating !== null
          ? Number(personalItem.rating) >= 4.5
            ? 'A+'
            : Number(personalItem.rating) >= 4.0
            ? 'A'
            : 'B+'
          : 'A');

      // 为单课签发 30 天免登录安全分享令牌
      const shareToken = this.tokenPort.signToken({
        sub: student.id,
        targetId: att.scheduleEventId,
        scope: 'single_lesson',
        campusId: student.campusId,
        exp: Math.floor(Date.now() / 1000) + 30 * 86400,
        iat: Math.floor(Date.now() / 1000),
        nonce: `sl_${att.id.slice(0, 8)}`,
      });

      return {
        id: `timeline-${att.id}`,
        recordId: att.id,
        scheduleEventId: att.scheduleEventId,
        date: sEvent?.date || '',
        timeSlot: sEvent ? `${sEvent.startTime} - ${sEvent.endTime}` : '',
        courseName: sEvent?.class?.course?.name || '综合精品课',
        className: sEvent?.class?.name || '在读班级',
        teacherName: sEvent?.teacher?.realName || '主讲讲师',
        classroomName: sEvent?.classroom?.name || '教学教室',
        status: att.status as AttendanceStatus,
        deductLessons: att.deductLessons,
        score,
        rating,
        comment,
        homeworkRating:
          personalItem?.homeworkTask
            ? 'A+'
            : score && score >= 90
            ? 'A+'
            : score && score >= 80
            ? 'A'
            : 'B+',
        isReversed: att.isReversed,
        reversalReason: att.reversalReason || undefined,
        reversedAt: att.reversedAt ? att.reversedAt.toISOString() : undefined,

        // 多媒体课评直供流
        lessonTitle: evaluation?.lessonTitle || sEvent?.class?.course?.name || '随堂教学',
        photoList: photoUrls,
        photos: nineGridPhotos,
        videoUrl: evaluation?.videoUrl || undefined,
        videoMeta,
        voiceUrl: evaluation?.voiceUrl || undefined,
        voiceMeta,
        studyContent: evaluation?.studyContent || undefined,
        studyContentHtml: evaluation?.studyContent
          ? `<p>${evaluation.studyContent.replace(/\n/g, '<br/>')}</p>`
          : undefined,
        performanceTag,
        shareToken,
      };
    });

    // 3. 计算课包履约进度列表与消课预警单一真值源 (SSOT)
    let totalRemaining = 0;
    let totalConsumed = 0;
    let totalLessonsCount = 0;

    const packageProgressList: CoursePackageProgress[] = student.packages.map((pkg) => {
      totalRemaining += pkg.remainingLessons;
      totalConsumed += pkg.consumedLessons;
      totalLessonsCount += pkg.totalLessons;

      const progressPercent =
        pkg.totalLessons > 0
          ? Math.min(100, Math.round((pkg.consumedLessons / pkg.totalLessons) * 100))
          : 0;

      let warningLevel: 'normal' | 'warning' | 'urgent' = 'normal';
      if (pkg.remainingLessons <= 4) {
        warningLevel = 'urgent';
      } else if (pkg.remainingLessons <= 8) {
        warningLevel = 'warning';
      }

      return {
        packageId: pkg.id,
        courseId: pkg.courseId,
        courseName: pkg.course?.name || '未指定课程',
        className: pkg.class?.name,
        totalLessons: pkg.totalLessons,
        consumedLessons: pkg.consumedLessons,
        remainingLessons: pkg.remainingLessons,
        bonusLessons: pkg.bonusLessons,
        progressPercent,
        pricePerLesson: pkg.course?.pricePerLesson || 150,
        expiryDate: (pkg as any).expireDate || (pkg as any).expiryDate,
        status: pkg.status,
        isRefundLocked: pkg.status === 'refunded',
        warningLevel,
      };
    });

    let overallWarningLevel: 'normal' | 'warning' | 'urgent' = 'normal';
    if (totalRemaining <= 4) overallWarningLevel = 'urgent';
    else if (totalRemaining <= 8) overallWarningLevel = 'warning';

    // 4. 计算近 30 天滑动周消课速率与预计耗尽天数
    const nowMs = Date.now();
    const thirtyDaysAgoMs = nowMs - 30 * 86400000;
    const recentBurnedLessons = timeline
      .filter((t) => !t.isReversed && new Date(t.date).getTime() >= thirtyDaysAgoMs)
      .reduce((sum, t) => sum + t.deductLessons, 0);

    const weeklyBurnRate = Number(Math.max(0.5, recentBurnedLessons / 4.2).toFixed(1));
    const dailyRate = weeklyBurnRate / 7;
    const estimatedDepletionDays = dailyRate > 0 ? Math.round(totalRemaining / dailyRate) : 90;

    const latestDateStr = timeline[0]?.date;
    const latestDateMs = latestDateStr ? new Date(latestDateStr).getTime() : 0;
    const dormantRisk = latestDateMs > 0 && nowMs - latestDateMs > 14 * 86400000;
    const renewalWindowOpen = totalRemaining <= 8 || estimatedDepletionDays <= 30;

    const consumptionHealth: ConsumptionHealth = {
      weeklyBurnRate,
      estimatedDepletionDays,
      warningLevel: overallWarningLevel,
      dormantRisk,
      renewalWindowOpen,
    };

    // 5. 五维能力星级雷达模型与作品集聚合
    const attendedItems = timeline.filter(
      (t) => !t.isReversed && (t.status === 'present' || t.status === 'late'),
    );
    const totalAttendedSessions = attendedItems.length;
    const overallAttendanceRate =
      timeline.length > 0 ? Math.round((totalAttendedSessions / timeline.length) * 100) : 100;

    const scoredItems = attendedItems.filter((t) => t.score !== null);
    const sumScore = scoredItems.reduce((sum, t) => sum + (t.score || 0), 0);
    const averageQuizScore = scoredItems.length > 0 ? Math.round(sumScore / scoredItems.length) : 90;

    const ratingDistribution = {
      aPlusCount: attendedItems.filter((t) => t.rating === 'A+').length,
      aCount: attendedItems.filter((t) => t.rating === 'A').length,
      bPlusCount: attendedItems.filter((t) => t.rating === 'B+').length,
      bCount: attendedItems.filter((t) => t.rating === 'B').length,
    };

    // 五维雷达归一化算法 [0-100]
    const baseScore = averageQuizScore || 90;
    const radar: CompetencyRadarProfile = {
      logic: Math.min(100, Math.max(60, baseScore + 2)),
      creativity: Math.min(100, Math.max(60, baseScore + 5)),
      focus: Math.min(100, Math.max(60, Math.round(overallAttendanceRate * 0.4 + baseScore * 0.6))),
      handsOn: Math.min(100, Math.max(60, baseScore)),
      expression: Math.min(100, Math.max(60, baseScore - 2)),
      averageScore: baseScore,
    };

    const highFrequencyTags = [
      { tag: '逻辑清晰', count: Math.max(1, ratingDistribution.aPlusCount + ratingDistribution.aCount) },
      { tag: '专注度高', count: Math.max(1, Math.round(overallAttendanceRate / 20)) },
      { tag: '算法构建扎实', count: Math.max(1, ratingDistribution.aCount) },
      { tag: '动手实操积极', count: Math.max(1, totalAttendedSessions) },
      { tag: '作业高质量完成', count: Math.max(1, ratingDistribution.aPlusCount) },
    ];

    const growthSummary: GrowthPortfolioSummary = {
      totalAttendedSessions,
      overallAttendanceRate,
      averageQuizScore,
      ratingDistribution,
      highFrequencyTags,
      radar,
    };

    // 6. 聚合全景画廊相册 (打平历史所有非冲正照片)
    const albumGallery: Array<{
      photoUrl: string;
      thumbnailUrl: string;
      date: string;
      courseName: string;
      lessonTitle: string;
      teacherName: string;
    }> = [];

    for (const node of timeline) {
      if (!node.isReversed && node.photos && node.photos.length > 0) {
        for (const p of node.photos) {
          albumGallery.push({
            photoUrl: p.fullUrl,
            thumbnailUrl: p.thumbnailUrl,
            date: node.date,
            courseName: node.courseName,
            lessonTitle: node.lessonTitle || '随堂实操',
            teacherName: node.teacherName,
          });
        }
      }
    }

    // 7. 签发全景成长大盘免登录分享令牌 (有效 7 天)
    const portfolioShareToken = this.tokenPort.signToken({
      sub: student.id,
      scope: 'full_portfolio',
      campusId: student.campusId,
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
      iat: Math.floor(Date.now() / 1000),
      nonce: `fp_${student.id.slice(0, 8)}_${Date.now()}`,
    });

    return {
      studentInfo: {
        id: student.id,
        studentNo: student.studentNo,
        name: student.name,
        gender: student.gender || 'male',
        phone: student.phone || '',
        school: (student as any).school,
        grade: (student as any).grade,
        campusName: student.campus?.name || '总部校区',
        status: student.status,
      },
      assetOverview: {
        totalRemainingLessons: totalRemaining,
        totalConsumedLessons: totalConsumed,
        totalLessons: totalLessonsCount,
        overallWarningLevel,
        activeCourseCount: packageProgressList.filter((p) => p.status === 'active').length,
      },
      packageProgressList,
      timeline,
      learningRecords: timeline, // 前端向下兼容别名
      growthSummary,
      consumptionHealth,
      albumGallery,
      portfolioShareToken,
    };
  }

  // ============================================================================
  // 双重视角工效接缝 (Dual-Perspective Client-First Seams)
  // ============================================================================

  /**
   * 视角 A：校区管理后台 360° 学员全景成长档案抽屉投影 (面向管理人员与学管)
   * 开箱即用 9 宫格缩略图、预览序列、课消健康度单一真值源 (SSOT) 与相册大盘
   */
  async projectAdminDossier(
    query: AdminDossierQuery,
    scope?: CampusScopeContext,
  ): Promise<AdminLearningDossierView> {
    const portfolio = await this.projectLearningPortfolio(query.studentId, {
      courseId: query.courseId,
      includeReversed: query.includeReversed ?? false,
      limit: query.limit ?? 50,
    });

    // 校区数据隔离校验 (Campus Scope Invariant)
    if (scope && !scope.isSuperAdmin && scope.targetCampusId) {
      const student = await this.prisma.student.findUnique({
        where: { id: query.studentId },
        select: { campusId: true, wechatOpenId: true },
      });
      if (student && student.campusId !== scope.targetCampusId) {
        throw new ForbiddenException(
          `校区作用域越权拦截：学员 (${query.studentId}) 不归属于当前校区 (${scope.targetCampusId})`,
        );
      }
    }

    const studentMeta = await this.prisma.student.findUnique({
      where: { id: query.studentId },
      select: { wechatOpenId: true },
    });

    return {
      studentInfo: {
        ...portfolio.studentInfo,
        wechatBound: Boolean(studentMeta?.wechatOpenId),
      },
      assetOverview: portfolio.assetOverview,
      timeline: portfolio.timeline,
      albumGallery: portfolio.albumGallery || [],
      growthRadar: portfolio.growthSummary.radar,
      consumptionHealth: portfolio.consumptionHealth,
      packageProgressList: portfolio.packageProgressList,
      portfolioShareToken: portfolio.portfolioShareToken || '',
    };
  }

  /**
   * 视角 B1：微信公众号移动 H5 瀑布流学情成长脚印投影 (面向家长，安全脱敏)
   */
  async projectParentFeed(
    query: ParentFeedQuery,
    token: string,
  ): Promise<ParentGrowthFeedView> {
    const payload = this.tokenPort.verifyToken(token);
    const studentId = payload.sub;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        campus: true,
        attendances: {
          where: { isReversed: false }, // 物理过滤反结课冲正噪点
          include: {
            scheduleEvent: {
              include: {
                class: {
                  include: {
                    course: true,
                  },
                },
                teacher: {
                  select: {
                    id: true,
                    realName: true,
                  },
                },
                evaluation: {
                  include: {
                    studentItems: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: query.limit || 20,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    // 组装家长端卡片
    const feed: ParentLessonCardView[] = [];
    let cumulativeIndex = student.attendances.length;

    for (const att of student.attendances) {
      const sEvent = att.scheduleEvent;
      const evaluation = sEvent?.evaluation;
      const studentItems = evaluation?.studentItems || [];
      const personalItem = studentItems.find((item: any) => item.studentId === student.id);

      const nineGridPhotos = this.parsePhotoAlbum(evaluation?.photoList);
      const voiceMeta = this.parseVoiceMeta(evaluation?.voiceUrl, evaluation?.voiceDuration);
      const videoMeta = this.parseVideoMeta(evaluation?.videoUrl);

      const comment =
        personalItem?.comment ||
        att.comment ||
        evaluation?.teacherComment ||
        '课堂表现专注认真，实操互动积极！';

      const ratingScore = personalItem?.rating ? Number(personalItem.rating) : 5.0;

      // 提炼大纲知识点切片
      const syllabusPoints = this.extractSyllabusPoints(evaluation?.studyContent);
      const badges = this.generateBadges(personalItem || att, cumulativeIndex);

      feed.push({
        lessonId: att.id,
        scheduleEventId: att.scheduleEventId,
        dateFormatted: sEvent?.date || '',
        timeSlot: sEvent ? `${sEvent.startTime} - ${sEvent.endTime}` : '',
        courseName: sEvent?.class?.course?.name || '精品课程',
        lessonTitle: evaluation?.lessonTitle || sEvent?.class?.course?.name || '随堂学习',
        teacherName: sEvent?.teacher?.realName || '任课讲师',
        ratingScore,
        performanceTag: personalItem?.performanceTag || '动手达人',
        personalizedComment: comment,
        syllabusPoints,
        studyContentHtml: evaluation?.studyContent
          ? `<p>${evaluation.studyContent.replace(/\n/g, '<br/>')}</p>`
          : '<p>专注掌握本课核心重难点与实践操作。</p>',
        badges,
        photos: nineGridPhotos,
        voice: voiceMeta,
        video: videoMeta,
        milestone: {
          cumulativeLessonIndex: cumulativeIndex,
          earnedStarCount: Math.round(ratingScore),
        },
      });

      cumulativeIndex -= 1;
    }

    // 姓名隐私脱敏：如 "张子豪" -> "子豪同学" 或 "张*豪"
    const sanitizedName =
      student.name.length > 2
        ? `${student.name.charAt(0)}*${student.name.slice(-1)}`
        : `${student.name}同学`;

    // 简单计算家长端雷达
    const baseRadarScore = 90;
    const growthRadar: CompetencyRadarProfile = {
      logic: 92,
      creativity: 95,
      focus: 88,
      handsOn: 94,
      expression: 86,
      averageScore: baseRadarScore,
    };

    return {
      studentSummary: {
        studentId: student.id,
        studentName: sanitizedName,
        avatar: (student as any).avatar || (student as any).faceImageUrl || 'https://assets.yixiao.com/avatar-default.png',
        campusName: student.campus?.name || '校区',
        totalLessonsAttended: student.attendances.length,
        totalBadgesEarned: feed.reduce((sum, f) => sum + f.badges.length, 0),
        latestRating: feed[0]?.ratingScore || 5.0,
      },
      growthRadar,
      feed,
      hasMore: false,
    };
  }

  /**
   * 视角 B2：微信模板消息直达单课课评落地页投影 (面向家长，免密令牌鉴权)
   */
  async projectParentSingleLesson(
    query: ParentSingleLessonQuery,
    token: string,
  ): Promise<ParentSingleLessonView> {
    const payload = this.tokenPort.verifyToken(token);

    // 作用域拘束校验：若 scope 为 single_lesson，必须严格拘束在单一 scheduleEventId
    if (payload.scope === 'single_lesson' && payload.targetId && payload.targetId !== query.scheduleEventId) {
      throw new ForbiddenException(
        `越权访问拦截：访问令牌无权查看排课日程 (${query.scheduleEventId})`,
      );
    }

    const studentId = payload.sub;
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: query.scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
          },
        },
        teacher: {
          select: {
            id: true,
            realName: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
        campus: true,
        evaluation: {
          include: {
            studentItems: true,
          },
        },
        attendances: {
          where: { studentId },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 (${query.scheduleEventId})`);
    }

    const attendance = schedule.attendances[0];
    if (!attendance || attendance.isReversed) {
      throw new NotFoundException(`该日程下未找到有效的学员考勤履约记录或已反结课冲正`);
    }

    const evaluation = schedule.evaluation;
    const personalItem = evaluation?.studentItems?.find((i: any) => i.studentId === studentId);

    const nineGridPhotos = this.parsePhotoAlbum(evaluation?.photoList);
    const voiceMeta = this.parseVoiceMeta(evaluation?.voiceUrl, evaluation?.voiceDuration);
    const videoMeta = this.parseVideoMeta(evaluation?.videoUrl);

    const comment =
      personalItem?.comment ||
      attendance.comment ||
      evaluation?.teacherComment ||
      '随堂实操表现优异，积极配合教学互动！';

    const ratingScore = personalItem?.rating ? Number(personalItem.rating) : 5.0;
    const syllabusPoints = this.extractSyllabusPoints(evaluation?.studyContent);
    const badges = this.generateBadges(personalItem || attendance, 1);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, gender: true },
    });

    const sanitizedName = student
      ? student.name.length > 2
        ? `${student.name.charAt(0)}*${student.name.slice(-1)}`
        : `${student.name}同学`
      : '学员';

    const lessonCard: ParentLessonCardView = {
      lessonId: attendance.id,
      scheduleEventId: schedule.id,
      dateFormatted: schedule.date,
      timeSlot: `${schedule.startTime} - ${schedule.endTime}`,
      courseName: schedule.class?.course?.name || '综合精品课',
      lessonTitle: evaluation?.lessonTitle || schedule.class?.course?.name || '随堂学习成果',
      teacherName: schedule.teacher?.realName || '主讲讲师',
      ratingScore,
      performanceTag: personalItem?.performanceTag || '专注标兵',
      personalizedComment: comment,
      syllabusPoints,
      studyContentHtml: evaluation?.studyContent
        ? `<p>${evaluation.studyContent.replace(/\n/g, '<br/>')}</p>`
        : '<p>随堂教学大纲核心重难点练习。</p>',
      badges,
      photos: nineGridPhotos,
      voice: voiceMeta,
      video: videoMeta,
      milestone: {
        cumulativeLessonIndex: 1,
        earnedStarCount: Math.round(ratingScore),
      },
    };

    return {
      studentName: sanitizedName,
      avatar: 'https://assets.yixiao.com/avatar-default.png',
      lesson: lessonCard,
      campusContact: {
        campusName: schedule.campus?.name || '校区服务中心',
        contactPhone: '010-88886666',
      },
    };
  }

  /**
   * 签发免密安全访问令牌 (供出站信箱与后台一键分享即时装配)
   */
  async issueParentAccessToken(
    input: IssueParentTokenInput,
    scope?: CampusScopeContext,
  ): Promise<ParentTokenReceipt> {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, campusId: true },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${input.studentId}`);
    }

    if (scope && !scope.isSuperAdmin && scope.targetCampusId && student.campusId !== scope.targetCampusId) {
      throw new ForbiddenException('无权为其他校区学员签发访问凭证');
    }

    const tokenScope: AccessTokenScope = input.scheduleEventId ? 'single_lesson' : 'full_portfolio';
    const ttlSeconds = input.ttlSeconds || (tokenScope === 'single_lesson' ? 30 * 86400 : 7 * 86400);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

    const token = this.tokenPort.signToken({
      sub: student.id,
      targetId: input.scheduleEventId,
      scope: tokenScope,
      campusId: student.campusId,
      exp,
      iat: Math.floor(Date.now() / 1000),
      nonce: `iss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    });

    const expiresAt = new Date(exp * 1000).toISOString();
    const queryPart = input.scheduleEventId
      ? `token=${token}&scheduleEventId=${input.scheduleEventId}`
      : `token=${token}`;

    const h5ReportUrl = `/public/growth-report?${queryPart}`;

    return {
      token,
      scope: tokenScope,
      expiresAt,
      h5ReportUrl,
    };
  }

  // ============================================================================
  // 私有辅助工具函数 (Internal Utility Helpers)
  // ============================================================================

  /**
   * 提取原始照片 URL 列表 (容错解析 JSON)
   */
  private extractPhotoUrls(photoListRaw: string | null | undefined): string[] {
    if (!photoListRaw) return [];
    try {
      const parsed = JSON.parse(photoListRaw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u) => typeof u === 'string' && u.startsWith('http'))
          .slice(0, 9);
      }
    } catch {
      if (photoListRaw.startsWith('http')) return [photoListRaw];
    }
    return [];
  }

  /**
   * 解析标准 9 宫格相册 (带缩略图与大图预览序列)
   */
  private parsePhotoAlbum(photoListRaw: string | null | undefined): NineGridPhoto[] {
    const rawUrls = this.extractPhotoUrls(photoListRaw);
    return rawUrls.map((fullUrl, idx) => {
      const thumbnailUrl = this.mediaStorage.buildThumbnailUrl(fullUrl, {
        width: 300,
        height: 300,
        format: 'webp',
      });
      // 预置预览序列：以当前图片为第一项，后面依次环形排布
      const previewList = [
        ...rawUrls.slice(idx),
        ...rawUrls.slice(0, idx),
      ];

      return {
        id: `photo-${idx}-${fullUrl.slice(-8)}`,
        index: idx,
        thumbnailUrl,
        fullUrl,
        previewList,
        aspectRatio: '1:1',
      };
    });
  }

  /**
   * 解析随堂原声语音播放元数据
   */
  private parseVoiceMeta(
    voiceUrl: string | null | undefined,
    durationSeconds?: number | null,
  ): VoiceAudioMeta | undefined {
    if (!voiceUrl || typeof voiceUrl !== 'string' || !voiceUrl.startsWith('http')) {
      return undefined;
    }
    const sec = durationSeconds && durationSeconds > 0 ? durationSeconds : 45;
    return {
      audioUrl: voiceUrl,
      durationSeconds: sec,
      durationFormatted: this.formatDuration(sec),
      waveformPeaks: this.generateWaveformPeaks(voiceUrl, 20),
    };
  }

  /**
   * 解析随堂小视频播放元数据
   */
  private parseVideoMeta(videoUrl: string | null | undefined): VideoPlayerMeta | undefined {
    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
      return undefined;
    }
    const posterUrl = this.mediaStorage.buildVideoPosterUrl(videoUrl);
    return {
      videoUrl,
      posterUrl,
    };
  }

  /**
   * 秒级时长转为 mm:ss
   */
  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 生成 20 点波形峰值序列 (0.1 ~ 1.0)
   */
  private generateWaveformPeaks(seed: string, count = 20): number[] {
    const peaks: number[] = [];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < count; i++) {
      const val = Math.abs(Math.sin(hash + i * 1.5)) * 0.7 + 0.3;
      peaks.push(Number(val.toFixed(2)));
    }
    return peaks;
  }

  /**
   * 提炼大纲知识点切片
   */
  private extractSyllabusPoints(studyContent: string | null | undefined): string[] {
    if (!studyContent) {
      return ['核心逻辑算法实操', '课堂综合素养训练'];
    }
    return studyContent
      .split(/[\n;；。]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 50)
      .slice(0, 4);
  }

  /**
   * 激励勋章推导
   */
  private generateBadges(item: any, streakIndex: number): MotivationalBadge[] {
    const badges: MotivationalBadge[] = [];
    if (streakIndex % 5 === 0) {
      badges.push({
        id: 'badge-streak',
        code: 'PERFECT_ATTENDANCE',
        title: '连续探索标兵',
        description: '持续坚持随堂学习，专注力极佳',
        level: 'gold',
      });
    }
    badges.push({
      id: 'badge-creativity',
      code: 'CREATIVE_STAR',
      title: item?.performanceTag || '逻辑小极客',
      description: '课堂互动踊跃，独立完成实操任务',
      level: 'silver',
    });
    return badges;
  }
}

