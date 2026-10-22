import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChildRef, FORMER_STUDENT_ACCESS_DAYS, LEFT_STATUSES, ParentPrincipal } from './parent.types';

const DAY_MS = 86400000;

/**
 * 家长 ↔ 子女归属解析 (家长端唯一的授权来源)
 * 子女 = Student.phoneNormalized 与家长账号手机号一致的学员；已离校学员在离校后 90 天内只读可见。
 */
@Injectable()
export class ParentChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async listChildren(phone: string, now = new Date()): Promise<ChildRef[]> {
    const students = await this.prisma.student.findMany({
      where: { phoneNormalized: phone },
      include: { campus: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const children: ChildRef[] = [];
    for (const s of students) {
      const isLeft = LEFT_STATUSES.includes(s.status);
      if (!isLeft) {
        children.push(this.toRef(s, 'full', null));
        continue;
      }
      // 历史数据缺少 leftAt 时以 updatedAt 近似 (回填脚本会补齐)
      const leftAt = s.leftAt ?? s.updatedAt;
      const until = new Date(leftAt.getTime() + FORMER_STUDENT_ACCESS_DAYS * DAY_MS);
      if (until > now) children.push(this.toRef(s, 'read_only', until.toISOString()));
    }
    return children;
  }

  /**
   * 校验 studentId 属于当前家长；不属于时返回 404 (不暴露学员是否存在)
   * requireFull：课表、课程等仅在读学员可见的数据
   */
  async resolveChild(parent: ParentPrincipal, studentId: string, options: { requireFull?: boolean } = {}): Promise<ChildRef> {
    const children = await this.listChildren(parent.phone);
    const child = children.find((c) => c.studentId === studentId);
    if (!child) throw new NotFoundException('未找到该学员');
    if (options.requireFull && child.access !== 'full') {
      throw new ForbiddenException('该学员已离校，仅可查看历史课评与成长相册');
    }
    return child;
  }

  private toRef(s: any, access: ChildRef['access'], readOnlyUntil: string | null): ChildRef {
    return {
      studentId: s.id,
      name: s.name,
      campusId: s.campusId,
      campusName: s.campus?.name || '',
      status: s.status,
      access,
      readOnlyUntil,
    };
  }
}
