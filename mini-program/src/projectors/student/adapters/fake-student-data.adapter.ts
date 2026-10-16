import type { StudentDataPort } from '../ports';
import type { RosterQuery } from '../types';
import {
  normalizeStatus,
  calculateStudentAssets,
  computeConsumptionRisk,
} from '../normalizer';

/**
 * 测试与离线拟真适配器 (Fake Student Data Adapter)
 * 供单元测试、离线契约验证与沙箱演示使用，彻底隔离对业务核心逻辑的侵入
 */
export class FakeStudentDataAdapter implements StudentDataPort {
  private students: any[] = [];
  private profiles: Map<string, any> = new Map();
  private shouldFailNetwork = false;
  private failureError: Error | null = null;

  constructor(
    initialStudents?: any[],
    initialProfiles?: Record<string, any>
  ) {
    if (initialStudents && initialStudents.length > 0) {
      this.students = JSON.parse(JSON.stringify(initialStudents));
    }
    if (initialProfiles) {
      for (const [id, prof] of Object.entries(initialProfiles)) {
        this.profiles.set(id, JSON.parse(JSON.stringify(prof)));
      }
    }
  }

  /**
   * 模拟开启或关闭网络熔断/异常
   */
  setNetworkFailure(fail: boolean, error?: Error): void {
    this.shouldFailNetwork = fail;
    this.failureError = error || new Error('NetworkConnectionError: Simulated network timeout (504 Gateway Timeout)');
  }

  /**
   * 动态播种学员简要名册数据
   */
  seedStudent(student: any): void {
    const idx = this.students.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      this.students[idx] = JSON.parse(JSON.stringify(student));
    } else {
      this.students.push(JSON.parse(JSON.stringify(student)));
    }
  }

  /**
   * 动态播种学员详情全息档案
   */
  seedProfile(studentId: string, profile: any): void {
    this.profiles.set(studentId, JSON.parse(JSON.stringify(profile)));
  }

  /**
   * 清空全部拟真数据
   */
  clear(): void {
    this.students = [];
    this.profiles.clear();
    this.shouldFailNetwork = false;
    this.failureError = null;
  }

  async fetchStudents(query?: RosterQuery): Promise<{ list: any[]; total: number }> {
    if (this.shouldFailNetwork) {
      throw this.failureError || new Error('Simulated network timeout');
    }

    let filtered = [...this.students];

    if (query?.keyword) {
      const kw = query.keyword.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          (s.name && String(s.name).toLowerCase().includes(kw)) ||
          (s.parentName && String(s.parentName).toLowerCase().includes(kw)) ||
          (s.phone && String(s.phone).includes(kw)) ||
          (s.studentNo && String(s.studentNo).toLowerCase().includes(kw))
      );
    }

    if (query?.campusId && query.campusId !== 'all') {
      const qCid = query.campusId;
      filtered = filtered.filter((s) => {
        if (Array.isArray(s.campusIds) && s.campusIds.includes(qCid)) return true;
        if (Array.isArray(s.campuses) && s.campuses.some((c: any) => (c?.id || c) === qCid)) return true;
        const cid = s.campusId || s.campus?.id;
        return cid === qCid;
      });
    }

    if (query?.status && query.status !== 'all' && query.status !== '全部状态') {
      filtered = filtered.filter((s) => {
        if (s.status === query.status) return true;
        const norm = normalizeStatus(s);
        return norm.status === query.status || (query.status === 'pending_assignment' && norm.inPendingAssetPool);
      });
    }

    if (query?.warningLevel && query.warningLevel.toLowerCase() !== 'all') {
      const targetLevel = query.warningLevel.toUpperCase();
      filtered = filtered.filter((s) => {
        const assets = calculateStudentAssets(s);
        const risk = computeConsumptionRisk(assets.totalRemainingLessons);
        return (
          risk.level === targetLevel ||
          (targetLevel === 'CRITICAL' && risk.level === 'URGENT')
        );
      });
    }

    const total = filtered.length;
    const page = query?.page || 1;
    const pageSize = query?.pageSize || 100;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      list: JSON.parse(JSON.stringify(paged)),
      total,
    };
  }

  async fetchStudentProfile(studentId: string): Promise<any> {
    if (this.shouldFailNetwork) {
      throw this.failureError || new Error('Simulated network timeout');
    }

    if (this.profiles.has(studentId)) {
      return JSON.parse(JSON.stringify(this.profiles.get(studentId)));
    }

    const matched = this.students.find((s) => s.id === studentId);
    if (matched) {
      return JSON.parse(JSON.stringify({
        ...matched,
        packages: matched.packages || [],
        courses: matched.courses || matched.packages || [],
        attendances: [],
        communications: [],
      }));
    }

    throw new Error(`[FakeStudentDataAdapter] 未找到学员 (ID: ${studentId})`);
  }
}
