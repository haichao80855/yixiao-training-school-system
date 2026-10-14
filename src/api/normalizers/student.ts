import type { Student, StudentCoursePackage, WalletLedgerItem, StudentStatus } from '@/types/student';

export function normalizeCoursePackage(raw: any): StudentCoursePackage {
  if (!raw) return {} as StudentCoursePackage;
  const packageId = raw.id || raw.packageId || '';
  return {
    id: packageId,
    packageId,
    courseId: raw.courseId || raw.course?.id || '',
    courseName: raw.courseName || raw.course?.name || '标准课程',
    pricePerLesson: Number(raw.pricePerLesson ?? raw.course?.pricePerLesson ?? 0),
    totalLessons: Number(raw.totalLessons || 0),
    remainingLessons: Number(raw.remainingLessons || 0),
    consumedLessons: Number(raw.consumedLessons || 0),
    bonusLessons: Number(raw.bonusLessons || 0),
    expireDate: raw.expireDate || (raw.expiryDate ? String(raw.expiryDate).split('T')[0] : '2027-12-31'),
    expiryDate: raw.expiryDate ? String(raw.expiryDate).split('T')[0] : (raw.expireDate || '2027-12-31'),
    status: (raw.status || 'active') as 'active' | 'frozen' | 'refunded' | 'completed',
    classId: raw.classId || raw.class?.id || undefined,
    className: raw.className || raw.class?.name || undefined,
    orderNo: raw.orderNo || undefined,
    teacherName: raw.teacherName || raw.class?.teacher?.realName || undefined,
  };
}

export function normalizeWalletLedger(raw: any): WalletLedgerItem {
  return {
    id: raw.id || '',
    type: raw.type || 'recharge',
    amount: Number(raw.amount || 0),
    principalChange: Number(raw.principalChange || 0),
    bonusChange: Number(raw.bonusChange || 0),
    time: raw.createdAt ? String(raw.createdAt).replace('T', ' ').slice(0, 19) : (raw.time || ''),
    orderNo: raw.orderNo || undefined,
    description: raw.description || '',
    operator: raw.operator || '财务学管',
  };
}

export function normalizeLearningRecord(raw: any): any {
  if (!raw) return null;
  const statusMap: Record<string, 'attended' | 'leave' | 'absent' | 'late'> = {
    present: 'attended',
    attended: 'attended',
    leave: 'leave',
    absent: 'absent',
    late: 'late',
  };
  const status = statusMap[raw.status] || 'attended';
  const date = raw.date ? String(raw.date).split('T')[0] : (raw.createdAt ? String(raw.createdAt).split('T')[0] : '2026-09-01');
  const courseName = raw.courseName || raw.scheduleEvent?.class?.name || '标准课程';
  const lessonName = raw.lessonName || (raw.className ? `${raw.className}随堂课` : (raw.scheduleEvent?.class?.name ? `${raw.scheduleEvent.class.name}随堂课` : '实操课'));
  const teacher = raw.teacherName || raw.teacher || raw.operator || '主讲老师';

  return {
    id: raw.id || raw.recordId || '',
    date,
    lessonName,
    courseName,
    className: raw.className || undefined,
    teacher,
    classroomName: raw.classroomName || undefined,
    status,
    score: Number(raw.score ?? 90),
    rating: raw.rating || (Number(raw.score) >= 90 ? 'A+' : Number(raw.score) >= 80 ? 'A' : 'B+'),
    comment: raw.comment || '随堂听课专注，当堂实操表现良好。',
    homeworkRating: raw.homeworkRating || 'A',
    artworkUrl: raw.artworkUrl || undefined,
    quizScore: raw.quizScore !== undefined ? Number(raw.quizScore) : (raw.score !== undefined ? Number(raw.score) : undefined),
    deductLessons: Number(raw.deductLessons ?? 1),
    isReversed: Boolean(raw.isReversed),
    reversalReason: raw.reversalReason || undefined,
    reversedAt: raw.reversedAt || undefined,

    // 多媒体课评相册流扩展透传
    lessonTitle: raw.lessonTitle || lessonName,
    photoList: Array.isArray(raw.photoList) ? raw.photoList : [],
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    videoUrl: raw.videoUrl || undefined,
    videoMeta: raw.videoMeta || undefined,
    voiceUrl: raw.voiceUrl || undefined,
    voiceMeta: raw.voiceMeta || undefined,
    studyContent: raw.studyContent || undefined,
    studyContentHtml: raw.studyContentHtml || undefined,
    performanceTag: raw.performanceTag || undefined,
    shareToken: raw.shareToken || undefined,
  };
}

export function normalizeStudent(raw: any): Student {
  if (!raw) return {} as Student;

  // 1. 课包列表规范化
  const rawPackages = Array.isArray(raw.packages) ? raw.packages : (raw.coursePackages || []);
  const coursePackages = rawPackages.map(normalizeCoursePackage);

  // 2. 课时汇总计算
  const totalRemainingLessons = raw.totalRemainingLessons !== undefined
    ? Number(raw.totalRemainingLessons)
    : coursePackages.reduce((sum: number, p: StudentCoursePackage) => sum + (p.remainingLessons || 0), 0);

  const totalConsumedLessons = raw.totalConsumedLessons !== undefined
    ? Number(raw.totalConsumedLessons)
    : coursePackages.reduce((sum: number, p: StudentCoursePackage) => sum + (p.consumedLessons || 0), 0);

  const totalLessons = raw.totalLessons !== undefined
    ? Number(raw.totalLessons)
    : (totalRemainingLessons + totalConsumedLessons);

  // 3. 消课预警级别推导
  let warningLevel = raw.warningLevel || 'none';
  if (warningLevel === 'none' && coursePackages.length > 0) {
    if (totalRemainingLessons <= 4) warningLevel = 'urgent';
    else if (totalRemainingLessons <= 8) warningLevel = 'warning';
  }

  // 4. 钱包结构规范化
  const principalBalance = Number(raw.principalBalance ?? raw.wallet?.principalBalance ?? 0);
  const bonusBalance = Number(raw.bonusBalance ?? raw.wallet?.bonusBalance ?? 0);
  const goldPoints = Number(raw.goldPoints ?? raw.wallet?.goldPoints ?? 0);
  const rawLedger = Array.isArray(raw.walletLedgers) ? raw.walletLedgers : (raw.wallet?.ledger || []);

  const wallet = {
    principalBalance,
    bonusBalance,
    goldPoints,
    ledger: rawLedger.map(normalizeWalletLedger),
  };

  // 5. 消课健康度与流失预警单一真值源 (SSOT)
  const rawHealth = raw.consumptionHealth || raw.learningPortfolio?.consumptionHealth;
  const consumptionHealth = rawHealth ? {
    weeklyBurnRate: Number(rawHealth.weeklyBurnRate || 0),
    estimatedDepletionDays: Number(rawHealth.estimatedDepletionDays || 999),
    warningLevel: (rawHealth.warningLevel || 'normal') as 'normal' | 'warning' | 'urgent',
    dormantRisk: Boolean(rawHealth.dormantRisk),
    renewalWindowOpen: Boolean(rawHealth.renewalWindowOpen),
  } : undefined;

  if (consumptionHealth?.warningLevel) {
    warningLevel = consumptionHealth.warningLevel;
  }

  // 6. 学情成长时间轴与五维能力雷达
  const rawLearningRecords = Array.isArray(raw.learningRecords) && raw.learningRecords.length > 0
    ? raw.learningRecords
    : (Array.isArray(raw.timeline) && raw.timeline.length > 0
      ? raw.timeline
      : (Array.isArray(raw.attendances) ? raw.attendances : []));
  const learningRecords = rawLearningRecords.map(normalizeLearningRecord).filter(Boolean);

  const rawRadar = raw.growthRadar || raw.learningPortfolio?.growthSummary?.radar;
  const growthRadar = rawRadar ? {
    logic: Number(rawRadar.logic ?? 85),
    creativity: Number(rawRadar.creativity ?? 80),
    focus: Number(rawRadar.focus ?? 85),
    handsOn: Number(rawRadar.handsOn ?? 90),
    expression: Number(rawRadar.expression ?? 80),
    averageScore: Number(rawRadar.averageScore ?? 84),
  } : undefined;

  const createdAt = raw.createdAt ? String(raw.createdAt).split('T')[0] : '2026-09-01';

  return {
    id: raw.id,
    studentNo: raw.studentNo || '',
    name: raw.name || '',
    gender: (raw.gender === 'female' ? 'female' : 'male') as 'male' | 'female',
    age: raw.age !== undefined ? Number(raw.age) : 8,
    grade: raw.grade || '小学三年级',
    school: raw.school || raw.publicSchool || '中关村第一小学',
    publicSchool: raw.school || raw.publicSchool || '中关村第一小学',
    phone: raw.phone || '',
    parentName: raw.parentName || '家长',
    parentPhone: raw.parentPhone || raw.phone || '',
    parentWechat: raw.parentWechat || raw.wechatOpenId || '',
    boundWechat: raw.boundWechat || raw.wechatOpenId || '',
    wechatBound: Boolean(raw.wechatOpenId || raw.wechatBound),
    faceEntered: Boolean(raw.faceVector || raw.faceEntered),
    faceImageUrl: raw.faceImageUrl || raw.avatar || '',
    avatar: raw.avatar || raw.faceImageUrl || '',
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '总部校区',
    status: (raw.status || 'normal') as StudentStatus,
    wallet,
    coursePackages,
    learningRecords,
    growthRadar,
    consumptionHealth,
    communicationRecords: raw.communicationRecords || [],
    competitionRecords: raw.competitionRecords || [],
    albumGallery: Array.isArray(raw.albumGallery) ? raw.albumGallery : (raw.learningPortfolio?.albumGallery || []),
    portfolioShareToken: raw.portfolioShareToken || raw.learningPortfolio?.portfolioShareToken || '',
    createdAt,
    updatedAt: raw.updatedAt ? String(raw.updatedAt).split('T')[0] : undefined,
    // 兼容历史视图直接访问属性
    ...({
      totalRemainingLessons,
      totalConsumedLessons,
      totalLessons,
      remainingLessons: totalRemainingLessons,
      consumedLessons: totalConsumedLessons,
      balance: principalBalance,
      warningLevel,
    } as any),
  };
}

export const normalizeStudentProfile = normalizeStudent;
