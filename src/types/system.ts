// ==========================================
// 系统设置与 RBAC 中台模块数据契约定义
// 对应 PROJECT.md § Feature 24, 25 及 MODULE_ANALYSIS_DESIGN.md § 六
// ==========================================

// --- 1. 5 级组织架构模型 (Org Tree) ---
export type OrgNodeType = 'group' | 'region' | 'campus' | 'department' | 'post'

export interface OrgNode {
  id: string
  name: string
  code: string
  type: OrgNodeType
  level: number // 1: 集团(group), 2: 大区(region), 3: 校区(campus), 4: 部门(department), 5: 岗位(post)
  parentId?: string | null
  boundUserCount?: number
  leader?: string
  phone?: string
  status?: 'active' | 'disabled'
  children?: OrgNode[]
}

export interface OrgTreeValidationResult {
  canDelete: boolean
  node?: OrgNode
  reason?: string
}

// --- 2. 4 级细粒度 RBAC 权限模型 ---
export type PermissionLevel = 'system' | 'module' | 'page' | 'button'

export interface CheckState {
  checked: boolean
  indeterminate: boolean
}

export interface PermissionNode {
  id: string
  name?: string
  label: string
  code: string // 如 'curriculum:course:add', 'admin:all', '*'
  level: PermissionLevel
  parentId?: string | null
  checked?: boolean
  indeterminate?: boolean
  children?: PermissionNode[]
}

// --- 3. 角色与多校区数据透视范围模型 ---
export type DataScope = 'all' | 'campus' | 'department' | 'self'

export interface RoleItem {
  id: string
  name: string
  code: string
  description?: string
  userCount: number
  dataScope: DataScope
  permissions: string[]
  isSystem?: boolean
  createdAt?: string
}

export interface UserDataScopeConfig {
  userId: string
  dataScope: DataScope
  customCampusIds?: string[]
  customDeptIds?: string[]
}

// --- 4. 系统员工/人员模型 ---
export interface SystemUser {
  id: string
  name: string
  account: string
  phone: string
  email?: string
  avatar?: string
  campusId: string
  campusName: string
  departmentId: string
  departmentName: string
  postId: string
  postName: string
  roleId: string
  roleName: string
  dataScope: DataScope
  status: 'active' | 'locked'
  permissions?: string[]
  createdAt: string
}

// --- 5. 业务参数与异动原因数据字典模型 ---
export type DictCategory = 'trans_reason' | 'warning_rule' | 'lesson_duration' | 'attendance_mode' | string

export interface DictItem {
  id: string
  category: DictCategory
  dictKey: string
  label: string
  order: number
  enabled: boolean
  remark?: string
  createdAt?: string
}
