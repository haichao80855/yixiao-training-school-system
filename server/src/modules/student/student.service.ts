import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { EnrollStudentDto } from './dto/enroll.dto';
import { CreateMovementDto } from './dto/movement.dto';
import { RechargeWalletDto, WithdrawWalletDto } from './dto/wallet.dto';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分页与高级筛选学员列表
   */
  async getStudents(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: string;
    campusId?: string;
    warningLevel?: string; // urgent: <=4, warning: <=8, normal: >8
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.campusId && query.campusId !== 'all') {
      where.campusId = query.campusId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
        { studentNo: { contains: query.keyword } },
      ];
    }

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          campus: {
            select: { id: true, name: true, code: true },
          },
          wallet: true,
          packages: {
            where: { status: 'active' },
            include: {
              course: {
                select: { id: true, name: true, code: true, pricePerLesson: true },
              },
              class: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          _count: {
            select: {
              attendances: true,
              orders: true,
              abnormals: true,
            },
          },
        },
      }),
    ]);

    // 格式化输出并计算课时与预警指标
    const list = students.map((stu) => {
      const totalRemainingLessons = stu.packages.reduce(
        (sum, p) => sum + p.remainingLessons,
        0,
      );
      const totalConsumedLessons = stu.packages.reduce(
        (sum, p) => sum + p.consumedLessons,
        0,
      );

      let computedWarningLevel = 'normal';
      if (stu.packages.length > 0) {
        if (totalRemainingLessons <= 4) {
          computedWarningLevel = 'urgent';
        } else if (totalRemainingLessons <= 8) {
          computedWarningLevel = 'warning';
        }
      }

      return {
        id: stu.id,
        studentNo: stu.studentNo,
        name: stu.name,
        gender: stu.gender,
        phone: stu.phone,
        parentName: stu.parentName,
        school: stu.school,
        status: stu.status,
        campusId: stu.campusId,
        campus: stu.campus,
        principalBalance: stu.wallet?.principalBalance || 0,
        bonusBalance: stu.wallet?.bonusBalance || 0,
        goldPoints: stu.wallet?.goldPoints || 0,
        totalRemainingLessons,
        totalConsumedLessons,
        warningLevel: computedWarningLevel,
        activeCourseCount: stu.packages.length,
        packages: stu.packages.map((p) => ({
          packageId: p.id,
          id: p.id,
          courseId: p.courseId,
          courseName: p.course?.name || '标准课程',
          totalLessons: p.totalLessons,
          remainingLessons: p.remainingLessons,
          consumedLessons: p.consumedLessons,
          status: p.status,
          expireDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '2027-12-31',
        })),
        attendanceCount: stu._count.attendances,
        orderCount: stu._count.orders,
        createdAt: stu.createdAt,
      };
    });

    // 如果指定了消课预警级别过滤
    const filteredList = query.warningLevel
      ? list.filter((s) => s.warningLevel === query.warningLevel)
      : list;

    return {
      total: query.warningLevel ? filteredList.length : total,
      page,
      pageSize,
      list: filteredList,
    };
  }

  /**
   * 获取单一学员基础信息
   */
  async getStudentById(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        campus: true,
        wallet: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID 为 ${id} 的档案`);
    }

    return student;
  }

  /**
   * 新建学员档案并初始化学员钱包
   */
  async createStudent(dto: CreateStudentDto) {
    // 生成以 S 开头的唯一学号序列
    const seq = Math.floor(100000 + Math.random() * 900000);
    const studentNo = `S${new Date().getFullYear().toString().slice(2)}${seq}`;

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          studentNo,
          name: dto.name,
          gender: dto.gender,
          phone: dto.phone,
          parentName: dto.parentName,
          school: dto.school,
          birthday: dto.birthday,
          address: dto.address,
          campusId: dto.campusId,
          status: 'normal',
        },
      });

      // 初始化电子钱包
      await tx.studentWallet.create({
        data: {
          studentId: student.id,
          principalBalance: 0.0,
          bonusBalance: 0.0,
          goldPoints: 0,
        },
      });

      return tx.student.findUnique({
        where: { id: student.id },
        include: { campus: true, wallet: true },
      });
    });
  }

  /**
   * 修改学员基础档案
   */
  async updateStudent(id: string, dto: UpdateStudentDto) {
    await this.getStudentById(id);

    return this.prisma.student.update({
      where: { id },
      data: dto,
      include: { campus: true, wallet: true },
    });
  }

  /**
   * 学员 360° 全景画像
   */
  async getStudentProfile(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        campus: true,
        wallet: true,
        packages: {
          include: {
            course: true,
            class: {
              include: {
                teacher: { select: { id: true, realName: true } },
                classroom: { select: { id: true, name: true } },
              },
            },
          },
        },
        walletLedgers: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        attendances: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: {
            scheduleEvent: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                semanticType: true,
                class: {
                  select: { name: true },
                },
              },
            },
          },
        },
        orders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        abnormals: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${id}`);
    }

    // 计算课包画像与预警
    const enhancedPackages = student.packages.map((pkg) => {
      const progressPercent =
        pkg.totalLessons > 0
          ? Math.round((pkg.consumedLessons / pkg.totalLessons) * 100)
          : 0;

      let warningStatus = 'normal';
      if (pkg.remainingLessons <= 4) {
        warningStatus = 'urgent';
      } else if (pkg.remainingLessons <= 8) {
        warningStatus = 'warning';
      }

      return {
        ...pkg,
        progressPercent,
        warningStatus,
      };
    });

    return {
      studentInfo: {
        id: student.id,
        studentNo: student.studentNo,
        name: student.name,
        gender: student.gender,
        phone: student.phone,
        parentName: student.parentName,
        school: student.school,
        birthday: student.birthday,
        address: student.address,
        status: student.status,
        campus: student.campus,
        createdAt: student.createdAt,
      },
      walletSummary: {
        principalBalance: student.wallet?.principalBalance || 0,
        bonusBalance: student.wallet?.bonusBalance || 0,
        goldPoints: student.wallet?.goldPoints || 0,
      },
      packages: enhancedPackages,
      walletLedgers: student.walletLedgers,
      attendances: student.attendances,
      orders: student.orders,
      abnormals: student.abnormals,
    };
  }

  /**
   * 报名单开单与合同签约向导
   */
  async enrollStudent(dto: EnrollStudentDto, currentUser: any) {
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id: dto.studentId },
          { studentNo: dto.studentId },
        ],
      },
      include: { wallet: true },
    });
    if (!student) {
      throw new NotFoundException(`未找到对应学员 (ID/学号: ${dto.studentId})`);
    }

    const course = await this.prisma.course.findFirst({
      where: {
        OR: [
          { id: dto.courseId },
          { code: dto.courseId },
          { name: dto.courseId },
        ],
      },
    });
    if (!course) {
      throw new NotFoundException(`未找到对应课程 (ID/编码: ${dto.courseId})`);
    }

    // 价格与金额核算
    const unitPrice = dto.pricePerLesson || course.pricePerLesson;
    const originalPrice = unitPrice * dto.totalLessons;
    const discount = dto.discountAmount || 0;
    const coupon = dto.couponAmount || 0;
    const actualAmount = Math.max(0, originalPrice - discount - coupon);
    const bonusLessons = dto.bonusLessons || 0;

    // 生成唯一订单编号
    const orderDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNo = `ORD-${orderDateStr}-${randomSuffix}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. 如果选择电子钱包余额支付，先校验并扣减本金余额
      if (dto.paymentMethod === 'wallet') {
        if (!student.wallet || student.wallet.principalBalance < actualAmount) {
          throw new BadRequestException(
            `学员电子钱包本金余额不足 (当前: ¥${student.wallet?.principalBalance || 0}, 需支付: ¥${actualAmount})`,
          );
        }

        await tx.studentWallet.update({
          where: { studentId: student.id },
          data: {
            principalBalance: { decrement: actualAmount },
          },
        });

        // 记入钱包消费账本
        await tx.walletLedger.create({
          data: {
            studentId: student.id,
            orderNo,
            type: 'consumption',
            amount: actualAmount,
            principalChange: -actualAmount,
            bonusChange: 0,
            description: `购买课程「${course.name}」划扣本金`,
            operator: currentUser?.realName || '系统',
          },
        });
      }

      // 2. 创建正式签约订单
      const order = await tx.order.create({
        data: {
          campusId: student.campusId,
          studentId: student.id,
          orderNo,
          orderType: 'regular',
          status: 'paid',
          originalPrice,
          discountAmount: discount,
          couponAmount: coupon,
          receivableAmount: actualAmount,
          actualAmount,
          paymentMethod: dto.paymentMethod,
          creatorId: currentUser?.id || student.id,
          ownerId: dto.ownerId || currentUser?.id || student.id,
          channel: dto.channel || 'ground',
          deliveryStatus: 'none',
          invoiceStatus: 'unissued',
          remark: dto.remark,
          payTime: new Date(),
        },
      });

      // 3. 计算合同有效期 (默认签约日起 1 年)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      // 4. 创建学员报读课包 (StudentCoursePackage)
      const coursePackage = await tx.studentCoursePackage.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          classId: dto.classId || null,
          orderNo,
          totalLessons: dto.totalLessons + bonusLessons,
          remainingLessons: dto.totalLessons + bonusLessons,
          consumedLessons: 0,
          bonusLessons,
          pricePerLesson: unitPrice,
          expiryDate,
          status: 'active',
        },
      });

      return {
        success: true,
        orderNo: order.orderNo,
        orderId: order.id,
        actualAmount,
        totalLessons: coursePackage.totalLessons,
        bonusLessons: coursePackage.bonusLessons,
        packageId: coursePackage.id,
        studentName: student.name,
        courseName: course.name,
      };
    });
  }

  /**
   * 7 分支学员异动状态机业务接口
   */
  async executeMovement(
    studentId: string,
    dto: CreateMovementDto,
    currentUser: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        packages: {
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    let originalSnapshot: any = {};
    let targetSnapshot: any = {};

    return this.prisma.$transaction(async (tx) => {
      switch (dto.type) {
        // 1. 转班 (Transfer Class)
        case 'transfer_class': {
          if (!dto.packageId || !dto.targetClassId) {
            throw new BadRequestException('转班必须指定源课包 ID 与目标班级 ID');
          }
          const pkg = student.packages.find((p) => p.id === dto.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ${dto.packageId}`);
          }
          const targetClass = await tx.class.findUnique({
            where: { id: dto.targetClassId },
          });
          if (!targetClass) {
            throw new NotFoundException(`目标班级 ${dto.targetClassId} 不存在`);
          }

          originalSnapshot = { classId: pkg.classId, className: pkg.class?.name };
          targetSnapshot = { classId: targetClass.id, className: targetClass.name };

          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { classId: targetClass.id },
          });
          break;
        }

        // 2. 换课 (Change Course)
        case 'change_course': {
          if (!dto.packageId || !dto.targetCourseId) {
            throw new BadRequestException('换课必须指定源课包 ID 与目标课程 ID');
          }
          const pkg = student.packages.find((p) => p.id === dto.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ${dto.packageId}`);
          }
          const targetCourse = await tx.course.findUnique({
            where: { id: dto.targetCourseId },
          });
          if (!targetCourse) {
            throw new NotFoundException(`目标课程 ${dto.targetCourseId} 不存在`);
          }

          // 计算原课包剩余价值，折算换新课课时
          const remainingValue =
            Math.max(0, pkg.remainingLessons - pkg.bonusLessons) *
            pkg.pricePerLesson;
          const convertedLessons = Math.floor(
            remainingValue / targetCourse.pricePerLesson,
          );

          originalSnapshot = {
            courseId: pkg.courseId,
            courseName: pkg.course.name,
            remainingLessons: pkg.remainingLessons,
            remainingValue,
          };
          targetSnapshot = {
            courseId: targetCourse.id,
            courseName: targetCourse.name,
            convertedLessons,
            targetPricePerLesson: targetCourse.pricePerLesson,
          };

          // 原课包标记完结或退转
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { status: 'completed', remainingLessons: 0 },
          });

          // 新增目标课程课包
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          await tx.studentCoursePackage.create({
            data: {
              studentId: student.id,
              courseId: targetCourse.id,
              totalLessons: convertedLessons,
              remainingLessons: convertedLessons,
              consumedLessons: 0,
              bonusLessons: 0,
              pricePerLesson: targetCourse.pricePerLesson,
              expiryDate,
              status: 'active',
            },
          });
          break;
        }

        // 3. 停课 / 休学 (Suspend)
        case 'suspend': {
          originalSnapshot = { studentStatus: student.status };
          targetSnapshot = {
            studentStatus: 'suspended',
            suspendDays: dto.suspendDays || 30,
          };

          await tx.student.update({
            where: { id: student.id },
            data: { status: 'suspended' },
          });
          await tx.studentCoursePackage.updateMany({
            where: { studentId: student.id, status: 'active' },
            data: { status: 'frozen' },
          });
          break;
        }

        // 4. 复课 (Resume)
        case 'resume': {
          originalSnapshot = { studentStatus: student.status };
          targetSnapshot = { studentStatus: 'normal' };

          await tx.student.update({
            where: { id: student.id },
            data: { status: 'normal' },
          });

          // 课包恢复为 active，若有停课天数，自动顺延有效期
          const daysToExtend = dto.suspendDays || 30;
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
          break;
        }

        // 5. 转校 (Transfer Campus)
        case 'transfer_campus': {
          if (!dto.targetCampusId) {
            throw new BadRequestException('跨校区转移必须指定目标校区 ID');
          }
          const targetCampus = await tx.campus.findUnique({
            where: { id: dto.targetCampusId },
          });
          if (!targetCampus) {
            throw new NotFoundException(`目标校区 ${dto.targetCampusId} 不存在`);
          }

          originalSnapshot = { campusId: student.campusId };
          targetSnapshot = {
            campusId: targetCampus.id,
            campusName: targetCampus.name,
          };

          // 变更学员校区
          await tx.student.update({
            where: { id: student.id },
            data: { campusId: targetCampus.id },
          });
          break;
        }

        // 6. 转让 (Transfer Student)
        case 'transfer_student': {
          if (!dto.targetStudentId) {
            throw new BadRequestException('转赠课包必须指定受让学员 ID');
          }
          const targetStudent = await tx.student.findUnique({
            where: { id: dto.targetStudentId },
          });
          if (!targetStudent) {
            throw new NotFoundException(`受让学员 ${dto.targetStudentId} 不存在`);
          }

          if (dto.packageId) {
            const pkg = student.packages.find((p) => p.id === dto.packageId);
            if (!pkg) {
              throw new NotFoundException(`学员未持有课包 ${dto.packageId}`);
            }

            originalSnapshot = {
              fromStudentId: student.id,
              fromStudentName: student.name,
              packageId: pkg.id,
              remainingLessons: pkg.remainingLessons,
            };
            targetSnapshot = {
              toStudentId: targetStudent.id,
              toStudentName: targetStudent.name,
            };

            // 转让课包所有权
            await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: { studentId: targetStudent.id, classId: null },
            });
          } else {
            const activePackages = student.packages.filter((p) => p.status === 'active');
            if (activePackages.length === 0) {
              throw new BadRequestException('学员暂无有效课包可转让');
            }

            originalSnapshot = {
              fromStudentId: student.id,
              fromStudentName: student.name,
              packagesCount: activePackages.length,
            };
            targetSnapshot = {
              toStudentId: targetStudent.id,
              toStudentName: targetStudent.name,
            };

            await tx.studentCoursePackage.updateMany({
              where: { studentId: student.id, status: 'active' },
              data: { studentId: targetStudent.id, classId: null },
            });
          }
          break;
        }

        // 7. 退费 (Refund - 盛通标准防腐退费核算公式)
        case 'refund': {
          if (!dto.packageId) {
            throw new BadRequestException('退费操作必须指定对应课包 ID');
          }
          const pkg = student.packages.find((p) => p.id === dto.packageId);
          if (!pkg) {
            throw new NotFoundException(`学员未持有课包 ${dto.packageId}`);
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
            dto.refundAmount !== undefined
              ? dto.refundAmount
              : paidRemainingLessons * pkg.pricePerLesson;

          originalSnapshot = {
            packageId: pkg.id,
            remainingLessons: pkg.remainingLessons,
            bonusLessons: pkg.bonusLessons,
            pricePerLesson: pkg.pricePerLesson,
            computedRefundAmount,
          };
          targetSnapshot = {
            refundStatus: 'refunded',
            refundAmount: computedRefundAmount,
          };

          // 课包置为 refunded 并清零
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { status: 'refunded', remainingLessons: 0 },
          });

          // 生成一条退费财务单据 (orderType: refund)
          const orderDateStr = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '');
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          await tx.order.create({
            data: {
              campusId: student.campusId,
              studentId: student.id,
              orderNo: `REF-${orderDateStr}-${randomSuffix}`,
              orderType: 'refund',
              status: 'paid',
              originalPrice: computedRefundAmount,
              discountAmount: 0,
              couponAmount: 0,
              receivableAmount: -computedRefundAmount,
              actualAmount: -computedRefundAmount,
              paymentMethod: 'bank_transfer',
              creatorId: currentUser?.id || student.id,
              ownerId: currentUser?.id || student.id,
              channel: 'ground',
              remark: `学员退费: ${dto.reasonDetail || dto.reasonCategory}`,
              payTime: new Date(),
            },
          });
          break;
        }

        default:
          throw new BadRequestException(`不支持的异动类型: ${dto.type}`);
      }

      // 统一记录异动日志 (StudentAbnormalMovement)
      const movement = await tx.studentAbnormalMovement.create({
        data: {
          studentId: student.id,
          type: dto.type,
          reasonCategory: dto.reasonCategory,
          reasonDetail: dto.reasonDetail || '',
          status: 'approved',
          auditStep: 3,
          originalData: JSON.stringify(originalSnapshot),
          targetData: JSON.stringify(targetSnapshot),
        },
      });

      return {
        success: true,
        movementId: movement.id,
        type: dto.type,
        originalData: originalSnapshot,
        targetData: targetSnapshot,
      };
    });
  }

  /**
   * 电子钱包充值 (本金 + 赠送金入账与流水记录)
   */
  async rechargeWallet(
    studentId: string,
    dto: RechargeWalletDto,
    currentUser?: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { wallet: true },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    const bonusAmount = dto.bonus && dto.bonus > 0 ? dto.bonus : 0;
    const totalAmount = Number((dto.amount + bonusAmount).toFixed(2));
    const operatorName = dto.operator || currentUser?.realName || '财务主管';

    return this.prisma.$transaction(async (tx) => {
      // 1. upsert 确保钱包记录必定存在并累加余额
      const wallet = await tx.studentWallet.upsert({
        where: { studentId },
        create: {
          studentId,
          principalBalance: dto.amount,
          bonusBalance: bonusAmount,
          goldPoints: 0,
        },
        update: {
          principalBalance: { increment: dto.amount },
          bonusBalance: { increment: bonusAmount },
        },
      });

      // 2. 写入财务记账明细 (WalletLedger)
      await tx.walletLedger.create({
        data: {
          studentId,
          type: 'recharge',
          amount: totalAmount,
          principalChange: dto.amount,
          bonusChange: bonusAmount,
          description:
            dto.remark ||
            `电子钱包充值 (本金 ¥${dto.amount}${bonusAmount > 0 ? ' + 赠送 ¥' + bonusAmount : ''})`,
          operator: operatorName,
        },
      });

      return {
        success: true,
        balance: Number(
          (wallet.principalBalance + wallet.bonusBalance).toFixed(2),
        ),
        principalBalance: Number(wallet.principalBalance.toFixed(2)),
        bonusBalance: Number(wallet.bonusBalance.toFixed(2)),
        message: `充值成功！本金上账 ¥${dto.amount}${bonusAmount > 0 ? '，赠送金上账 ¥' + bonusAmount : ''}`,
      };
    });
  }

  /**
   * 电子钱包本金提现 (合规风控：严禁动用赠送金，严禁超额透支)
   */
  async withdrawWallet(
    studentId: string,
    dto: WithdrawWalletDto,
    currentUser?: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { wallet: true },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    const principal = student.wallet?.principalBalance || 0;
    if (dto.amount > principal) {
      throw new BadRequestException('提现金额不得超过本金余额（赠送金不可提现）');
    }

    const operatorName = dto.operator || currentUser?.realName || '财务核销';

    return this.prisma.$transaction(async (tx) => {
      // 1. 原子扣减本金余额
      const updatedWallet = await tx.studentWallet.update({
        where: { studentId },
        data: {
          principalBalance: { decrement: dto.amount },
        },
      });

      // 2. 写入出账记账明细
      await tx.walletLedger.create({
        data: {
          studentId,
          type: 'withdraw',
          amount: -dto.amount,
          principalChange: -dto.amount,
          bonusChange: 0,
          description: dto.reason
            ? `合规提现出账 ¥${dto.amount}: ${dto.reason}`
            : `合规提现出账 ¥${dto.amount}`,
          operator: operatorName,
        },
      });

      return {
        success: true,
        balance: Number(
          (updatedWallet.principalBalance + updatedWallet.bonusBalance).toFixed(
            2,
          ),
        ),
        principalBalance: Number(updatedWallet.principalBalance.toFixed(2)),
        bonusBalance: Number(updatedWallet.bonusBalance.toFixed(2)),
        message: `本金提现成功，扣减 ¥${dto.amount}`,
      };
    });
  }

  /**
   * 彻底删除学员档案及级联清理关联测试订单与资产
   */
  async deleteStudent(id: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id },
          { studentNo: id },
        ],
      },
      include: {
        orders: {
          include: {
            approval: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('学员档案不存在');
    }

    const targetId = student.id;

    await this.prisma.$transaction(async (tx) => {
      // 1. 清理关联订单的多级审批流节点与流程
      for (const order of student.orders) {
        if (order.approval) {
          await tx.approvalNode.deleteMany({
            where: { approvalFlowId: order.approval.id },
          });
          await tx.approvalFlow.delete({
            where: { id: order.approval.id },
          });
        }
      }

      // 2. 清理关联订单
      await tx.order.deleteMany({ where: { studentId: targetId } });

      // 3. 清理消课考勤记录
      await tx.attendanceRecord.deleteMany({ where: { studentId: targetId } });

      // 4. 清理签约课包
      await tx.studentCoursePackage.deleteMany({ where: { studentId: targetId } });

      // 5. 清理零钱包及账本流水
      await tx.walletLedger.deleteMany({ where: { studentId: targetId } });
      await tx.studentWallet.deleteMany({ where: { studentId: targetId } });

      // 6. 清理异动审批工单
      await tx.studentAbnormalMovement.deleteMany({ where: { studentId: targetId } });

      // 7. 最终彻底删除学员主体
      await tx.student.delete({ where: { id: targetId } });
    });

    return {
      success: true,
      message: `学员 [${student.name}] 及其关联的业务测试数据已彻底从数据库清除`,
    };
  }
}
