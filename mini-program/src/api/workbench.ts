/**
 * 拓视未来教育「一校教培系统」工作台常用功能自定序与业务矩阵 API
 */
import { resolveIconName } from '../utils/icons';

export interface QuickActionItem {
  id: string;
  name: string;
  icon: string;
  bg: string;
  path: string;
  category: 'edu' | 'student' | 'finance' | 'crm' | 'curriculum';
  badge?: string;
}

export type QuickAction = QuickActionItem;

export interface ActionCategoryGroup {
  category: string;
  title: string;
  items: QuickActionItem[];
}

export const WORKBENCH_STORAGE_KEY = 'yixiao_mp_workbench_quick_actions';

// 统一现代 M3 蓝色容器背景色
const M3_BLUE_BG = '#EEF2FF';

// 默认 8 宫格快捷项 (对齐截图 002)
export const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'course_manage', name: '课程管理', icon: 'book-open', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'curriculum' },
  { id: 'receipt_approval', name: '收款审批', icon: 'receipt', bg: M3_BLUE_BG, path: '/package-finance/approval/index', category: 'finance' },
  { id: 'make_up_lesson', name: '补课管理', icon: 'calendar-plus', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'edu' },
  { id: 'lecture_podium', name: '讲台', icon: 'presentation', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'edu' },
  { id: 'class_manage', name: '班级管理', icon: 'building-2', bg: M3_BLUE_BG, path: '/package-edu/class/index', category: 'edu' },
  { id: 'student_all', name: '全部学员', icon: 'users', bg: M3_BLUE_BG, path: '/package-student/list/index', category: 'student' },
  { id: 'my_resources', name: '我的资源', icon: 'folder-user', bg: M3_BLUE_BG, path: '/package-student/list/index', category: 'crm' },
  { id: 'student_enroll', name: '学员报名', icon: 'user-plus', bg: M3_BLUE_BG, path: '/package-student/enroll/wizard', category: 'student' },
];

// 可选业务功能库全集 (5大业务分类共 29 项，对齐截图 002, 035, 049)
export const ALL_AVAILABLE_ACTIONS: Record<string, QuickActionItem[]> = {
  教研: [
    { id: 'course_manage', name: '课程管理', icon: 'book-open', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'curriculum' },
  ],
  学员: [
    { id: 'student_all', name: '全部学员', icon: 'users', bg: M3_BLUE_BG, path: '/package-student/list/index', category: 'student' },
    { id: 'student_unassigned', name: '待分班学员', icon: 'clock', bg: M3_BLUE_BG, path: '/package-student/list/index?tab=unassigned', category: 'student' },
    { id: 'student_enroll', name: '学员报名', icon: 'user-plus', bg: M3_BLUE_BG, path: '/package-student/enroll/wizard', category: 'student' },
  ],
  教务: [
    { id: 'lecture_podium', name: '讲台', icon: 'presentation', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'edu' },
    { id: 'class_manage', name: '班级管理', icon: 'building-2', bg: M3_BLUE_BG, path: '/package-edu/class/index', category: 'edu' },
    { id: 'my_students', name: '我的学员', icon: 'user', bg: M3_BLUE_BG, path: '/package-student/list/index', category: 'edu' },
    { id: 'my_classes', name: '我的班级', icon: 'school', bg: M3_BLUE_BG, path: '/package-edu/class/index', category: 'edu' },
    { id: 'make_up_lesson', name: '补课管理', icon: 'calendar-plus', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'edu' },
    { id: 'lesson_consumption', name: '课消记录', icon: 'clipboard-list', bg: M3_BLUE_BG, path: '/package-edu/lecture/roll-call', category: 'edu' },
    { id: 'lesson_audit', name: '课消审核', icon: 'shield-check', bg: M3_BLUE_BG, path: '/package-edu/lecture/roll-call', category: 'edu' },
    { id: 'evaluation_manage', name: '课评管理', icon: 'star', bg: M3_BLUE_BG, path: '/package-edu/evaluation/manage', category: 'edu' },
    { id: 'student_warning', name: '学员预警', icon: 'alert-triangle', bg: M3_BLUE_BG, path: '/package-edu/warning/index', category: 'edu' },
    { id: 'course_selling', name: '售卖课程', icon: 'tag', bg: M3_BLUE_BG, path: '/package-edu/lecture/index', category: 'edu' },
  ],
  财务: [
    { id: 'order_manage', name: '订单管理', icon: 'file-text', bg: M3_BLUE_BG, path: '/package-finance/orders/index', category: 'finance' },
    { id: 'receipt_approval', name: '收款审批', icon: 'receipt', bg: M3_BLUE_BG, path: '/package-finance/approval/index', category: 'finance' },
    { id: 'transfer_approval', name: '异动审批', icon: 'arrow-left-right', bg: M3_BLUE_BG, path: '/package-finance/approval/index?type=transfer', category: 'finance' },
    { id: 'refund_approval', name: '退费审批', icon: 'rotate-ccw', bg: M3_BLUE_BG, path: '/package-finance/approval/index?type=refund', category: 'finance' },
  ],
  CRM: [
    { id: 'my_resources', name: '我的资源', icon: 'folder-user', bg: M3_BLUE_BG, path: '/package-student/list/index', category: 'crm' },
    { id: 'deals_data', name: '成单数据', icon: 'bar-chart-3', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'group_data', name: '组内数据', icon: 'users-round', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'pending_leads', name: '待分配线索', icon: 'inbox', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'audition_records', name: '试听记录', icon: 'headphones', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'work_efficiency', name: '工作效率', icon: 'timer', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'performance_stats', name: '业绩统计', icon: 'trending-up', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'channel_stats', name: '渠道统计', icon: 'globe', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'crm_public_pool', name: '公海线索', icon: 'waves', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'crm_recycle', name: '回收站线索', icon: 'trash-2', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
    { id: 'all_leads', name: '全部线索', icon: 'target', bg: M3_BLUE_BG, path: '/package-crm/leads/index', category: 'crm' },
  ],
};

/**
 * 获取默认 8 宫格
 */
export function getDefaultQuickActions(): QuickActionItem[] {
  return [...DEFAULT_QUICK_ACTIONS];
}

/**
 * 获取按大类分组的所有可选业务功能库 (5 大类 29 项)
 */
export function getAllAvailableActions(): ActionCategoryGroup[] {
  return Object.entries(ALL_AVAILABLE_ACTIONS).map(([category, items]) => ({
    category,
    title: category,
    items,
  }));
}

/**
 * 读取用户持久化快捷功能配置 (不存在或异常时回退默认 8 宫格)
 */
export function getUserQuickActions(): QuickActionItem[] {
  try {
    const raw = uni.getStorageSync(WORKBENCH_STORAGE_KEY);
    if (!raw) return getDefaultQuickActions();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 8) {
      return parsed.map((item) => ({
        ...item,
        icon: resolveIconName(item.icon),
      }));
    }
  } catch (e) {
    console.warn('[Workbench] 读取持久化配置异常，回退默认:', e);
  }
  return getDefaultQuickActions();
}

/**
 * 保存用户自定序快捷功能配置 (边界检查与去重)
 */
export function saveUserQuickActions(
  actions: QuickActionItem[]
): { success: boolean; message?: string } {
  if (!Array.isArray(actions)) {
    return { success: false, message: '快捷功能数据格式不合法' };
  }
  if (actions.length < 1) {
    return { success: false, message: '至少保留1个常用功能，不能全部清空' };
  }
  if (actions.length > 8) {
    return { success: false, message: '最多添加8个常用功能，请先移除已有功能' };
  }

  const idSet = new Set(actions.map((a) => a.id));
  if (idSet.size !== actions.length) {
    return { success: false, message: '常用功能项存在重复' };
  }

  try {
    uni.setStorageSync(WORKBENCH_STORAGE_KEY, JSON.stringify(actions));
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || '保存失败' };
  }
}

/**
 * 添加单项快捷功能
 */
export function addQuickAction(action: QuickActionItem): { success: boolean; message?: string } {
  const current = getUserQuickActions();
  if (current.some((a) => a.id === action.id)) {
    return { success: false, message: '该功能已在常用列表中' };
  }
  if (current.length >= 8) {
    return { success: false, message: '最多只能添加8个常用功能' };
  }
  current.push(action);
  return saveUserQuickActions(current);
}

/**
 * 移除单项快捷功能
 */
export function removeQuickAction(actionId: string): { success: boolean; message?: string } {
  const current = getUserQuickActions();
  if (current.length <= 1) {
    return { success: false, message: '至少保留1个常用功能' };
  }
  const next = current.filter((a) => a.id !== actionId);
  return saveUserQuickActions(next);
}

/**
 * 重新排序快捷功能
 */
export function reorderQuickActions(fromIndex: number, toIndex: number): QuickActionItem[] {
  const current = getUserQuickActions();
  if (
    fromIndex < 0 ||
    fromIndex >= current.length ||
    toIndex < 0 ||
    toIndex >= current.length ||
    fromIndex === toIndex
  ) {
    return current;
  }
  const item = current.splice(fromIndex, 1)[0];
  current.splice(toIndex, 0, item);
  saveUserQuickActions(current);
  return current;
}

export const workbenchApi = {
  getDefaultQuickActions,
  getAllAvailableActions,
  getUserQuickActions,
  saveUserQuickActions,
  addQuickAction,
  removeQuickAction,
  reorderQuickActions,
};
