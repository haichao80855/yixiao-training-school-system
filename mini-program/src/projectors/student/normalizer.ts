import type {
  NormalizedStudentStatus,
  NormalizedStatusResult,
  ConsumptionRiskProfile,
  StudentAssetSummary,
  ActionPermissionMatrix,
} from './types';

/**
 * 权威学籍状态机归一化纯函数 (SSOT Status Normalizer)
 *
 * 核心归一化逻辑：
 * 1. 终态与行政状态优先：suspended(停课), graduated(已结业), lost(已流失), transferred(已转校)
 * 2. 待分班资产池识别：若学员持有有效课包正剩余课时，但未编入任何具体班级，归一化为 pending_assignment
 * 3. 在读状态：持有有效课时且已进班，归一化为 in_class
 * 4. 未报读状态：无剩余课时且无在读班级，归一化为 not_enrolled
 */
export function normalizeStatus(raw: any): NormalizedStatusResult {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'not_enrolled',
      statusText: '未报读',
      tagClass: 'tag-unassigned',
      isAssignedClass: false,
      inPendingAssetPool: false,
    };
  }

  const rawStatus = String(raw.status || raw.studentInfo?.status || '').toLowerCase().trim();
  const rawStatusText = String(raw.statusText || raw.studentInfo?.statusText || '').trim();

  // 1. 显式行政与流失终态优先拦截
  if (
    rawStatus === 'suspended' ||
    rawStatus === 'disabled' ||
    rawStatus === 'inactive' ||
    rawStatusText === '停课' ||
    rawStatusText === '已禁用' ||
    rawStatusText === '禁用' ||
    raw.status === '停课' ||
    raw.status === '已禁用' ||
    raw.status === '禁用' ||
    raw.studentInfo?.status === '停课' ||
    raw.studentInfo?.status === 'suspended' ||
    raw.studentInfo?.status === 'disabled' ||
    raw.studentInfo?.status === 'inactive'
  ) {
    const hasClass = Boolean(
      (Array.isArray(raw.classes) && raw.classes.length > 0) ||
      (Array.isArray(raw.studentInfo?.classes) && raw.studentInfo.classes.length > 0) ||
      Number(raw.enrolledClassesCount ?? raw.studentInfo?.enrolledClassesCount) > 0 ||
      raw.isAssignedClass ||
      raw.studentInfo?.isAssignedClass
    );
    return {
      status: 'suspended',
      statusText: '停课',
      tagClass: 'tag-suspended',
      isAssignedClass: hasClass,
      inPendingAssetPool: false,
    };
  }

  if (
    rawStatus === 'graduated' ||
    rawStatus === 'completed' ||
    rawStatusText === '已结业' ||
    rawStatusText === '已毕业' ||
    raw.status === '已结业' ||
    raw.status === '已毕业' ||
    raw.studentInfo?.status === '已结业' ||
    raw.studentInfo?.status === 'completed'
  ) {
    return {
      status: 'graduated',
      statusText: '已结业',
      tagClass: 'tag-graduated',
      isAssignedClass: false,
      inPendingAssetPool: false,
    };
  }

  if (
    rawStatus === 'lost' ||
    rawStatus === 'dropped_out' ||
    rawStatusText === '已流失' ||
    raw.status === '已流失' ||
    raw.studentInfo?.status === '已流失' ||
    raw.studentInfo?.status === 'lost' ||
    raw.studentInfo?.status === 'dropped_out'
  ) {
    return {
      status: 'lost',
      statusText: '已流失',
      tagClass: 'tag-lost',
      isAssignedClass: false,
      inPendingAssetPool: false,
    };
  }

  if (
    rawStatus === 'transferred' ||
    rawStatusText === '已转校' ||
    raw.status === '已转校' ||
    raw.studentInfo?.status === '已转校' ||
    raw.studentInfo?.status === 'transferred'
  ) {
    return {
      status: 'transferred',
      statusText: '已转校',
      tagClass: 'tag-transferred',
      isAssignedClass: false,
      inPendingAssetPool: false,
    };
  }

  // 2. 课包与排班综合评估
  const rawPackages: any[] = Array.isArray(raw.packages)
    ? raw.packages
    : Array.isArray(raw.courses)
      ? raw.courses
      : Array.isArray(raw.studentInfo?.packages)
        ? raw.studentInfo.packages
        : Array.isArray(raw.studentInfo?.courses)
          ? raw.studentInfo.courses
          : [];

  const nonRefunded = rawPackages.filter((p) => p && p.status !== 'refunded' && p.status !== 'refund');

  const pkgLessons = nonRefunded.reduce((sum, p) => sum + (Number(p.remainingLessons) || 0), 0);
  const totalLessons = raw.totalRemainingLessons !== undefined
    ? Number(raw.totalRemainingLessons)
    : raw.studentInfo?.totalRemainingLessons !== undefined
      ? Number(raw.studentInfo.totalRemainingLessons)
      : raw.remainingLessons !== undefined
        ? Number(raw.remainingLessons)
        : raw.studentInfo?.remainingLessons !== undefined
          ? Number(raw.studentInfo.remainingLessons)
          : pkgLessons;

  const hasClasses = Boolean(
    (Array.isArray(raw.classes) && raw.classes.length > 0) ||
    (Array.isArray(raw.studentInfo?.classes) && raw.studentInfo.classes.length > 0)
  );
  const hasEnrolledCount = Number(raw.enrolledClassesCount ?? raw.studentInfo?.enrolledClassesCount) > 0;
  const hasAssignedFlag = Boolean(raw.isAssignedClass ?? raw.studentInfo?.isAssignedClass);
  const isExplicitlyInClass = rawStatus === 'in_class' || rawStatusText === '在读';
  const packageHasClass = nonRefunded.some((p) => {
    const hasRemainingLessons = p.remainingLessons !== undefined
      ? Number(p.remainingLessons) > 0
      : p.status === 'active';
    return (
      hasRemainingLessons &&
      Boolean(p.classId || (p.class && (p.class.id || p.class.name)) || p.className || p.isEnrolledClass)
    );
  });

  const isAssigned = hasClasses || hasEnrolledCount || hasAssignedFlag || packageHasClass || isExplicitlyInClass;

  // 3. 待分班资产池与在读判定
  if (totalLessons > 0) {
    if (isAssigned) {
      return {
        status: 'in_class',
        statusText: '在读',
        tagClass: 'tag-active',
        isAssignedClass: true,
        inPendingAssetPool: false,
      };
    }
    // 持有正课时但无班级 -> 待分班资产池
    return {
      status: 'pending_assignment',
      statusText: '待分班',
      tagClass: 'tag-pending',
      isAssignedClass: false,
      inPendingAssetPool: true,
    };
  }

  // 课时为 0 或未购课时的分支
  // 检查是否为已学完结业学员 (所有课包课时均已消耗完毕且无可用课时)
  const hasConsumedLessons = nonRefunded.some(
    (p) => (Number(p.consumedLessons) > 0 || p.status === 'completed') && (Number(p.remainingLessons) || 0) === 0
  );
  if (hasConsumedLessons) {
    return {
      status: 'graduated',
      statusText: '已结业',
      tagClass: 'tag-graduated',
      isAssignedClass: false,
      inPendingAssetPool: false,
    };
  }

  if (isAssigned) {
    return {
      status: 'in_class',
      statusText: '在读',
      tagClass: 'tag-active',
      isAssignedClass: true,
      inPendingAssetPool: false,
    };
  }

  if (
    rawStatus === 'pending_assignment' ||
    rawStatusText === '待分班' ||
    raw.status === '待分班' ||
    raw.studentInfo?.status === '待分班'
  ) {
    return {
      status: 'pending_assignment',
      statusText: '待分班',
      tagClass: 'tag-pending',
      isAssignedClass: false,
      inPendingAssetPool: true,
    };
  }

  return {
    status: 'not_enrolled',
    statusText: '未报读',
    tagClass: 'tag-unassigned',
    isAssignedClass: false,
    inPendingAssetPool: false,
  };
}

/**
 * 课包与钱包资产加权试算引擎
 *
 * 核心试算逻辑：
 * 1. 排他隔离退费课包（refunded 不计入有效资产）
 * 2. 冻结课时物理隔离（frozen 不可用于可用消课，单独输出 frozenLessons）
 * 3. 剩余课时与加权金额精确计算：sum(remainingLessons * pricePerLesson)
 * 4. 本金钱包与赠送金钱包严密隔离：本金用于实付/原路退费，赠送金专用于定向消耗
 */
export function calculateStudentAssets(raw: any): StudentAssetSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      totalRemainingLessons: 0,
      activeRemainingLessons: 0,
      frozenLessons: 0,
      totalRemainingAmount: 0,
      weightedPricePerLesson: 0,
      walletBalance: 0,
      principalBalance: 0,
      bonusBalance: 0,
      cardCount: 0,
    };
  }

  const rawPackages: any[] = Array.isArray(raw.packages)
    ? raw.packages
    : Array.isArray(raw.courses)
      ? raw.courses
      : Array.isArray(raw.studentInfo?.packages)
        ? raw.studentInfo.packages
        : Array.isArray(raw.studentInfo?.courses)
          ? raw.studentInfo.courses
          : [];

  const nonRefunded = rawPackages.filter((p) => p && p.status !== 'refunded' && p.status !== 'refund');

  // 1. 冻结课时隔离
  const frozenPkgs = nonRefunded.filter((p) => p.status === 'frozen');
  const frozenLessonsFromPkgs = frozenPkgs.reduce(
    (s, p) => s + (Number(p.remainingLessons) || 0),
    0
  );
  const frozenLessons = raw.frozenLessons !== undefined
    ? Number(raw.frozenLessons)
    : raw.studentInfo?.frozenLessons !== undefined
      ? Number(raw.studentInfo.frozenLessons)
      : frozenLessonsFromPkgs;

  // 2. 剩余总课时
  const pkgRemainingSum = nonRefunded.reduce(
    (s, p) => s + (Number(p.remainingLessons) || 0),
    0
  );
  const totalRemainingLessons = raw.totalRemainingLessons !== undefined
    ? Number(raw.totalRemainingLessons)
    : raw.studentInfo?.totalRemainingLessons !== undefined
      ? Number(raw.studentInfo.totalRemainingLessons)
      : raw.remainingLessons !== undefined
        ? Number(raw.remainingLessons)
        : raw.studentInfo?.remainingLessons !== undefined
          ? Number(raw.studentInfo.remainingLessons)
          : pkgRemainingSum;

  // 可用正课课时（排他隔离冻结课时）
  const activeRemainingLessons = Math.max(0, totalRemainingLessons - frozenLessons);

  // 3. 加权剩余金额试算
  let pkgAmountSum = 0;
  for (const p of nonRefunded) {
    const lessons = Number(p.remainingLessons) || 0;
    if (lessons === 0) {
      continue;
    }
    if (p.remainingAmount !== undefined) {
      pkgAmountSum += Number(p.remainingAmount) || 0;
    } else {
      const price = Number(p.pricePerLesson ?? p.course?.pricePerLesson ?? 0);
      pkgAmountSum += lessons * price;
    }
  }

  const totalRemainingAmount = totalRemainingLessons === 0
    ? 0
    : raw.totalRemainingAmount !== undefined
      ? Number(raw.totalRemainingAmount)
      : raw.studentInfo?.totalRemainingAmount !== undefined
        ? Number(raw.studentInfo.totalRemainingAmount)
        : raw.remainingAmount !== undefined
          ? Number(raw.remainingAmount)
          : raw.studentInfo?.remainingAmount !== undefined
            ? Number(raw.studentInfo.remainingAmount)
            : pkgAmountSum;

  const weightedPricePerLesson = totalRemainingLessons > 0
    ? Math.round((totalRemainingAmount / totalRemainingLessons) * 100) / 100
    : 0;

  // 4. 钱包账户严格本金与赠送金分离
  let principalBalance = Number(
    raw.walletSummary?.principalBalance ??
    raw.studentInfo?.walletSummary?.principalBalance ??
    raw.wallet?.principalBalance ??
    raw.studentInfo?.wallet?.principalBalance ??
    raw.principalBalance ??
    0
  ) || 0;
  const bonusBalance = Number(
    raw.walletSummary?.bonusBalance ??
    raw.studentInfo?.walletSummary?.bonusBalance ??
    raw.wallet?.bonusBalance ??
    raw.studentInfo?.wallet?.bonusBalance ??
    raw.bonusBalance ??
    0
  ) || 0;

  let walletBalance = raw.walletBalance !== undefined && raw.walletBalance !== null
    ? Number(raw.walletBalance)
    : (principalBalance + bonusBalance);

  if (isNaN(walletBalance)) {
    walletBalance = 0;
  }

  if (walletBalance > 0 && principalBalance === 0 && bonusBalance === 0) {
    principalBalance = walletBalance;
  }

  const cardCount = Number(
    raw.cardCount ?? raw.studentInfo?.cardCount ?? (Array.isArray(raw.cards) ? raw.cards.length : 0)
  );

  return {
    totalRemainingLessons,
    activeRemainingLessons,
    frozenLessons,
    totalRemainingAmount,
    weightedPricePerLesson,
    walletBalance,
    principalBalance,
    bonusBalance,
    cardCount,
  };
}

/**
 * 课消流失风险星级投影（ADR-0005 映射）
 * - URGENT: ≤4 课时（标红紧急预警）
 * - WARNING: 5~8 课时（标橙续费预警）
 * - HEALTHY: >8 课时（标绿健康存量）
 */
export function computeConsumptionRisk(remainingLessons: number): ConsumptionRiskProfile {
  const lessons = Number(remainingLessons) || 0;

  if (lessons <= 4) {
    return {
      level: 'URGENT',
      label: '紧急预警',
      isUrgent: true,
      warningWindow: true,
      stars: 1,
      color: '#EF4444',
    };
  }

  if (lessons <= 8) {
    return {
      level: 'WARNING',
      label: '续费预警',
      isUrgent: false,
      warningWindow: true,
      stars: 2,
      color: '#F59E0B',
    };
  }

  return {
    level: 'HEALTHY',
    label: '课消健康',
    isUrgent: false,
    warningWindow: false,
    stars: 3,
    color: '#10B981',
  };
}

/**
 * 业务操作权限矩阵推导引擎
 */
export function computeActionPermissions(
  status: NormalizedStudentStatus,
  assets: StudentAssetSummary
): ActionPermissionMatrix {
  const isTerminated = status === 'lost' || status === 'transferred';
  const isSuspended = status === 'suspended';

  return {
    canEnroll: !isTerminated && !isSuspended,
    canAdjustClass: (status === 'in_class' || status === 'pending_assignment') && !isSuspended,
    canRecharge: !isTerminated,
    canDisable: !isSuspended && !isTerminated,
    canRefund: assets.totalRemainingLessons > 0 || assets.walletBalance > 0,
  };
}
