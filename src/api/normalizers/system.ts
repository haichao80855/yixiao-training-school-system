import type {
  OrgNode,
  SystemUser,
  RoleItem,
  DictItem,
  DataScope
} from '@/types/system';

export function normalizeOrgNode(raw: any): OrgNode {
  if (!raw) return {} as OrgNode;
  const children = Array.isArray(raw.children) ? raw.children.map(normalizeOrgNode) : [];
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || raw.id,
    type: raw.type || 'campus',
    level: Number(raw.level || 3),
    parentId: raw.parentId || null,
    boundUserCount: Number(raw.boundUserCount || 0),
    leader: raw.leader || '',
    phone: raw.phone || '',
    status: (raw.status || 'active') as 'active' | 'disabled',
    children,
  };
}

export function normalizeUser(raw: any): SystemUser {
  if (!raw) return {} as SystemUser;
  return {
    id: raw.id,
    name: raw.realName || raw.name || '',
    account: raw.account || raw.username || '',
    phone: raw.phone || '',
    email: raw.email || undefined,
    avatar: raw.avatar || '',
    campusId: raw.campusId || raw.campus?.id || 'campus-bj-hq',
    campusName: raw.campus?.name || raw.campusName || '总部校区',
    departmentId: raw.departmentId || '',
    departmentName: raw.departmentName || '教学教务部',
    postId: raw.postId || '',
    postName: raw.postName || '授课讲师',
    roleId: raw.roleId || (raw.roles?.[0]?.id) || 'r1',
    roleName: raw.roleName || (raw.roles?.[0]?.name) || '员工',
    dataScope: (raw.dataScope || 'campus') as DataScope,
    status: (raw.status === 'locked' || raw.status === 'disabled') ? 'locked' : 'active',
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    createdAt: raw.createdAt ? String(raw.createdAt).split('T')[0] : '2026-09-01',
  };
}

export function normalizeRole(raw: any): RoleItem {
  if (!raw) return {} as RoleItem;
  let permissions: string[] = [];
  if (Array.isArray(raw.permissions)) {
    permissions = raw.permissions.map((p: any) => (typeof p === 'string' ? p : p.code));
  }
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || '',
    description: raw.description || '',
    userCount: Number(raw.userCount ?? raw._count?.users ?? 0),
    dataScope: (raw.dataScope || 'campus') as DataScope,
    permissions,
    isSystem: Boolean(raw.isSystem ?? ['super_admin', 'principal', 'teacher', 'admin', 'r1', 'r2', 'r3', 'r4'].includes(raw.code)),
    createdAt: raw.createdAt ? String(raw.createdAt).split('T')[0] : undefined,
  };
}

export function normalizeDictItem(raw: any): DictItem {
  if (!raw) return {} as DictItem;
  return {
    id: raw.id,
    category: raw.category || 'trans_reason',
    dictKey: raw.dictKey || raw.key || raw.code || '',
    label: raw.label || raw.name || '',
    order: Number(raw.order ?? raw.sortOrder ?? 0),
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    remark: raw.remark || raw.description || '',
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  };
}
