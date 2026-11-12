import { Prisma } from '@prisma/client';

/**
 * 班级名额口径：一个学员在一个班级只占一个名额，不论他在这个班挂了几个课包。
 *
 * 老学员续费同一课程会新建一个课包 (每笔订单的单价、赠课、有效期各自独立，退费按课包结算)，
 * 新课包沿用原班级。此时班级人数不能再加 1；反过来，学员只退掉 / 转走其中一个课包、
 * 其余课包还在这个班时，班级人数也不能减 1。
 *
 * 不变量：学员在班级 C 占一个名额 ⇔ 他有 classId = C 且状态为 active / frozen / completed 的课包。
 * completed (课时用完) 的课包保留 classId，课时用完时系统也不扣班级人数，所以它仍占名额，
 * 老学员课时用完后再续费，新课包直接并入原班，不再加人数。
 * 释放名额时 (转班、换课、退费、转让)，学员在该班若已没有 active / frozen 的课包，
 * 就把人数减 1，并把他留在该班的 completed 课包一并移出班级，保持上面的不变量。
 */
export const SEAT_HOLDING_PACKAGE_STATUSES = ['active', 'frozen', 'completed'];
const LIVE_PACKAGE_STATUSES = ['active', 'frozen'];

/** 已结束的班级不再接收续费课包，续费改为待分班 */
export const CLOSED_CLASS_STATUSES = ['completed', 'cancelled', 'archived'];

type SeatClient = Pick<Prisma.TransactionClient, 'studentCoursePackage' | 'class'>;

/** 学员在该班级是否还有其他占名额的课包 (排除 excludePackageIds) */
export async function holdsSeatInClass(
  client: SeatClient,
  studentId: string,
  classId: string,
  excludePackageIds: string[] = [],
): Promise<boolean> {
  const count = await client.studentCoursePackage.count({
    where: {
      studentId,
      classId,
      status: { in: SEAT_HOLDING_PACKAGE_STATUSES },
      ...(excludePackageIds.length ? { id: { notIn: excludePackageIds } } : {}),
    },
  });
  return count > 0;
}

/**
 * 课包离开班级 (转班、换课、退费、转让) 时调用，在课包状态 / classId 变更之前或之后调用均可：
 * 学员在该班已没有其他 active / frozen 课包时，班级人数减 1，
 * 并把他残留在该班的 completed 课包移出班级。返回是否释放了名额。
 */
export async function releaseSeatIfLast(
  client: SeatClient,
  studentId: string,
  classId: string,
  leavingPackageIds: string[],
): Promise<boolean> {
  const exclude = leavingPackageIds.length ? { id: { notIn: leavingPackageIds } } : {};
  const liveSiblings = await client.studentCoursePackage.count({
    where: { studentId, classId, status: { in: LIVE_PACKAGE_STATUSES }, ...exclude },
  });
  if (liveSiblings > 0) {
    return false;
  }
  await client.class.updateMany({
    where: { id: classId, currentStudentCount: { gt: 0 } },
    data: { currentStudentCount: { decrement: 1 } },
  });
  await client.studentCoursePackage.updateMany({
    where: { studentId, classId, status: 'completed', ...exclude },
    data: { classId: null },
  });
  return true;
}

/**
 * 续费识别：学员在这门课程上最近一次所在、且仍在开的班级。
 * 没有则返回 null (首次报读，或原班已结班)。
 */
export async function findCurrentClassForCourse(
  client: SeatClient,
  studentId: string,
  courseId: string,
): Promise<{ id: string; name: string; capacity: number; currentStudentCount: number } | null> {
  const pkg = await client.studentCoursePackage.findFirst({
    where: {
      studentId,
      courseId,
      classId: { not: null },
      status: { in: SEAT_HOLDING_PACKAGE_STATUSES },
      class: { status: { notIn: CLOSED_CLASS_STATUSES } },
    },
    orderBy: { createdAt: 'desc' },
    include: { class: true },
  });
  if (!pkg?.class) return null;
  const { id, name, capacity, currentStudentCount } = pkg.class;
  return { id, name, capacity, currentStudentCount };
}

/**
 * 班级名单按学员合并课包：一个学员只出现一次。
 * - current：扣课用的课包，先扣最早买的 (按 createdAt 升序取第一个还有课时的)；
 * - remainingLessons / bonusLessons / totalLessons：该学员在本班所有在读课包的合计，用于显示和余额提醒。
 */
export interface StudentPackageGroup<P> {
  current: P;
  packages: P[];
  remainingLessons: number;
  bonusLessons: number;
  totalLessons: number;
}

export function groupPackagesByStudent<
  P extends {
    id: string;
    studentId: string;
    remainingLessons: number;
    bonusLessons: number;
    totalLessons: number;
    createdAt: Date;
  },
>(packages: P[]): Map<string, StudentPackageGroup<P>> {
  const sorted = [...packages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id),
  );
  const groups = new Map<string, StudentPackageGroup<P>>();
  for (const pkg of sorted) {
    const group = groups.get(pkg.studentId);
    if (!group) {
      groups.set(pkg.studentId, {
        current: pkg,
        packages: [pkg],
        remainingLessons: pkg.remainingLessons,
        bonusLessons: pkg.bonusLessons,
        totalLessons: pkg.totalLessons,
      });
      continue;
    }
    group.packages.push(pkg);
    group.remainingLessons += pkg.remainingLessons;
    group.bonusLessons += pkg.bonusLessons;
    group.totalLessons += pkg.totalLessons;
    if (group.current.remainingLessons <= 0 && pkg.remainingLessons > 0) {
      group.current = pkg;
    }
  }
  return groups;
}
