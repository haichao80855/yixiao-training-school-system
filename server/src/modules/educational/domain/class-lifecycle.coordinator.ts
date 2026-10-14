/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」教学班级全生命周期协调器
 * 实现班级生命周期状态机推进、资产级联处置、排课资源出清与历史考勤防腐
 * 领域概念对齐 GLOSSARY.md 与 ADR-0007
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ClassLifecycleStatus,
  StudentDispositionPolicy,
  ActivateClassCommand,
  ActivateClassResult,
  CompleteClassCommand,
  CompleteClassResult,
  CancelClassCommand,
  CancelClassResult,
  MergeClassesCommand,
  MergeClassesResult,
  PreviewLifecycleCommand,
  ClassLifecyclePreview,
  ClassLifecycleReceipt,
  LifecycleCheckIssue,
} from './class-lifecycle.types';

@Injectable()
export class ClassLifecycleCoordinator {
  private readonly logger = new Logger(ClassLifecycleCoordinator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成不可变数字指纹 (SHA-256 Digest)
   */
  private generateFingerprint(payload: Record<string, any>): string {
    const serialized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * 1. 招生转开班 (activateClass)
   * 业务不变量：
   * - 仅允许 recruiting 状态跃迁至 in_progress
   * - 最低开班人数校验，消除幽灵人数漂移
   * - 推进所有在读学员学籍为 in_class
   */
  async activateClass(cmd: ActivateClassCommand): Promise<ActivateClassResult> {
    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: cmd.classId },
        include: {
          studentPackages: { where: { status: 'active' }, include: { student: true } },
          schedules: { where: { status: 'scheduled' } },
        },
      });

      if (!cls) {
        throw new NotFoundException(`班级不存在 (ID: ${cmd.classId})`);
      }
      if (cls.status !== 'recruiting') {
        throw new BadRequestException(
          `班级当前状态为 [${cls.status}]，仅招生中(recruiting)的班级允许正式开班`,
        );
      }

      const actualCount = cls.studentPackages.length;
      const minRequired = cmd.minStudentCount !== undefined ? cmd.minStudentCount : 1;
      if (actualCount < minRequired) {
        throw new BadRequestException(
          `开班失败：在读学员不足（当前 ${actualCount} 人，最低要求 ${minRequired} 人）`,
        );
      }

      // 1.1 校准班级实际在读人数与状态
      const startDate = cmd.actualStartDate ? new Date(cmd.actualStartDate) : cls.startDate;
      await tx.class.update({
        where: { id: cls.id },
        data: {
          status: 'in_progress',
          currentStudentCount: actualCount,
          startDate,
        },
      });

      // 1.2 批量推进学员主体学籍状态机为 in_class
      const studentIds = Array.from(new Set(cls.studentPackages.map((p) => p.studentId)));
      if (studentIds.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: studentIds } },
          data: { status: 'in_class' },
        });
      }

      const receiptId = `REC-ACT-${Date.now().toString().slice(-6)}-${cls.code}`;
      this.logger.log(`班级 [${cls.name}] 已由招生中正式跃迁为开班授课中 (学员 ${actualCount} 人)`);

      return {
        success: true,
        classId: cls.id,
        className: cls.name,
        previousStatus: 'recruiting',
        currentStatus: 'in_progress',
        enrolledStudentCount: actualCount,
        startDate: startDate.toISOString().slice(0, 10),
        activatedScheduleCount: cls.schedules.length,
        receiptId,
        message: `班级「${cls.name}」正式开班成功，已激活 ${cls.schedules.length} 节排课日程`,
      };
    });
  }

  /**
   * 2. 正常结课结业并处置学员 (completeClass)
   * 业务不变量：
   * - 课包防悬空：全量在读课包回退待分班池或 CAS 升班重绑
   * - 学籍自愈：脱离班级且无其他班级者，学籍原子自愈为 normal
   * - 排课出清：未发生考勤的排课日程自动物理撤销，释放物理教室与讲师工时
   * - 考勤防腐：历史已消课考勤 100% 原样保留
   * - 班级在读人数清零，状态跃迁为 completed
   */
  async completeClass(cmd: CompleteClassCommand): Promise<CompleteClassResult> {
    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: cmd.classId },
        include: {
          studentPackages: { where: { status: 'active' }, include: { student: true } },
          schedules: { include: { attendances: true } },
        },
      });

      if (!cls) {
        throw new NotFoundException(`班级不存在 (ID: ${cmd.classId})`);
      }
      if (cls.status === 'completed') {
        throw new BadRequestException(`班级「${cls.name}」已处于已结课状态，禁止重复结课`);
      }

      const activePackages = cls.studentPackages;
      const receiptId = `REC-CMP-${Date.now().toString().slice(-6)}-${cls.code}`;
      let targetClassName: string | undefined;

      // 2.1 针对不同策略处置在读学员课包（防孤儿课包）
      if (cmd.disposition.mode === 'fallback_unassigned') {
        // 模式 A：解绑班级回退待分班资产池
        for (const pkg of activePackages) {
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { classId: null },
          });

          // 记录不可变学籍异动审计
          await tx.studentAbnormalMovement.create({
            data: {
              studentId: pkg.studentId,
              type: 'transfer_class',
              reasonCategory: 'CLASS_COMPLETED_FALLBACK',
              reasonDetail: cmd.remark || `班级「${cls.name}」结课，课包自动回退至待分班资产池`,
              status: 'approved',
              originalData: JSON.stringify({ classId: cls.id, className: cls.name }),
              targetData: JSON.stringify({ classId: null, fallbackPool: 'unassigned' }),
            },
          });

          // 学籍自愈：检测学员是否还挂载在其他有效班级
          const otherClasses = await tx.studentCoursePackage.count({
            where: {
              studentId: pkg.studentId,
              id: { not: pkg.id },
              status: 'active',
              classId: { not: null },
            },
          });
          if (otherClasses === 0) {
            await tx.student.update({
              where: { id: pkg.studentId },
              data: { status: 'normal' },
            });
          }
        }
      } else if (cmd.disposition.mode === 'transfer_next_class') {
        // 模式 B：批量升班，目标班级 CAS 锁并发防击穿
        const targetClassId = cmd.disposition.targetClassId;
        const targetClass = await tx.class.findUnique({ where: { id: targetClassId } });
        if (!targetClass) {
          throw new NotFoundException(`升班目标班级不存在 (ID: ${targetClassId})`);
        }
        targetClassName = targetClass.name;

        const incomingCount = activePackages.length;
        if (targetClass.currentStudentCount + incomingCount > targetClass.capacity) {
          throw new ConflictException(
            `升班目标班级「${targetClass.name}」容量不足 (当前 ${targetClass.currentStudentCount}/${targetClass.capacity}，拟升入 ${incomingCount} 人)`,
          );
        }

        // 行级 CAS 递增目标班级在读人数
        const cas = await tx.class.updateMany({
          where: {
            id: targetClass.id,
            currentStudentCount: { lte: targetClass.capacity - incomingCount },
          },
          data: { currentStudentCount: { increment: incomingCount } },
        });
        if (cas.count === 0) {
          throw new ConflictException(`目标班级名额在并发抢占中已满，升班结课操作已安全回滚`);
        }

        // 批量将课包 classId 指向新班级
        for (const pkg of activePackages) {
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { classId: targetClass.id },
          });

          await tx.studentAbnormalMovement.create({
            data: {
              studentId: pkg.studentId,
              type: 'transfer_class',
              reasonCategory: 'CLASS_UPGRADE_BATCH',
              reasonDetail: cmd.remark || `随班级「${cls.name}」结课批量升入「${targetClass.name}」`,
              status: 'approved',
              originalData: JSON.stringify({ classId: cls.id, className: cls.name }),
              targetData: JSON.stringify({ classId: targetClass.id, className: targetClass.name }),
            },
          });
        }
      } else if (cmd.disposition.mode === 'archive_completed') {
        // 模式 C：归档完结
        const hasRemaining = activePackages.some((p) => p.remainingLessons > 0);
        if (hasRemaining) {
          throw new BadRequestException(
            '班内仍有学员存在剩余课时，禁止直接 archive_completed 归档，请选择回退待分班或批量升班',
          );
        }
        for (const pkg of activePackages) {
          await tx.studentCoursePackage.update({
            where: { id: pkg.id },
            data: { status: 'completed', classId: null },
          });
        }
      }

      // 2.2 自动注销未发生考勤的排课日程 (释放物理教室与讲师时段)
      let cancelledCount = 0;
      let preservedAttendanceCount = 0;

      for (const s of cls.schedules) {
        if (s.attendances.length > 0 || s.status === 'completed') {
          preservedAttendanceCount += s.attendances.length;
        }
      }

      if (cmd.cancelFutureSchedules !== false) {
        const unAttendedSchedules = cls.schedules.filter(
          (s) => s.attendances.length === 0 && s.status !== 'completed',
        );
        if (unAttendedSchedules.length > 0) {
          const scheduleIds = unAttendedSchedules.map((s) => s.id);
          const delRes = await tx.scheduleEvent.deleteMany({
            where: { id: { in: scheduleIds } },
          });
          cancelledCount = delRes.count;
          this.logger.log(`班级结课：已注销未执行排课日程 ${cancelledCount} 节，释放物理教室占用`);
        }
      }

      // 2.3 班级归档状态跃迁，在读名额清零
      await tx.class.update({
        where: { id: cls.id },
        data: {
          status: 'completed',
          currentStudentCount: 0,
        },
      });

      const fingerprint = this.generateFingerprint({
        receiptId,
        classId: cls.id,
        action: 'complete',
        dispositionMode: cmd.disposition.mode,
        disposedStudentCount: activePackages.length,
        cancelledScheduleCount: cancelledCount,
        executedAt: new Date().toISOString(),
      });

      return {
        success: true,
        classId: cls.id,
        className: cls.name,
        previousStatus: cls.status as ClassLifecycleStatus,
        currentStatus: 'completed',
        disposedStudentCount: activePackages.length,
        dispositionMode: cmd.disposition.mode,
        targetClassId: cmd.disposition.mode === 'transfer_next_class' ? cmd.disposition.targetClassId : undefined,
        targetClassName,
        cancelledScheduleCount: cancelledCount,
        preservedAttendanceCount,
        receiptId,
        immutableFingerprint: fingerprint,
        message: `班级「${cls.name}」已圆满结课！已妥善安置 ${activePackages.length} 名在读学员，释放排课 ${cancelledCount} 节`,
      };
    });
  }

  /**
   * 3. 异常解散取消班级 (cancelClass)
   * 业务不变量：
   * - 必须填写明确解散原因
   * - 在读课包 100% 自动回退待分班资产池，学籍自愈
   * - 未点名未来排课全量安全撤销
   * - 历史考勤防腐：若已有考勤消课记录，严禁物理硬删除，强制更新为安全解散归档 (completed)；无考勤空班级方可物理清理
   */
  async cancelClass(cmd: CancelClassCommand): Promise<CancelClassResult> {
    if (!cmd.reason || cmd.reason.trim().length === 0) {
      throw new BadRequestException('必须填写解散班级的原因说明');
    }

    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: cmd.classId },
        include: {
          studentPackages: { where: { status: 'active' } },
          schedules: { include: { attendances: true } },
        },
      });

      if (!cls) {
        throw new NotFoundException(`班级不存在 (ID: ${cmd.classId})`);
      }

      // 3.1 历史考勤防腐探测
      const hasHistoryAttendance = cls.schedules.some((s) => s.attendances.length > 0);
      let preservedAttendanceCount = 0;
      cls.schedules.forEach((s) => {
        preservedAttendanceCount += s.attendances.length;
      });

      // 3.2 在读学员课包解绑回退待分班资产池
      for (const pkg of cls.studentPackages) {
        await tx.studentCoursePackage.update({
          where: { id: pkg.id },
          data: { classId: null },
        });

        await tx.studentAbnormalMovement.create({
          data: {
            studentId: pkg.studentId,
            type: 'transfer_class',
            reasonCategory: 'CLASS_DISBANDED',
            reasonDetail: `班级异常解散: ${cmd.reason}`,
            status: 'approved',
            originalData: JSON.stringify({ classId: cls.id, className: cls.name }),
            targetData: JSON.stringify({ classId: null, fallbackPool: 'unassigned' }),
          },
        });

        // 学籍自愈
        const remaining = await tx.studentCoursePackage.count({
          where: {
            studentId: pkg.studentId,
            id: { not: pkg.id },
            status: 'active',
            classId: { not: null },
          },
        });
        if (remaining === 0) {
          await tx.student.update({ where: { id: pkg.studentId }, data: { status: 'normal' } });
        }
      }

      // 3.3 撤销未来未执行排课日程
      const futureSchedules = cls.schedules.filter((s) => s.attendances.length === 0);
      let revokedCount = 0;
      if (futureSchedules.length > 0) {
        const delRes = await tx.scheduleEvent.deleteMany({
          where: { id: { in: futureSchedules.map((s) => s.id) } },
        });
        revokedCount = delRes.count;
      }

      // 3.4 班级实体安全处置 (历史考勤防腐屏障)
      let isSoftDisbanded = false;
      if (hasHistoryAttendance) {
        isSoftDisbanded = true;
        await tx.class.update({
          where: { id: cls.id },
          data: {
            status: 'completed',
            currentStudentCount: 0,
            name: `${cls.name} [已解散]`,
          },
        });
      } else {
        await tx.class.delete({ where: { id: cls.id } });
      }

      const receiptId = `REC-CNC-${Date.now().toString().slice(-6)}-${cls.code}`;
      const fingerprint = this.generateFingerprint({
        receiptId,
        classId: cls.id,
        action: 'cancel',
        reason: cmd.reason,
        disbandedStudentCount: cls.studentPackages.length,
        revokedScheduleCount: revokedCount,
        isSoftDisbanded,
      });

      return {
        success: true,
        classId: cls.id,
        className: cls.name,
        disbandedStudentCount: cls.studentPackages.length,
        revokedScheduleCount: revokedCount,
        historicalAttendancesPreserved: preservedAttendanceCount,
        isSoftDisbanded,
        receiptId,
        immutableFingerprint: fingerprint,
        message: `班级「${cls.name}」已成功解散，${cls.studentPackages.length} 名在读学员课包已安全回退待分班池，${revokedCount} 节未上日程已注销`,
      };
    });
  }

  /**
   * 4. 班级全量合并 (mergeClasses)
   * 业务不变量：
   * - 源班级与目标班级校区、课程必须严格同源
   * - 目标班级行级 CAS 班容锁：杜绝并发抢占超卖
   * - 批量转移课包至目标班级并记异动审计
   * - 源班级排课出清并归档
   */
  async mergeClasses(cmd: MergeClassesCommand): Promise<MergeClassesResult> {
    if (cmd.sourceClassIds.includes(cmd.targetClassId)) {
      throw new BadRequestException('源班级列表中不得包含目标班级自身');
    }
    if (!cmd.sourceClassIds || cmd.sourceClassIds.length === 0) {
      throw new BadRequestException('请至少选择一个待合并的源班级');
    }

    return this.prisma.$transaction(async (tx) => {
      const targetClass = await tx.class.findUnique({
        where: { id: cmd.targetClassId },
      });
      if (!targetClass) {
        throw new NotFoundException(`目标班级不存在 (ID: ${cmd.targetClassId})`);
      }

      const sourceClasses = await tx.class.findMany({
        where: { id: { in: cmd.sourceClassIds } },
        include: { studentPackages: { where: { status: 'active' } } },
      });

      if (sourceClasses.length !== cmd.sourceClassIds.length) {
        throw new NotFoundException('部分源班级未找到');
      }

      // 4.1 课程与校区同源性校验 (禁止跨课程/跨校区合并)
      for (const sc of sourceClasses) {
        if (sc.courseId !== targetClass.courseId) {
          throw new BadRequestException(
            `源班级「${sc.name}」与目标班级「${targetClass.name}」所属课程不一致，严禁合并`,
          );
        }
        if (sc.campusId !== targetClass.campusId) {
          throw new BadRequestException(
            `源班级「${sc.name}」与目标班级不在同一校区，严禁跨校区合并`,
          );
        }
      }

      // 4.2 计算全部待迁移学员课包
      const allSourcePackages = sourceClasses.flatMap((sc) => sc.studentPackages);
      const totalMigrating = allSourcePackages.length;

      // 4.3 目标班级行级 CAS 班容锁
      if (targetClass.currentStudentCount + totalMigrating > targetClass.capacity) {
        throw new ConflictException(
          `目标班级「${targetClass.name}」容量不足 (额定 ${targetClass.capacity} 人，当前 ${targetClass.currentStudentCount} 人，拟合并迁入 ${totalMigrating} 人)`,
        );
      }

      const cas = await tx.class.updateMany({
        where: {
          id: targetClass.id,
          currentStudentCount: { lte: targetClass.capacity - totalMigrating },
        },
        data: { currentStudentCount: { increment: totalMigrating } },
      });
      if (cas.count === 0) {
        throw new ConflictException('目标班级名额在并发抢占中已达上限，合并操作已安全回滚');
      }

      // 4.4 批量迁移课包 classId 并登记异动审计
      for (const pkg of allSourcePackages) {
        await tx.studentCoursePackage.update({
          where: { id: pkg.id },
          data: { classId: targetClass.id },
        });

        await tx.studentAbnormalMovement.create({
          data: {
            studentId: pkg.studentId,
            type: 'transfer_class',
            reasonCategory: 'CLASS_MERGED',
            reasonDetail: cmd.reason || `班级合并至「${targetClass.name}」`,
            status: 'approved',
            originalData: JSON.stringify({ classId: pkg.classId }),
            targetData: JSON.stringify({ classId: targetClass.id, className: targetClass.name }),
          },
        });
      }

      // 4.5 清理源班级未来未发生考勤排课，并归档源班级
      for (const sc of sourceClasses) {
        await tx.scheduleEvent.deleteMany({
          where: { classId: sc.id, attendances: { none: {} } },
        });

        await tx.class.update({
          where: { id: sc.id },
          data: {
            currentStudentCount: 0,
            status: cmd.sourceDisposition === 'keep_empty' ? sc.status : 'completed',
          },
        });
      }

      const updatedTarget = await tx.class.findUnique({ where: { id: targetClass.id } });
      const receiptId = `REC-MRG-${Date.now().toString().slice(-6)}-${targetClass.code}`;
      const fingerprint = this.generateFingerprint({
        receiptId,
        targetClassId: targetClass.id,
        migratedStudentCount: totalMigrating,
        mergedSourceClassCount: sourceClasses.length,
      });

      return {
        success: true,
        targetClassId: targetClass.id,
        targetClassName: targetClass.name,
        migratedStudentCount: totalMigrating,
        mergedSourceClassCount: sourceClasses.length,
        targetCurrentStudentCount: updatedTarget!.currentStudentCount,
        targetCapacity: targetClass.capacity,
        receiptId,
        immutableFingerprint: fingerprint,
        message: `成功将 ${sourceClasses.length} 个源班级的 ${totalMigrating} 名学员全量合并入「${targetClass.name}」，当前班级在读 ${updatedTarget!.currentStudentCount}/${targetClass.capacity} 人`,
      };
    });
  }

  /**
   * 5. 二阶段只读仿真预演 (previewOperation)
   * 零写副作用只读仿真，返回合规阻断问题与级联影响面预估
   */
  async previewOperation(cmd: PreviewLifecycleCommand): Promise<ClassLifecyclePreview> {
    const cls = await this.prisma.class.findUnique({
      where: { id: cmd.classId },
      include: {
        course: true,
        campus: true,
        studentPackages: { where: { status: 'active' }, include: { student: true } },
        schedules: { include: { attendances: true } },
      },
    });

    if (!cls) {
      throw new NotFoundException(`班级不存在 (ID: ${cmd.classId})`);
    }

    const issues: LifecycleCheckIssue[] = [];
    const activePackages = cls.studentPackages;
    const currentStatus = cls.status as ClassLifecycleStatus;
    let targetStatus: ClassLifecycleStatus = currentStatus;

    let cancelledScheduleCount = 0;
    let auditedHistoricalAttendanceCount = 0;
    cls.schedules.forEach((s) => {
      if (s.attendances.length > 0 || s.status === 'completed') {
        auditedHistoricalAttendanceCount += s.attendances.length;
      } else {
        cancelledScheduleCount++;
      }
    });

    let targetCapBefore: number | undefined;
    let targetCapAfter: number | undefined;

    if (cmd.action === 'activate') {
      targetStatus = 'in_progress';
      if (currentStatus !== 'recruiting') {
        issues.push({
          code: 'ILLEGAL_TRANSITION',
          severity: 'blocking',
          message: `班级当前状态为 [${currentStatus}]，非招生中(recruiting)禁止重复开班`,
        });
      }
      const minReq = cmd.minStudentCount !== undefined ? cmd.minStudentCount : 1;
      if (activePackages.length < minReq) {
        issues.push({
          code: 'MIN_CAPACITY_NOT_MET',
          severity: 'blocking',
          message: `在读学员仅 ${activePackages.length} 人，未达最低开班要求 ${minReq} 人`,
        });
      }
    } else if (cmd.action === 'complete') {
      targetStatus = 'completed';
      if (currentStatus === 'completed') {
        issues.push({
          code: 'ILLEGAL_TRANSITION',
          severity: 'blocking',
          message: '班级已处于已结课状态，禁止重复结课',
        });
      }

      if (cmd.disposition?.mode === 'transfer_next_class') {
        if (!cmd.disposition.targetClassId) {
          issues.push({
            code: 'TARGET_CLASS_NOT_FOUND',
            severity: 'blocking',
            message: '批量升班必须指定目标班级 ID',
          });
        } else {
          const target = await this.prisma.class.findUnique({
            where: { id: cmd.disposition.targetClassId },
          });
          if (!target) {
            issues.push({
              code: 'TARGET_CLASS_NOT_FOUND',
              severity: 'blocking',
              message: `目标班级不存在 (ID: ${cmd.disposition.targetClassId})`,
            });
          } else {
            targetCapBefore = target.capacity - target.currentStudentCount;
            targetCapAfter = targetCapBefore - activePackages.length;
            if (targetCapAfter < 0) {
              issues.push({
                code: 'TARGET_CLASS_CAPACITY_EXCEEDED',
                severity: 'blocking',
                message: `目标班级「${target.name}」剩余名额 ${targetCapBefore} 人，无法容纳升入的 ${activePackages.length} 人`,
              });
            }
          }
        }
      } else if (cmd.disposition?.mode === 'archive_completed') {
        const hasSurplus = activePackages.some((p) => p.remainingLessons > 0);
        if (hasSurplus) {
          issues.push({
            code: 'UNCONSUMED_LESSONS_REMAIN',
            severity: 'blocking',
            message: '班内学员仍有未消课时，直接归档将导致课时损失，建议选择「回退待分班池」',
          });
        }
      }
    } else if (cmd.action === 'cancel') {
      targetStatus = 'cancelled';
      if (auditedHistoricalAttendanceCount > 0) {
        issues.push({
          code: 'HISTORICAL_ATTENDANCE_LOCKED',
          severity: 'info',
          message: `班级存在 ${auditedHistoricalAttendanceCount} 节历史考勤记录，将采用软解散归档保护，历史学情与考勤数据安全保留`,
        });
      }
    }

    const blockingIssues = issues.filter((i) => i.severity === 'blocking');
    const allowed = blockingIssues.length === 0;

    let summary = `准备执行 [${cmd.action}] 动作。`;
    if (cmd.action === 'complete') {
      summary = `结课预演：将妥善安置 ${activePackages.length} 名在读学员，释放 ${cancelledScheduleCount} 节未来排课，锁定保全 ${auditedHistoricalAttendanceCount} 条历史消课记录。`;
    } else if (cmd.action === 'cancel') {
      summary = `解散预演：${activePackages.length} 名学员课包将全量退回待分班资产池，撤销 ${cancelledScheduleCount} 节未上排课。`;
    } else if (cmd.action === 'activate') {
      summary = `开班预演：当前 ${activePackages.length} 名学员学籍将推进为在读，激活班级排课。`;
    }

    return {
      allowed,
      classId: cls.id,
      className: cls.name,
      action: cmd.action,
      currentStatus,
      targetStatus,
      issues,
      impact: {
        affectedStudentCount: activePackages.length,
        affectedPackageCount: activePackages.length,
        cancelledScheduleCount,
        auditedHistoricalAttendanceCount,
        freedClassroomSlots: cancelledScheduleCount,
        targetClassRemainingCapacityBefore: targetCapBefore,
        targetClassRemainingCapacityAfter: targetCapAfter,
      },
      summary,
    };
  }
}
