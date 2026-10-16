import type {
  StudentCourseItemModel,
  AttendanceRecordItemModel,
  CommunicationRecordItemModel,
} from '../../api/student';
import type {
  RosterQuery,
  RosterResultView,
  RosterItemView,
  StudentDossierView,
  ProjectDossierOptions,
  NormalizedStatusResult,
} from './types';
import type { StudentDataPort, StudentCachePort } from './ports';
import {
  normalizeStatus,
  calculateStudentAssets,
  computeConsumptionRisk,
  computeActionPermissions,
} from './normalizer';
import { HttpStudentDataAdapter } from './adapters/http-student-data.adapter';
import { FakeStudentDataAdapter } from './adapters/fake-student-data.adapter';
import { MemoryStudentCacheAdapter } from './adapters/memory-student-cache.adapter';

/**
 * 微信小程序端侧学员档案全景投影深模块 (Client Student Dossier & Roster Projector)
 *
 * 核心架构特性：
 * 1. 极简外部接口 Interface：仅暴露 projectRoster 与 projectDossier 两个高杠杆入口，及 normalizeStatus 纯函数；
 * 2. 六边形端口与适配器 Seam：通过 StudentDataPort 与 StudentCachePort 实现与网络及存储的物理脱耦；
 * 3. 内部深实现 Implementation Depth：内聚权威学籍状态机推导、课包与钱包资产加权试算、ADR-0005 课消流失风险星级。
 */
export class ClientStudentProjector {
  constructor(
    private readonly dataPort: StudentDataPort = new HttpStudentDataAdapter(),
    private readonly cachePort: StudentCachePort = new MemoryStudentCacheAdapter()
  ) {}

  /**
   * 1. 学员名册列表权威投影 (Roster Projection)
   * 消除列表页散落的手写判断，自动输出归一化学籍标签、在班数、资产试算与 ADR-0005 风险评级
   */
  async projectRoster(query?: RosterQuery): Promise<RosterResultView> {
    try {
      const res = await this.dataPort.fetchStudents(query);
      const rawList = Array.isArray(res?.list) ? res.list : [];

      const list: RosterItemView[] = rawList.map((item: any) => {
        const norm = normalizeStatus(item);
        const assets = calculateStudentAssets(item);
        const risk = computeConsumptionRisk(assets.totalRemainingLessons);

        const rawPackages: any[] = Array.isArray(item.packages)
          ? item.packages
          : Array.isArray(item.courses)
            ? item.courses
            : [];
        const nonRefunded = rawPackages.filter((p) => p && p.status !== 'refunded');

        let enrolledClassesCount = 0;
        if (norm.isAssignedClass) {
          if (item.enrolledClassesCount !== undefined && item.enrolledClassesCount > 0) {
            enrolledClassesCount = Number(item.enrolledClassesCount);
          } else if (Array.isArray(item.classes) && item.classes.length > 0) {
            enrolledClassesCount = item.classes.length;
          } else {
            const classPkgCount = nonRefunded.filter((p) => {
              const hasLessons = p.remainingLessons !== undefined
                ? Number(p.remainingLessons) > 0
                : p.status === 'active';
              return hasLessons && Boolean(p.classId || p.class || p.className || p.isEnrolledClass);
            }).length;
            enrolledClassesCount = classPkgCount > 0 ? classPkgCount : 1;
          }
        }

        return {
          id: String(item.id || ''),
          name: String(item.name || '学员'),
          studentNo: String(item.studentNo || (item.id ? `S${String(item.id).slice(-6)}` : '')),
          phone: String(item.phone || item.contactPhone || ''),
          avatar: item.avatar,
          status: norm.status,
          statusText: norm.statusText,
          tagClass: norm.tagClass,
          remainingLessons: assets.totalRemainingLessons,
          remainingAmount: assets.totalRemainingAmount,
          enrolledClassesCount,
          campusId: String(
            item.campusId ||
            item.campus?.id ||
            (Array.isArray(item.campusIds) ? item.campusIds[0] : '') ||
            'campus-bj-hq'
          ),
          campusName: String(
            item.campusName ||
            item.campus?.name ||
            (Array.isArray(item.campuses) ? item.campuses.map((c: any) => c.name || c).join('、') : '') ||
            '总部校区'
          ),
          isAssignedClass: norm.isAssignedClass,
          inPendingAssetPool: norm.inPendingAssetPool,
          frozenLessons: assets.frozenLessons,
          risk,
        };
      });

      // 如果查询条件指定了状态或预警级别过滤，执行精准过滤
      let finalList = list;
      if (query?.status === 'pending_assignment') {
        finalList = list.filter(
          (s) => s.status === 'pending_assignment' || s.inPendingAssetPool
        );
      } else if (query?.status && query.status !== 'all' && query.status !== '全部状态') {
        finalList = list.filter((s) => s.status === query.status);
      }

      if (query?.warningLevel && query.warningLevel.toLowerCase() !== 'all') {
        const targetLevel = query.warningLevel.toUpperCase();
        finalList = finalList.filter(
          (s) =>
            s.risk.level === targetLevel ||
            (targetLevel === 'CRITICAL' && s.risk.level === 'URGENT')
        );
      }

      const isFiltered = Boolean(
        (query?.status && query.status !== 'all' && query.status !== '全部状态') ||
        (query?.warningLevel && query.warningLevel.toLowerCase() !== 'all')
      );

      return {
        list: finalList,
        total: isFiltered ? finalList.length : Number(res?.total ?? finalList.length),
      };
    } catch (err) {
      console.warn('[ClientStudentProjector] projectRoster 捕获异常，安全降级为空列表:', err);
      return { list: [], total: 0 };
    }
  }

  /**
   * 2. 学员全息档案全景投影 (Dossier Projection)
   * 聚合个人基本信息、权威学籍、多维资产试算、课消流失风险及操作权限矩阵
   */
  async projectDossier(
    studentId: string,
    options?: ProjectDossierOptions
  ): Promise<StudentDossierView> {
    const cacheKey = `dossier_${studentId}`;
    if (!options?.forceRefresh) {
      const cached = this.cachePort.get<StudentDossierView>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const raw = await this.dataPort.fetchStudentProfile(studentId);
      const info = raw?.studentInfo || raw || {};
      const norm = normalizeStatus(raw);
      const assets = calculateStudentAssets(raw);
      const risk = computeConsumptionRisk(assets.totalRemainingLessons);
      const permissions = computeActionPermissions(norm.status, assets);

      // 课程列表结构化投影
      const rawPackages: any[] = Array.isArray(raw.packages)
        ? raw.packages
        : Array.isArray(raw.courses)
          ? raw.courses
          : Array.isArray(info.packages)
            ? info.packages
            : [];

      const courses: StudentCourseItemModel[] = rawPackages.map((p: any) => {
        const remainingLessons = Number(p.remainingLessons ?? 0);
        const pricePerLesson = Number(p.pricePerLesson ?? p.course?.pricePerLesson ?? 0);
        const remainingAmount = p.remainingAmount !== undefined
          ? Number(p.remainingAmount)
          : remainingLessons * pricePerLesson;

        return {
          id: String(p.id || p.packageId || `sc-${p.courseId || '01'}`),
          courseId: String(p.courseId || p.course?.id || ''),
          courseName: String(p.course?.name || p.courseName || '未命名课程'),
          coverUrl: p.coverUrl || p.course?.coverUrl,
          classId: p.classId || p.class?.id,
          className: p.class?.name || p.className,
          isEnrolledClass: Boolean(
            p.classId ||
            (p.class && (p.class.id || p.class.name)) ||
            p.className ||
            p.isEnrolledClass
          ),
          remainingLessons,
          remainingAmount,
          totalLessons: Number(p.totalLessons ?? remainingLessons),
          expireDateText: (() => {
            const rawExp = p.expiryDate || p.expireDate || p.expireDateText;
            if (!rawExp || rawExp === '无限期') return '无限期';
            try {
              const d = new Date(rawExp);
              return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(rawExp);
            } catch {
              return String(rawExp);
            }
          })(),
        };
      });

      // 考勤记录结构化投影
      const rawAttendances: any[] = Array.isArray(raw.attendances) ? raw.attendances : [];
      const statusMap: Record<string, string> = {
        present: '已签到',
        leave: '请假',
        absent: '缺席',
        late: '迟到',
        pending: '待签到',
      };

      const attendances: AttendanceRecordItemModel[] = rawAttendances.map((a: any) => ({
        id: String(a.id || ''),
        scheduleId: String(a.scheduleEvent?.id || a.scheduleId || ''),
        className: String(a.scheduleEvent?.class?.name || a.className || '未排班'),
        courseName: String(a.courseName || a.scheduleEvent?.class?.course?.name || '课程'),
        classType: a.scheduleEvent?.semanticType === 'regular'
          ? '常规课'
          : (a.classType || '线下课'),
        status: a.status || 'present',
        statusText: statusMap[a.status] || a.statusText || '已签到',
        deductLessons: Number(a.deductLessons ?? 1),
        timeRangeText: a.scheduleEvent
          ? `${a.scheduleEvent.date} ${a.scheduleEvent.startTime}-${a.scheduleEvent.endTime}`
          : String(a.timeRangeText || ''),
        teacherName: String(a.teacherName || a.scheduleEvent?.teacher?.realName || ''),
      }));

      // 沟通记录
      const communications: CommunicationRecordItemModel[] = Array.isArray(raw.communications)
        ? raw.communications
        : [];

      let gender = '男';
      if (info.gender === 'female' || info.gender === '女') {
        gender = '女';
      }

      const dossier: StudentDossierView = {
        id: String(info.id || raw.id || studentId),
        name: String(info.name || raw.name || '学员'),
        studentNo: String(info.studentNo || raw.studentNo || ''),
        avatar: info.avatar || raw.avatar,
        gender,
        phone: String(info.phone || raw.phone || ''),
        guardianRelation: String(
          info.guardianRelation || (info.parentName ? '家长' : (raw.guardianRelation || '家长'))
        ),
        expireDateText: String(info.expireDateText || raw.expireDateText || '无限期'),
        channelSource: String(info.channelSource || raw.channelSource || '地推/活动派单'),
        campusName: String(info.campus?.name || raw.campus?.name || raw.campusName || '总部校区'),
        campusId: info.campusId || raw.campusId,

        // 权威学籍映射
        status: norm.statusText,
        normalizedStatus: norm.status,
        statusText: norm.statusText,
        tagClass: norm.tagClass,
        isAssignedClass: norm.isAssignedClass,
        inPendingAssetPool: norm.inPendingAssetPool,

        // 资产总览
        totalRemainingLessons: assets.totalRemainingLessons,
        activeRemainingLessons: assets.activeRemainingLessons,
        totalRemainingAmount: assets.totalRemainingAmount,
        walletBalance: assets.walletBalance,
        principalBalance: assets.principalBalance,
        bonusBalance: assets.bonusBalance,
        cardCount: assets.cardCount,
        frozenLessons: assets.frozenLessons,
        assets,

        // ADR-0005 课消流失风险
        consumptionRisk: risk,

        // 业务操作权限矩阵
        permissions,

        // 列表
        courses,
        attendances,
        communications,
      };

      // 写入内存缓存
      this.cachePort.set(cacheKey, dossier, options?.ttlMs ?? 60000);
      return dossier;
    } catch (err) {
      console.warn(`[ClientStudentProjector] projectDossier(${studentId}) 网络或数据异常，降级为安全0基线:`, err);
      const fallbackNorm = normalizeStatus({ status: 'not_enrolled' });
      const fallbackAssets = calculateStudentAssets({});
      const fallbackRisk = computeConsumptionRisk(0);
      const fallbackPermissions = computeActionPermissions('not_enrolled', fallbackAssets);

      return {
        id: studentId,
        name: '学员',
        studentNo: '',
        gender: '男',
        phone: '',
        guardianRelation: '家长',
        expireDateText: '无限期',
        channelSource: '其他',
        campusName: '总部校区',
        status: '未报读',
        normalizedStatus: 'not_enrolled',
        statusText: '未报读',
        tagClass: fallbackNorm.tagClass,
        isAssignedClass: false,
        inPendingAssetPool: false,
        totalRemainingLessons: 0,
        activeRemainingLessons: 0,
        totalRemainingAmount: 0,
        walletBalance: 0,
        principalBalance: 0,
        bonusBalance: 0,
        cardCount: 0,
        frozenLessons: 0,
        assets: fallbackAssets,
        consumptionRisk: fallbackRisk,
        permissions: fallbackPermissions,
        courses: [],
        attendances: [],
        communications: [],
      };
    }
  }

  /**
   * 纯函数：直接归一化状态
   */
  normalizeStatus(raw: any): NormalizedStatusResult {
    return normalizeStatus(raw);
  }

  /**
   * 淘汰指定学员的全息档案缓存
   */
  invalidateDossier(studentId: string): void {
    this.cachePort.invalidate(`dossier_${studentId}`);
  }

  /**
   * 淘汰待分班学员资产池及名册缓存
   */
  invalidatePendingAssetPool(): void {
    this.cachePort.invalidate('pending_asset_pool');
    this.cachePort.invalidate('unassigned_roster');
  }

  /**
   * 获取底层缓存端口（供单测与诊断使用）
   */
  getCachePort(): StudentCachePort {
    return this.cachePort;
  }

  /**
   * 清空所有端侧学员缓存
   */
  clearCache(): void {
    this.cachePort.clear();
  }

  /**
   * 工厂方法：装配指定端口适配器的投影器实例
   */
  createProjector(
    dataPort?: StudentDataPort,
    cachePort?: StudentCachePort
  ): ClientStudentProjector {
    return new ClientStudentProjector(dataPort, cachePort);
  }
}

/** 默认生产单例 */
export const studentProjector = new ClientStudentProjector();
(studentProjector as any).createProjector = (
  dataPort?: StudentDataPort,
  cachePort?: StudentCachePort
) => new ClientStudentProjector(dataPort, cachePort);
(studentProjector as any).ProjectorClass = ClientStudentProjector;
(studentProjector as any).FakeStudentDataAdapter = FakeStudentDataAdapter;
(studentProjector as any).HttpStudentDataAdapter = HttpStudentDataAdapter;
(studentProjector as any).MemoryStudentCacheAdapter = MemoryStudentCacheAdapter;
(studentProjector as any).normalizeStatus = normalizeStatus;
(studentProjector as any).calculateStudentAssets = calculateStudentAssets;
(studentProjector as any).computeConsumptionRisk = computeConsumptionRisk;
(studentProjector as any).computeActionPermissions = computeActionPermissions;
(studentProjector as any).invalidateDossier = (studentId: string) =>
  ClientStudentProjector.prototype.invalidateDossier.call(studentProjector, studentId);
(studentProjector as any).invalidatePendingAssetPool = () =>
  ClientStudentProjector.prototype.invalidatePendingAssetPool.call(studentProjector);
(studentProjector as any).getCachePort = () =>
  ClientStudentProjector.prototype.getCachePort.call(studentProjector);
(studentProjector as any).clearCache = () =>
  ClientStudentProjector.prototype.clearCache.call(studentProjector);

export {
  normalizeStatus,
  calculateStudentAssets,
  computeConsumptionRisk,
  computeActionPermissions,
  HttpStudentDataAdapter,
  FakeStudentDataAdapter,
  MemoryStudentCacheAdapter,
};
