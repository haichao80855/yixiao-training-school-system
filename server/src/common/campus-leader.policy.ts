/** 校区负责人 (执行校长) 及以上的角色 */
export const CAMPUS_LEADER_ROLE_CODES = ['super_admin', 'admin', 'principal'];

/**
 * 是否为校区负责人及以上：执行校长、集团管理员，或拥有全部权限 (*)。
 * 站内通知、老师课酬只对这些人开放。这里按角色判断，不用权限码：
 * 财务角色带有 financial:* 权限，用权限码控制的话财务也能看到老师课酬。
 */
export function isCampusLeader(user: any): boolean {
  if (!user) return false;
  if (user.permissions?.includes('*') || user.permissions?.includes('admin:all')) return true;
  return (user.roles || []).some((r: any) => CAMPUS_LEADER_ROLE_CODES.includes(typeof r === 'string' ? r : r?.code));
}
