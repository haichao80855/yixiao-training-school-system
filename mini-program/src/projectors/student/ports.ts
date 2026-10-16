import type { RosterQuery } from './types';

/**
 * 学员数据服务端口 (Hexagonal Data Port)
 */
export interface StudentDataPort {
  /**
   * 检索学员名册列表
   */
  fetchStudents(query?: RosterQuery): Promise<{ list: any[]; total: number }>;

  /**
   * 获取指定学员的底层聚合档案
   */
  fetchStudentProfile(studentId: string): Promise<any>;
}

/**
 * 端侧学员投影缓存端口 (Hexagonal Cache Port)
 */
export interface StudentCachePort {
  get<T = any>(key: string): T | null;
  set<T = any>(key: string, value: T, ttlMs?: number): void;
  invalidate(key: string): void;
  clear(): void;
}
