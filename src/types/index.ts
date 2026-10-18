// ==========================================
// 拓视未来教育「一校教培系统」核心数据契约类型规范
// 对应 PROJECT.md 与 MODULE_ANALYSIS_DESIGN.md
// ==========================================

// --- 1. 租户与校区上下文契约 ---
export interface Campus {
  id: string;
  code: string;
  name: string;
  isHeadquarter: boolean;
  address?: string;
  phone?: string;
}

export interface TenantState {
  companyId: string;
  companyName: string;
  stockCode: string;
  currentCampusId: string;
  campuses: Campus[];
}

// --- 2. 教研模块契约 ---
export type CourseAttribute = 'regular' | 'extended' | 'activity' | 'trial' | 'training';
export type CourseStatus = 'enabled' | 'disabled';

export interface CourseItem {
  id: string;
  name: string;
  code: string;
  cover: string;
  pricePerLesson: number;
  totalLessons: number;
  subject: string;
  grade: string;
  attribute: CourseAttribute;
  status: CourseStatus;
  authorizedCampusIds: string[];
  description?: string;
}

// --- 3. 学员中心契约 ---
export * from './student'

// --- 4. 教务排课与冲突检测契约 ---
export * from './educational'

// --- 5. 财务中心契约 ---
export * from './financial'

// --- 6. 系统设置与 RBAC 契约 ---
export * from './system'

// --- 7. 导航与标签栏契约 ---
export interface TagViewItem {
  name: string;
  path: string;
  title: string;
  fullPath?: string;
  affix?: boolean;
}

export interface MicroSystemItem {
  id: string;
  name: string;
  rootPath: string;
  icon?: string;
  badge?: string;
  badgeType?: 'danger' | 'warning' | 'primary';
}

