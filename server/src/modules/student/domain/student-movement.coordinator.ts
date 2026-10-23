import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseDeliveryEngine } from '../../curriculum/domain/course-delivery.engine';
import { StudentEnrollmentCoordinator } from './student-enrollment.coordinator';
import {
  MovementIntent,
  MovementPreview,
  MovementReceipt,
  MovementType,
  OperatorContext,
  MovementIssue,
} from './student-movement.types';

@Injectable()
export class StudentMovementCoordinator {
  private readonly logger = new Logger(StudentMovementCoordinator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryEngine: CourseDeliveryEngine,
    private readonly enrollmentCoordinator: StudentEnrollmentCoordinator,
  ) {}

  /**
   * 1. 学籍异动零写副作用只读仿真预演 (Dry-Run Preview)
   * 聚合班容实时诊断、跨校区交付授权检查、盛通退费折算、换课钱包差额核算。
   */
  async preview(
    studentId: string,
    intent: MovementIntent,
  ): Promise<MovementPreview> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        wallet: true,
        campus: true,
        packages: {
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    const blockingIssues: MovementIssue[] = [];
    const warnings: MovementIssue[] = [];
    let financialImpact: any = undefined;
    let capacityImpact: any = undefined;
    let requiresApproval = false;
    let approvalStepSummary: string | undefined = undefined;
    const details: Record<string, any> = {};

    // 状态机互斥全局前置核验
    if (student.status === 'dropped_out') {
      blockingIssues.push({
        code: 'STUDENT_DROPPED_OUT',
        severity: 'blocking',
        message: '该学员已结业流失，严禁办理任何学籍异动',
      });
    }

    if (student.status === 'suspended') {
      if (intent.type !== 'resume' && intent.type !== 'refund') {
        blockingIssues.push({
          code: 'STUDENT_SUSPENDED',
          severity: 'blocking',
          message: '学员当前处于停课休学状态，必须先办理复课后方可操作该项异动',
        });
      }
    } else if (intent.type === 'resume') {
      blockingIssues.push({
        code: 'STUDENT_NOT_SUSPENDED',
        severity: 'blocking',
        message: '学员当前处于正常在读状态，无需办理复课',
      });
    }

    switch (intent.type) {
      // ----------------------------------------------------------------------
      // 1. 转班仿真预演
      // ----------------------------------------------------------------------
      case 'transfer_class': {
        const pkg = student.packages.find((p) => p.id === intent.packageId);
        if (!pkg) {
          blockingIssues.push({
            code: 'PACKAGE_NOT_FOUND',
            severity: 'blocking',
            message: '未找到指定转班课包',
          });
        } else if (pkg.status !== 'active') {
          blockingIssues.push({
            code: 'PACKAGE_NOT_ACTIVE',
            severity: 'blocking',
            message: `课包当前状态为 [${pkg.status}]，非有效在读状态，不可办理转班`,
          });
        }

        const targetClass = await this.prisma.class.findUnique({
          where: { id: intent.targetClassId },
        });

        if (!targetClass) {
          blockingIssues.push({
            code: 'TARGET_CLASS_NOT_FOUND',
            severity: 'blocking',
            message: '目标班级不存在',
          });
        } else {
          if (pkg && targetClass.courseId !== pkg.courseId) {
            blockingIssues.push({
              code: 'TARGET_CLASS_COURSE_MISMATCH',
              severity: 'blocking',
              message: `目标班级「${targetClass.name}」所授课程与该课包不一致，跨课程调整请使用「换课」`,
            });
          }
          const willExceed = targetClass.currentStudentCount >= targetClass.capacity;
          capacityImpact = {
            targetClassId: targetClass.id,
            targetClassName: targetClass.name,
            capacity: targetClass.capacity,
            currentCount: targetClass.currentStudentCount,
            afterCount: targetClass.currentStudentCount + 1,
            remainingSlots: Math.max(0, targetClass.capacity - targetClass.currentStudentCount),
            willExceedCapacity: willExceed,
          };

          if (willExceed) {
            blockingIssues.push({
              code: 'CLASS_CAPACITY_EXCEEDED',
              severity: 'blocking',
              message: `目标班级「${targetClass.name}」已达额定人数上限 (${targetClass.currentStudentCount}/${targetClass.capacity}人)，满员严禁转入`,
            });
          }
        }
        break;
      }

      // ----------------------------------------------------------------------
      // 2. 换课仿真预演
      // ----------------------------------------------------------------------
      case 'change_course': {
        const pkg = student.packages.find((p) => p.id === intent.packageId);
        if (!pkg) {
          blockingIssues.push({
            code: 'PACKAGE_NOT_FOUND',
            severity: 'blocking',
            message: '未找到指定原课包',
          });
        } else if (pkg.status !== 'active') {
          blockingIssues.push({
            code: 'PACKAGE_NOT_ACTIVE',
            severity: 'blocking',
            message: '原课包非有效在读状态，不可换课',
          });
        }

        const targetCourse = await this.prisma.course.findUnique({
          where: { id: intent.targetCourseId },
        });

        if (!targetCourse) {
          blockingIssues.push({
            code: 'TARGET_COURSE_NOT_FOUND',
            severity: 'blocking',
            message: '目标课程不存在',
          });
        } else if (targetCourse.status === 'disabled') {
          blockingIssues.push({
            code: 'TARGET_COURSE_DISABLED',
            severity: 'blocking',
            message: `目标课程「${targetCourse.name}」处于停用状态，不可换入`,
          });
        }

        if (pkg && targetCourse) {
          const paidRemaining = Math.max(0, pkg.remainingLessons - pkg.bonusLessons);
          const oldResidualValue = paidRemaining * pkg.pricePerLesson;
          const newLessons =
            intent.newPurchasedLessons && intent.newPurchasedLessons > 0
              ? intent.newPurchasedLessons
              : Math.max(1, Math.floor(oldResidualValue / targetCourse.pricePerLesson));
          const newTotalCost = newLessons * targetCourse.pricePerLesson;
          const netDiff = oldResidualValue - newTotalCost;

          financialImpact = {
            sourceResidualValue: oldResidualValue,
            targetRequiredAmount: newTotalCost,
            netDiffAmount: netDiff,
          };

          if (netDiff < 0) {
            const needed = Math.abs(netDiff);
            const principal = student.wallet?.principalBalance || 0;
            if (principal < needed) {
              warnings.push({
                code: 'INSUFFICIENT_WALLET_BALANCE',
                severity: 'warning',
                message: `换课需补交差额 ¥${needed}，当前电子钱包本金余额为 ¥${principal}`,
              });
            }
          }
        }
        break;
      }

      // ----------------------------------------------------------------------
      // 3. 停课 / 休学仿真预演
      // ----------------------------------------------------------------------
      case 'suspend': {
        const days = intent.suspendDays || 30;
        const activePkgs = student.packages.filter((p) => p.status === 'active');
        details.suspendDays = days;
        details.affectedPackagesCount = activePkgs.length;
        if (activePkgs.length === 0) {
          warnings.push({
            code: 'NO_ACTIVE_PACKAGES',
            severity: 'warning',
            message: '学员名下暂无可冻结的有效课包',
          });
        }
        break;
      }

      // ----------------------------------------------------------------------
      // 4. 复课仿真预演
      // ----------------------------------------------------------------------
      case 'resume': {
        const frozenPkgs = student.packages.filter((p) => p.status === 'frozen');
        const lastSuspend = await this.prisma.studentAbnormalMovement.findFirst({
          where: { studentId: student.id, type: 'suspend' },
          orderBy: { createdAt: 'desc' },
        });
        let daysToExtend = intent.extendExpiryDays;
        if (!daysToExtend && lastSuspend?.targetData) {
          try {
            const parsed =
              typeof lastSuspend.targetData === 'string'
                ? JSON.parse(lastSuspend.targetData)
                : lastSuspend.targetData;
            daysToExtend = parsed?.suspendDays;
          } catch {}
        }
        if (!daysToExtend) daysToExtend = 30;
        details.extendedDays = daysToExtend;
        details.unfrozenPackagesCount = frozenPkgs.length;
        break;
      }

      // ----------------------------------------------------------------------
      // 5. 转校仿真预演
      // ----------------------------------------------------------------------
      case 'transfer_campus': {
        if (intent.targetCampusId === student.campusId) {
          blockingIssues.push({
            code: 'SAME_CAMPUS',
            severity: 'blocking',
            message: '目标校区与当前所属校区相同，无需办理转校',
          });
        }

        const targetCampus = await this.prisma.campus.findUnique({
          where: { id: intent.targetCampusId },
        });
        if (!targetCampus) {
          blockingIssues.push({
            code: 'CAMPUS_NOT_FOUND',
            severity: 'blocking',
            message: '目标校区不存在',
          });
        } else {
          // 预检跨校区交付资质
          try {
            await this.deliveryEngine.assertTransferEligibility(
              student.id,
              intent.targetCampusId,
            );
          } catch (err: any) {
            blockingIssues.push({
              code: 'DELIVERY_UNAUTHORIZED',
              severity: 'blocking',
              message: err.message,
            });
          }
        }
        break;
      }

      // ----------------------------------------------------------------------
      // 6. 学员资产转让仿真预演
      // ----------------------------------------------------------------------
      case 'transfer_student': {
        if (intent.targetStudentId === student.id) {
          blockingIssues.push({
            code: 'SELF_TRANSFER_PROHIBITED',
            severity: 'blocking',
            message: '严禁将资产转让给自身',
          });
        }

        const targetStudent = await this.prisma.student.findUnique({
          where: { id: intent.targetStudentId },
          include: { wallet: true },
        });

        if (!targetStudent) {
          blockingIssues.push({
            code: 'TARGET_STUDENT_NOT_FOUND',
            severity: 'blocking',
            message: '受让目标学员不存在',
          });
        } else if (targetStudent.status === 'dropped_out') {
          blockingIssues.push({
            code: 'TARGET_STUDENT_DROPPED_OUT',
            severity: 'blocking',
            message: '受让目标学员已结业流失，无法接收资产转让',
          });
        }

        const activePkgs = student.packages.filter((p) => p.status === 'active');
        if (intent.packageId) {
          const pkg = student.packages.find((p) => p.id === intent.packageId);
          if (!pkg || pkg.status !== 'active') {
            blockingIssues.push({
              code: 'PACKAGE_NOT_ACTIVE',
              severity: 'blocking',
              message: '选定的转让课包不存在或非有效状态',
            });
          }
        } else if (activePkgs.length === 0) {
          warnings.push({
            code: 'NO_PACKAGES_TO_TRANSFER',
            severity: 'warning',
            message: '学员当前无有效在读课包可移交',
          });
        }

        financialImpact = {
          sourceResidualValue:
            (student.wallet?.principalBalance || 0) + (student.wallet?.bonusBalance || 0),
          targetRequiredAmount: 0,
          netDiffAmount: 0,
          walletBalanceAfter: { principal: 0, bonus: 0 },
        };
        break;
      }

      // ----------------------------------------------------------------------
      // 7. 退费仿真预演
      // ----------------------------------------------------------------------
      case 'refund': {
        const pkg = student.packages.find((p) => p.id === intent.packageId);
        if (!pkg) {
          blockingIssues.push({
            code: 'PACKAGE_NOT_FOUND',
            severity: 'blocking',
            message: '未找到指定退费课包',
          });
        } else if (pkg.status === 'refunded') {
          blockingIssues.push({
            code: 'PACKAGE_ALREADY_REFUNDED',
            severity: 'blocking',
            message: '该课包已处于退费状态，严禁重复发起退费',
          });
        } else {
          // 盛通核心退费公式仿真
          const bonus = pkg.bonusLessons || 0;
          const purchasedRegular = Math.max(0, pkg.totalLessons - bonus);
          const consumed = Math.max(0, pkg.totalLessons - pkg.remainingLessons);
          const paidRemaining = Math.max(0, pkg.remainingLessons - bonus);
          const fee = intent.deductionFee || 0;

          let clawback = 0;
          if (consumed > purchasedRegular) {
            clawback = (consumed - purchasedRegular) * pkg.pricePerLesson;
          }

          let refundable = Math.max(
            0,
            paidRemaining * pkg.pricePerLesson - clawback - fee,
          );

          if (intent.customRefundAmount !== undefined) {
            refundable = intent.customRefundAmount;
          }

          financialImpact = {
            sourceResidualValue: paidRemaining * pkg.pricePerLesson,
            targetRequiredAmount: 0,
            netDiffAmount: refundable,
            refundableCashAmount: refundable,
            clawbackAmount: clawback,
            deductionFee: fee,
          };

          requiresApproval = true;
          approvalStepSummary = '1:教学核实 -> 2:校长审批 -> 3:财务终审';
        }
        break;
      }
    }

    return {
      success: true,
      canExecute: blockingIssues.length === 0,
      type: intent.type,
      studentId: student.id,
      studentName: student.name,
      blockingIssues,
      warnings,
      financialImpact,
      capacityImpact,
      requiresApproval,
      approvalStepSummary,
      details,
    };
  }

  /**
   * 2. 原子事务落盘执行学员学籍异动 (Atomic Execution)
   * 单一 $transaction 内部完成：行锁校验、班容并发调度、课包生命周期变迁、资金流水、三级审批流与不可变快照审计。
   */
  async execute(
    studentId: string,
    intent: MovementIntent,
    operator: OperatorContext = {},
  ): Promise<MovementReceipt> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        wallet: true,
        campus: true,
        packages: {
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    if (student.status === 'dropped_out') {
      throw new BadRequestException('该学员已结业流失，严禁办理任何学籍异动');
    }

    // 状态机互斥全局阻断
    if (student.status === 'suspended') {
      if (intent.type !== 'resume' && intent.type !== 'refund') {
        throw new BadRequestException('学员当前处于停课休学状态，禁止执行该异动，请先办理复课');
      }
    } else if (intent.type === 'resume') {
      throw new BadRequestException('学员当前处于正常在读状态，无需复课');
    }

    const opName = operator.operatorName || '教务主管';

    return this.prisma.$transaction(async (tx) => {
      let originalSnapshot: Record<string, any> = {};
      let targetSnapshot: Record<string, any> = {};
      let orderId: string | undefined = undefined;
      let orderNo: string | undefined = undefined;
      let approvalFlowId: string | undefined = undefined;
      let computedRefundAmount: number | undefined = undefined;
      let summaryText = '';

      switch (intent.type) {
        // ----------------------------------------------------------------------
        // 1. 转班执行 (Transfer Class)
        // ----------------------------------------------------------------------
        case 'transfer_class': {
          if (!intent.packageId || !intent.targetClassId) {
            throw new BadRequestException('转班必须指定源课包 ID 与目标班级 ID');
          }
          const pkg = student.packages.find((p) => p.id === intent.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ID: ${intent.packageId}`);
          }
          if (pkg.status !== 'active') {
            throw new BadRequestException(`课包状态为 [${pkg.status}]，非有效在读状态，严禁转班`);
          }

          const targetClass = await tx.class.findUnique({
            where: { id: intent.targetClassId },
          });
          if (!targetClass) {
            throw new NotFoundException(`目标班级不存在 (ID: ${intent.targetClassId})`);
          }

          // 转班仅限同课程班级：点名扣课按「班级课程 = 课包课程」匹配，课程不一致会导致上课不扣课时
          if (targetClass.courseId !== pkg.courseId) {
            throw new BadRequestException(
              `目标班级「${targetClass.name}」所授课程与该课包不一致，跨课程调整请使用「换课」`,
            );
          }
          // 班容硬顶强阻断不变量 (Capacity Ceiling)
          if (targetClass.currentStudentCount >= targetClass.capacity) {
            throw new BadRequestException(
              `目标班级「${targetClass.name}」已达额定人数上限 (${targetClass.capacity}人)，满员严禁转入`,
            );
          }

          originalSnapshot = {
            classId: pkg.classId,
            className: pkg.class?.name || '未分班',
            remainingLessons: pkg.remainingLessons,
          };
          targetSnapshot = {
            classId: targetClass.id,
            className: targetClass.name,
            currentStudentCount: targetClass.currentStudentCount + 1,
          };

          // 原班级人数原子递减 (若存在原班级)
          if (pkg.classId) {
            await tx.class.update({
              where: { id: pkg.classId },
              data: { currentStudentCount: { decrement: 1 } },
            });
          }

          // 目标班级人数原子递增
          await tx.class.update({
            where: { id: targetClass.id },
            data: { currentStudentCount: { increment: 1 } },
          });

          // 课包更新归属班级
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { classId: targetClass.id },
          });

          summaryText = `学员已由「${originalSnapshot.className}」成功转入「${targetClass.name}」，班级人数更新为 ${targetClass.currentStudentCount + 1}/${targetClass.capacity} 人`;
          break;
        }

        // ----------------------------------------------------------------------
        // 2. 换课执行 (Change Course)
        // ----------------------------------------------------------------------
        case 'change_course': {
          if (!intent.packageId || !intent.targetCourseId) {
            throw new BadRequestException('换课必须指定源课包 ID 与目标课程 ID');
          }
          const pkg = student.packages.find((p) => p.id === intent.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ID: ${intent.packageId}`);
          }
          if (pkg.status !== 'active') {
            throw new BadRequestException(`原课包状态为 [${pkg.status}]，非有效在读状态，严禁换课`);
          }

          const targetCourse = await tx.course.findUnique({
            where: { id: intent.targetCourseId },
          });
          if (!targetCourse) {
            throw new NotFoundException(`目标课程不存在 (ID: ${intent.targetCourseId})`);
          }
          if (targetCourse.status === 'disabled') {
            throw new BadRequestException(`目标课程「${targetCourse.name}」处于停用状态，严禁换入`);
          }

          // 盛通规则折算：扣减赠课，仅按实付正课折现净值
          const paidRemaining = Math.max(0, pkg.remainingLessons - pkg.bonusLessons);
          const oldResidualValue = paidRemaining * pkg.pricePerLesson;
          const newLessons =
            intent.newPurchasedLessons && intent.newPurchasedLessons > 0
              ? intent.newPurchasedLessons
              : Math.max(1, Math.floor(oldResidualValue / targetCourse.pricePerLesson));
          const newTotalCost = newLessons * targetCourse.pricePerLesson;
          const netDiff = oldResidualValue - newTotalCost;

          originalSnapshot = {
            courseId: pkg.courseId,
            courseName: pkg.course.name,
            remainingLessons: pkg.remainingLessons,
            bonusLessons: pkg.bonusLessons,
            oldResidualValue,
          };
          targetSnapshot = {
            courseId: targetCourse.id,
            courseName: targetCourse.name,
            newLessons,
            newTotalCost,
            netDiff,
          };

          // 释放原班级名额
          if (pkg.classId) {
            await tx.class.update({
              where: { id: pkg.classId },
              data: { currentStudentCount: { decrement: 1 } },
            });
          }

          // 原课包完结归档
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { status: 'completed', remainingLessons: 0, classId: null },
          });

          // 开辟目标课程新课包 (有效期 1 年)
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          const newPkg = await tx.studentCoursePackage.create({
            data: {
              studentId: student.id,
              courseId: targetCourse.id,
              totalLessons: newLessons,
              remainingLessons: newLessons,
              consumedLessons: 0,
              bonusLessons: 0,
              pricePerLesson: targetCourse.pricePerLesson,
              expiryDate,
              status: 'active',
            },
          });

          // 差额多退少补联动电子钱包
          if (netDiff > 0) {
            // 原净值高于新课总价，差额退回钱包本金
            const wallet = await tx.studentWallet.upsert({
              where: { studentId: student.id },
              create: {
                studentId: student.id,
                principalBalance: netDiff,
                bonusBalance: 0,
              },
              update: {
                principalBalance: { increment: netDiff },
              },
            });

            await tx.walletLedger.create({
              data: {
                studentId: student.id,
                type: 'recharge',
                amount: netDiff,
                principalChange: netDiff,
                bonusChange: 0,
                description: `换课学费净值差额退还本金: [${pkg.course.name}] -> [${targetCourse.name}]`,
                operator: opName,
              },
            });
          } else if (netDiff < 0) {
            // 原净值不足，自电子钱包本金扣减补齐
            const needed = Math.abs(netDiff);
            const principal = student.wallet?.principalBalance || 0;
            if (principal >= needed) {
              await tx.studentWallet.update({
                where: { studentId: student.id },
                data: { principalBalance: { decrement: needed } },
              });

              await tx.walletLedger.create({
                data: {
                  studentId: student.id,
                  type: 'consumption',
                  amount: needed,
                  principalChange: -needed,
                  bonusChange: 0,
                  description: `换课补交差额: [${pkg.course.name}] -> [${targetCourse.name}]`,
                  operator: opName,
                },
              });
            }
          }

          summaryText = `换课办理成功！原课程 [${pkg.course.name}] 已结算，开辟新课程 [${targetCourse.name}] 共 ${newLessons} 课时${
            netDiff > 0 ? `，差额 ¥${netDiff.toFixed(2)} 已退回电子钱包本金` : ''
          }`;
          break;
        }

        // ----------------------------------------------------------------------
        // 3. 停课 / 休学执行 (Suspend)
        // ----------------------------------------------------------------------
        case 'suspend': {
          const days = intent.suspendDays || 30;
          originalSnapshot = { studentStatus: student.status };
          targetSnapshot = { studentStatus: 'suspended', suspendDays: days };

          await tx.student.update({
            where: { id: student.id },
            data: { status: 'suspended' },
          });

          // 冻结名下所有 active 课包
          await tx.studentCoursePackage.updateMany({
            where: { studentId: student.id, status: 'active' },
            data: { status: 'frozen' },
          });

          summaryText = `学员已成功转为停课休学状态，名下在读课包已全部冻结，有效期将顺延 ${days} 天`;
          break;
        }

        // ----------------------------------------------------------------------
        // 4. 复课执行 (Resume)
        // ----------------------------------------------------------------------
        case 'resume': {
          const lastSuspend = await tx.studentAbnormalMovement.findFirst({
            where: { studentId: student.id, type: 'suspend' },
            orderBy: { createdAt: 'desc' },
          });
          let daysToExtend = intent.extendExpiryDays;
          if (!daysToExtend && lastSuspend?.targetData) {
            try {
              const parsed =
                typeof lastSuspend.targetData === 'string'
                  ? JSON.parse(lastSuspend.targetData)
                  : lastSuspend.targetData;
              daysToExtend = parsed?.suspendDays;
            } catch {}
          }
          if (!daysToExtend) daysToExtend = 30;

          originalSnapshot = { studentStatus: student.status };
          targetSnapshot = { studentStatus: 'normal', extendedDays: daysToExtend };

          await tx.student.update({
            where: { id: student.id },
            data: { status: 'normal' },
          });

          // 恢复冻结课包为 active 并精准顺延有效期
          const frozenPkgs = await tx.studentCoursePackage.findMany({
            where: { studentId: student.id, status: 'frozen' },
          });

          for (const p of frozenPkgs) {
            const currentExpiry = p.expiryDate ? new Date(p.expiryDate) : new Date();
            currentExpiry.setDate(currentExpiry.getDate() + daysToExtend);
            await tx.studentCoursePackage.update({
              where: { id: p.id },
              data: { status: 'active', expiryDate: currentExpiry },
            });
          }

          summaryText = `学员已成功恢复正常在读状态，${frozenPkgs.length} 个冻结课包已全部解冻，到期日统一顺延 ${daysToExtend} 天`;
          break;
        }

        // ----------------------------------------------------------------------
        // 5. 转校执行 (Transfer Campus)
        // ----------------------------------------------------------------------
        case 'transfer_campus': {
          if (!intent.targetCampusId) {
            throw new BadRequestException('跨校区转移必须指定目标校区 ID');
          }
          if (intent.targetCampusId === student.campusId) {
            throw new BadRequestException('目标校区与当前所属校区相同，无需办理转校');
          }

          const targetCampus = await tx.campus.findUnique({
            where: { id: intent.targetCampusId },
          });
          if (!targetCampus) {
            throw new NotFoundException(`目标校区不存在 (ID: ${intent.targetCampusId})`);
          }

          // 跨校区交付资质核验：核验学员名下所有有效课包在目标校区是否全部具备交付授权
          await this.deliveryEngine.assertTransferEligibility(
            student.id,
            intent.targetCampusId,
          );

          originalSnapshot = { campusId: student.campusId, campusName: student.campus?.name };
          targetSnapshot = { campusId: targetCampus.id, campusName: targetCampus.name };

          // 学员归属校区迁移
          await tx.student.update({
            where: { id: student.id },
            data: { campusId: targetCampus.id },
          });

          // 安全解绑原校区班级并释放原班级人数，避免跨校区班级悬挂
          for (const pkg of student.packages) {
            if (pkg.classId && pkg.class && pkg.class.campusId !== targetCampus.id) {
              await tx.class.update({
                where: { id: pkg.classId },
                data: { currentStudentCount: { decrement: 1 } },
              });
              await tx.studentCoursePackage.update({
                where: { id: pkg.id },
                data: { classId: null },
              });
            }
          }

          summaryText = `转校办理成功！学员已正式转入「${targetCampus.name}」，已核验课包在目标校区均具备交付资质`;
          break;
        }

        // ----------------------------------------------------------------------
        // 6. 学员资产转让执行 (Transfer Student)
        // ----------------------------------------------------------------------
        case 'transfer_student': {
          if (!intent.targetStudentId) {
            throw new BadRequestException('转让资产必须指定受让学员 ID');
          }
          if (intent.targetStudentId === student.id) {
            throw new BadRequestException('严禁将资产转让给自身');
          }

          const targetStudent = await tx.student.findUnique({
            where: { id: intent.targetStudentId },
            include: { wallet: true },
          });
          if (!targetStudent) {
            throw new NotFoundException(`受让目标学员不存在 (ID: ${intent.targetStudentId})`);
          }
          if (targetStudent.status === 'dropped_out') {
            throw new BadRequestException('受让学员已结业流失，无法接收资产转让');
          }

          const transferWallet = intent.transferWallet !== false;
          let transferredLessons = 0;
          let transferredCount = 0;

          if (intent.packageId) {
            const pkg = student.packages.find((p) => p.id === intent.packageId);
            if (!pkg) {
              throw new NotFoundException(`学员未持有课包 ID: ${intent.packageId}`);
            }
            if (pkg.status !== 'active') {
              throw new BadRequestException('指定的转让课包非有效在读状态');
            }

            if (pkg.classId) {
              await tx.class.update({
                where: { id: pkg.classId },
                data: { currentStudentCount: { decrement: 1 } },
              });
            }

            await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: { studentId: targetStudent.id, classId: null },
            });
            transferredLessons = pkg.remainingLessons;
            transferredCount = 1;
          } else {
            const activePackages = student.packages.filter((p) => p.status === 'active');
            if (activePackages.length === 0) {
              throw new BadRequestException('学员暂无有效课包可转让');
            }

            for (const pkg of activePackages) {
              if (pkg.classId) {
                await tx.class.update({
                  where: { id: pkg.classId },
                  data: { currentStudentCount: { decrement: 1 } },
                });
              }
              transferredLessons += pkg.remainingLessons;
            }

            await tx.studentCoursePackage.updateMany({
              where: { studentId: student.id, status: 'active' },
              data: { studentId: targetStudent.id, classId: null },
            });
            transferredCount = activePackages.length;
          }

          // 电子钱包本金与赠送金全额划转
          let principal = 0;
          let bonus = 0;
          if (transferWallet && student.wallet) {
            principal = student.wallet.principalBalance || 0;
            bonus = student.wallet.bonusBalance || 0;
            const totalBalance = principal + bonus;

            if (totalBalance > 0) {
              // 1. 出让学员钱包清零并记负向流水
              await tx.studentWallet.update({
                where: { studentId: student.id },
                data: { principalBalance: 0, bonusBalance: 0 },
              });

              await tx.walletLedger.create({
                data: {
                  studentId: student.id,
                  type: 'consumption',
                  amount: totalBalance,
                  principalChange: -principal,
                  bonusChange: -bonus,
                  description: `学员资产过户转出至 [${targetStudent.name} (${targetStudent.studentNo})]`,
                  operator: opName,
                },
              });

              // 2. 受让学员钱包累加并记正向流水
              await tx.studentWallet.upsert({
                where: { studentId: targetStudent.id },
                create: {
                  studentId: targetStudent.id,
                  principalBalance: principal,
                  bonusBalance: bonus,
                },
                update: {
                  principalBalance: { increment: principal },
                  bonusBalance: { increment: bonus },
                },
              });

              await tx.walletLedger.create({
                data: {
                  studentId: targetStudent.id,
                  type: 'recharge',
                  amount: totalBalance,
                  principalChange: principal,
                  bonusChange: bonus,
                  description: `接收来自学员 [${student.name} (${student.studentNo})] 的过户资产`,
                  operator: opName,
                },
              });
            }
          }

          originalSnapshot = {
            fromStudentId: student.id,
            fromStudentName: student.name,
            transferredCount,
            transferredLessons,
            transferredPrincipal: principal,
            transferredBonus: bonus,
          };
          targetSnapshot = {
            toStudentId: targetStudent.id,
            toStudentName: targetStudent.name,
          };

          summaryText = `资产转让成功！已向 [${targetStudent.name}] 移交 ${transferredCount} 个课包 (${transferredLessons} 课时)${
            principal + bonus > 0 ? ` 与钱包资金 ¥${(principal + bonus).toFixed(2)}` : ''
          }`;
          break;
        }

        // ----------------------------------------------------------------------
        // 7. 退费执行 (Refund)
        // ----------------------------------------------------------------------
        case 'refund': {
          if (!intent.packageId) {
            throw new BadRequestException('退费操作必须指定对应课包 ID');
          }
          const pkg = student.packages.find((p) => p.id === intent.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ID: ${intent.packageId}`);
          }
          if (pkg.status === 'refunded') {
            throw new BadRequestException('该课包已处于退费状态，严禁重复发起退费');
          }

          // 盛通核心退费公式
          const bonus = pkg.bonusLessons || 0;
          const purchasedRegular = Math.max(0, pkg.totalLessons - bonus);
          const consumed = Math.max(0, pkg.totalLessons - pkg.remainingLessons);
          const paidRemaining = Math.max(0, pkg.remainingLessons - bonus);
          const fee = intent.deductionFee || 0;

          let clawback = 0;
          if (consumed > purchasedRegular) {
            clawback = (consumed - purchasedRegular) * pkg.pricePerLesson;
          }

          let refundable = Math.max(
            0,
            paidRemaining * pkg.pricePerLesson - clawback - fee,
          );

          if (intent.customRefundAmount !== undefined) {
            refundable = intent.customRefundAmount;
          }
          computedRefundAmount = refundable;

          // 释放原班级名额
          if (pkg.classId) {
            await tx.class.update({
              where: { id: pkg.classId },
              data: { currentStudentCount: { decrement: 1 } },
            });
          }

          // 课包置为 refunded 并清空可用课时
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { status: 'refunded', remainingLessons: 0, classId: null },
          });

          // 生成退费单据 Order (orderType: refund)
          const orderDateStr = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '');
          const randomSuffix = `${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
          orderNo = `REF-${orderDateStr}-${randomSuffix}`;

          const refundOrder = await tx.order.create({
            data: {
              campusId: student.campusId,
              studentId: student.id,
              packageId: pkg.id,
              orderNo,
              orderType: 'refund',
              status: 'unpaid',
              originalPrice: refundable,
              discountAmount: 0,
              couponAmount: 0,
              receivableAmount: -refundable,
              actualAmount: -refundable,
              paymentMethod: 'bank_transfer',
              creatorId: operator.operatorId || student.id,
              ownerId: operator.operatorId || student.id,
              channel: 'ground',
              deliveryStatus: 'none',
              remark: `盛通退费单据 (课包ID: ${pkg.id}) - 手续费扣除: ¥${fee}, 赠课超额扣减: ¥${clawback}`,
              payTime: null,
            },
          });
          orderId = refundOrder.id;

          // 自动登记三级风控审批工单 (当前处于第 1 级教学核实)
          const flow = await tx.approvalFlow.create({
            data: {
              orderId: refundOrder.id,
              businessType: 'refund',
              currentStep: 1,
              totalSteps: 3,
              status: 'pending',
              applicantName: opName,
            },
          });
          approvalFlowId = flow.id;

          originalSnapshot = {
            packageId: pkg.id,
            remainingLessons: pkg.remainingLessons,
            // 驳回退费时据此原样复原课包状态与班级席位
            status: pkg.status,
            classId: pkg.classId,
            bonusLessons: pkg.bonusLessons,
            pricePerLesson: pkg.pricePerLesson,
            computedRefundAmount: refundable,
          };
          targetSnapshot = {
            refundStatus: 'refunded',
            refundAmount: refundable,
            orderId: refundOrder.id,
            approvalFlowId: flow.id,
          };

          summaryText = `退费工单已成功发起！实退金额核算为 ¥${refundable.toFixed(2)}，退费订单 ${orderNo} 已提交至三级风控审批流程`;
          break;
        }

        default:
          throw new BadRequestException(`不支持的异动类型: ${(intent as any).type}`);
      }

      // 统一持久化异动审计日志 (StudentAbnormalMovement)
      const movement = await tx.studentAbnormalMovement.create({
        data: {
          studentId: student.id,
          type: intent.type,
          reasonCategory: intent.reasonCategory || '学业或家庭调整',
          reasonDetail: intent.reasonDetail || '',
          status: intent.type === 'refund' ? 'pending' : 'approved',
          auditStep: intent.type === 'refund' ? 1 : 3,
          originalData: JSON.stringify(originalSnapshot),
          targetData: JSON.stringify(targetSnapshot),
        },
      });

      return {
        success: true,
        movementId: movement.id,
        type: intent.type,
        studentId: student.id,
        studentName: student.name,
        executedAt: new Date().toISOString(),
        status: intent.type === 'refund' ? 'pending_approval' : 'effective',
        orderId,
        orderNo,
        approvalFlowId,
        computedRefundAmount,
        summaryText,
        snapshot: {
          before: originalSnapshot,
          after: targetSnapshot,
        },
        originalData: originalSnapshot,
        targetData: targetSnapshot,
      };
    });
  }
}
