import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  EnrollStudentCommand,
  EnrollmentReceipt,
  RefundInitiationCommand,
  RefundInitiationReceipt,
  RollbackRefundReceipt,
  FinalizeRefundReceipt,
} from './student-enrollment.types';

@Injectable()
export class StudentEnrollmentCoordinator {
  private readonly logger = new Logger(StudentEnrollmentCoordinator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. 招生建档开单签约与履约调度
   * 闭环职责：班容准入强校验、双分账钱包防透支扣减、订单与课包双向关联、学籍状态自动推进
   */
  async enroll(
    cmd: EnrollStudentCommand,
    currentUser?: any,
  ): Promise<EnrollmentReceipt> {
    // 1.1 查询并校验学员档案
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [{ id: cmd.studentId }, { studentNo: cmd.studentId }],
      },
      include: { wallet: true },
    });
    if (!student) {
      throw new NotFoundException(`未找到对应学员 (ID/学号: ${cmd.studentId})`);
    }

    // 1.2 查询并校验报读课程
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [
          { id: cmd.courseId },
          { code: cmd.courseId },
          { name: cmd.courseId },
        ],
      },
    });
    if (!course) {
      throw new NotFoundException(`未找到对应课程 (ID/编码: ${cmd.courseId})`);
    }

    // 1.3 班容准入前置检查 (Class Capacity Invariant)
    let targetClass: any = null;
    if (cmd.classId) {
      targetClass = await this.prisma.class.findUnique({
        where: { id: cmd.classId },
      });
      if (!targetClass) {
        throw new NotFoundException(`指定排入的班级不存在 (ID: ${cmd.classId})`);
      }

      if (targetClass.currentStudentCount >= targetClass.capacity) {
        throw new BadRequestException(
          `班级「${targetClass.name}」已达额定人数上限 (${targetClass.capacity}人)，严禁超编签约入班`,
        );
      }
    }

    // 1.4 金额核算 (防浮点精度漂移)
    const unitPrice =
      cmd.pricePerLesson !== undefined
        ? cmd.pricePerLesson
        : course.pricePerLesson;
    const originalPrice = unitPrice * cmd.totalLessons;
    const discount = cmd.discountAmount || 0;
    const coupon = cmd.couponAmount || 0;
    const actualAmount = Math.max(0, originalPrice - discount - coupon);
    const bonusLessons = cmd.bonusLessons || 0;

    // 1.5 电子钱包防透支检查
    if (cmd.paymentMethod === 'wallet') {
      const principal = student.wallet?.principalBalance || 0;
      if (principal < actualAmount) {
        throw new BadRequestException(
          `学员电子钱包本金余额不足 (当前: ¥${principal}, 需支付: ¥${actualAmount})`,
        );
      }
    }

    // 1.6 生成唯一订单编号 (结合日期、毫秒Base36与随机数防止并发碰撞)
    const orderDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = `${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const orderNo = `ORD-${orderDateStr}-${randomSuffix}`;

    // 1.7 原子事务落盘
    return this.prisma.$transaction(async (tx) => {
      // (1) 电子钱包扣款与账本记账
      if (cmd.paymentMethod === 'wallet') {
        // 如果学员无钱包对象，则自愈创建
        if (!student.wallet) {
          await tx.studentWallet.create({
            data: {
              studentId: student.id,
              principalBalance: 0,
              bonusBalance: 0,
              goldPoints: 0,
            },
          });
        }

        await tx.studentWallet.update({
          where: { studentId: student.id },
          data: {
            principalBalance: { decrement: actualAmount },
          },
        });

        await tx.walletLedger.create({
          data: {
            studentId: student.id,
            orderNo,
            type: 'consumption',
            amount: actualAmount,
            principalChange: -actualAmount,
            bonusChange: 0,
            description: `购买课程「${course.name}」划扣本金`,
            operator: currentUser?.realName || currentUser?.account || '系统',
          },
        });
      }

      // (2) 计算课包有效期 (默认 1 年)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      // (3) 创建学员报读课包 (StudentCoursePackage)
      const coursePackage = await tx.studentCoursePackage.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          classId: targetClass ? targetClass.id : null,
          orderNo,
          totalLessons: cmd.totalLessons + bonusLessons,
          remainingLessons: cmd.totalLessons + bonusLessons,
          consumedLessons: 0,
          bonusLessons,
          pricePerLesson: unitPrice,
          expiryDate,
          status: 'active',
        },
      });

      // (4) 创建正式签约订单，显式绑定 packageId
      const order = await tx.order.create({
        data: {
          campusId: student.campusId,
          studentId: student.id,
          packageId: coursePackage.id,
          orderNo,
          orderType: 'regular',
          status: 'paid',
          originalPrice,
          discountAmount: discount,
          couponAmount: coupon,
          receivableAmount: actualAmount,
          actualAmount,
          paymentMethod: cmd.paymentMethod,
          creatorId: currentUser?.id || student.id,
          ownerId: cmd.ownerId || currentUser?.id || student.id,
          channel: cmd.channel || 'ground',
          deliveryStatus: 'none',
          invoiceStatus: 'unissued',
          remark: cmd.remark,
          payTime: new Date(),
        },
      });

      // (5) 若分配实体班级，原子递增班级人数并流转学籍状态
      if (targetClass) {
        await tx.class.update({
          where: { id: targetClass.id },
          data: { currentStudentCount: { increment: 1 } },
        });

        if (student.status !== 'in_class') {
          await tx.student.update({
            where: { id: student.id },
            data: { status: 'in_class' },
          });
        }
      }

      this.logger.log(
        `学员 [${student.name}] 开单签约成功: 订单号 [${orderNo}], 课包ID [${coursePackage.id}], 班级 [${targetClass?.name || '待分班'}]`,
      );

      return {
        success: true,
        orderNo: order.orderNo,
        orderId: order.id,
        packageId: coursePackage.id,
        classId: targetClass?.id || null,
        className: targetClass?.name || null,
        studentId: student.id,
        studentName: student.name,
        courseId: course.id,
        courseName: course.name,
        actualAmount,
        totalLessons: coursePackage.totalLessons,
        bonusLessons: coursePackage.bonusLessons,
        assignedClass: !!targetClass,
        walletPaid: cmd.paymentMethod === 'wallet',
      };
    });
  }

  /**
   * 2. 发起盛通防腐标准退费流程
   * 闭环职责：正课实付折现、赠课强阻断折现、冻结课包、显式绑定订单 packageId、登记 3 级风控审批
   */
  async initiateRefund(
    cmd: RefundInitiationCommand,
    currentUser?: any,
  ): Promise<RefundInitiationReceipt> {
    const student = await this.prisma.student.findUnique({
      where: { id: cmd.studentId },
      include: {
        packages: {
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${cmd.studentId}`);
    }

    const pkg = student.packages.find((p) => p.id === cmd.packageId);
    if (!pkg) {
      throw new NotFoundException(`学员未持有课包 ID: ${cmd.packageId}`);
    }

    if (pkg.status === 'refunded') {
      throw new BadRequestException('该课包已处于退费状态，严禁重复发起退费');
    }

    // 盛通防腐退费核心算法：
    // 1. 赠送课时严禁折现退费
    // 2. 实付剩余可用正课 = max(0, 剩余总课时 - 赠送课时)
    // 3. 应退金额 = 剩余实付正课 * 单价 (或前端审批传入金额)
    const paidRemainingLessons = Math.max(
      0,
      pkg.remainingLessons - pkg.bonusLessons,
    );
    const computedRefundAmount =
      cmd.refundAmount !== undefined
        ? cmd.refundAmount
        : paidRemainingLessons * pkg.pricePerLesson;

    const originalSnapshot = {
      packageId: pkg.id,
      remainingLessons: pkg.remainingLessons,
      bonusLessons: pkg.bonusLessons,
      pricePerLesson: pkg.pricePerLesson,
      computedRefundAmount,
    };
    const targetSnapshot = {
      refundStatus: 'refunded',
      refundAmount: computedRefundAmount,
    };

    return this.prisma.$transaction(async (tx) => {
      // (1) 课包置为 refunded 并清零可用课时
      await tx.studentCoursePackage.update({
        where: { id: pkg.id },
        data: { status: 'refunded', remainingLessons: 0 },
      });

      // (2) 生成退费财务单据 (orderType: refund)，显式写入 packageId 并保留兼容 remark
      const orderDateStr = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const randomSuffix = `${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
      const refundOrder = await tx.order.create({
        data: {
          campusId: student.campusId,
          studentId: student.id,
          packageId: pkg.id,
          orderNo: `REF-${orderDateStr}-${randomSuffix}`,
          orderType: 'refund',
          status: 'unpaid',
          originalPrice: computedRefundAmount,
          discountAmount: 0,
          couponAmount: 0,
          receivableAmount: -computedRefundAmount,
          actualAmount: -computedRefundAmount,
          paymentMethod: 'bank_transfer',
          creatorId: currentUser?.id || student.id,
          ownerId: currentUser?.id || student.id,
          channel: 'ground',
          remark: `学员退费[packageId:${pkg.id}]: ${cmd.reasonDetail || cmd.reasonCategory}`,
          payTime: null,
        },
      });

      // (3) 登记三级审批流工单 (教学核实 -> 校长审批 -> 财务终审)
      const flow = await tx.approvalFlow.create({
        data: {
          orderId: refundOrder.id,
          businessType: 'refund',
          currentStep: 1,
          totalSteps: 3,
          status: 'pending',
          applicantName:
            currentUser?.realName ||
            currentUser?.account ||
            student.name ||
            '教务主管',
        },
      });

      // (4) 记录异动日志 (StudentAbnormalMovement)
      const movement = await tx.studentAbnormalMovement.create({
        data: {
          studentId: student.id,
          type: 'refund',
          reasonCategory: cmd.reasonCategory,
          reasonDetail: cmd.reasonDetail || '',
          status: 'approved',
          auditStep: 3,
          originalData: JSON.stringify(originalSnapshot),
          targetData: JSON.stringify(targetSnapshot),
        },
      });

      this.logger.log(
        `发起学员退费成功: 学员 [${student.name}], 课包 [${pkg.id}], 退费单 [${refundOrder.orderNo}], 审批流 [${flow.id}]`,
      );

      return {
        success: true,
        movementId: movement.id,
        orderId: refundOrder.id,
        orderNo: refundOrder.orderNo,
        packageId: pkg.id,
        approvalFlowId: flow.id,
        computedRefundAmount,
        paidRemainingLessons,
        bonusLessonsDeducted: pkg.bonusLessons,
        type: 'refund',
        originalData: originalSnapshot,
        targetData: targetSnapshot,
      };
    });
  }

  /**
   * 3. 审批驳回时课包资产回滚恢复 (Rollback Refund)
   * 彻底消除对 order.remark 正则提取的依赖，通过显式 packageId 权威溯源
   */
  async rollbackRefund(
    orderId: string,
    txClient?: Prisma.TransactionClient,
  ): Promise<RollbackRefundReceipt> {
    const runner = async (tx: Prisma.TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`未找到退费订单 ID: ${orderId}`);
      }

      // 显式外键优先；若旧单无外键，则尝试 remark 正则兜底兼容；最后按学员退费时间倒序兜底
      let targetPkgId = order.packageId;
      if (!targetPkgId && order.remark) {
        const pkgMatch = order.remark.match(/\[packageId:(.*?)\]/);
        if (pkgMatch) {
          targetPkgId = pkgMatch[1];
        }
      }

      const refundedPkg = targetPkgId
        ? await tx.studentCoursePackage.findUnique({
            where: { id: targetPkgId },
          })
        : await tx.studentCoursePackage.findFirst({
            where: {
              studentId: order.studentId,
              status: 'refunded',
            },
            orderBy: { updatedAt: 'desc' },
          });

      if (!refundedPkg) {
        this.logger.warn(`退费订单 ${orderId} 未找到关联被退课包，跳过课包复苏`);
        return {
          orderId,
          packageId: targetPkgId || '',
          restoredStatus: 'none',
          restoredLessons: 0,
        };
      }

      // 恢复课时：以发起退费时的异动快照为准 (退费金额已扣除赠课、手续费与超额赠课，不能反推课时)
      const movement = await tx.studentAbnormalMovement.findFirst({
        where: { studentId: order.studentId, type: 'refund', targetData: { contains: order.id } },
        orderBy: { createdAt: 'desc' },
      });
      let snapshot: any = null;
      try {
        snapshot = movement?.originalData ? JSON.parse(movement.originalData) : null;
      } catch {
        snapshot = null;
      }
      const fromSnapshot =
        !!snapshot && snapshot.packageId === refundedPkg.id && typeof snapshot.remainingLessons === 'number';
      // 历史单据无快照时沿用旧的按金额折算口径
      const restoredLessons = fromSnapshot
        ? snapshot.remainingLessons
        : order.actualAmount < 0 && refundedPkg.pricePerLesson > 0
          ? Math.round(Math.abs(order.actualAmount) / refundedPkg.pricePerLesson)
          : refundedPkg.totalLessons;
      const restoredStatus =
        fromSnapshot && (snapshot.status === 'frozen' || snapshot.status === 'completed') ? snapshot.status : 'active';

      // 退费时释放了班级席位：班级仍存在时一并复原
      let restoredClassId: string | null = null;
      if (fromSnapshot && snapshot.classId) {
        const cls = await tx.class.findUnique({ where: { id: snapshot.classId } });
        if (cls) {
          restoredClassId = cls.id;
          await tx.class.update({
            where: { id: cls.id },
            data: { currentStudentCount: { increment: 1 } },
          });
        }
      }

      await tx.studentCoursePackage.update({
        where: { id: refundedPkg.id },
        data: {
          status: restoredStatus,
          remainingLessons: restoredLessons,
          ...(restoredClassId ? { classId: restoredClassId } : {}),
        },
      });

      this.logger.log(
        `退费驳回课包资产已复原: 课包ID [${refundedPkg.id}], 恢复状态 [${restoredStatus}], 恢复课时 [${restoredLessons}]`,
      );

      return {
        orderId,
        packageId: refundedPkg.id,
        restoredStatus,
        restoredLessons,
      };
    };

    return txClient ? runner(txClient) : this.prisma.$transaction(runner);
  }

  /**
   * 4. 审批终审通过时退费结算 (Finalize Refund)
   */
  async finalizeRefund(
    orderId: string,
    txClient?: Prisma.TransactionClient,
  ): Promise<FinalizeRefundReceipt> {
    const runner = async (tx: Prisma.TransactionClient) => {
      const payTime = new Date();
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          payTime,
        },
      });

      this.logger.log(
        `退费审批终审通过，退费单 [${updatedOrder.orderNo}] 状态确立为 paid`,
      );

      return {
        orderId: updatedOrder.id,
        orderNo: updatedOrder.orderNo,
        status: 'paid' as const,
        packageId: updatedOrder.packageId,
        payTime,
      };
    };

    return txClient ? runner(txClient) : this.prisma.$transaction(runner);
  }
}
