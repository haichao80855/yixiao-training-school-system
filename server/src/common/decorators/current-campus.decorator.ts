import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 获取当前请求有效校区 ID
 * 强化多校区隔离安全：
 * 1. 仅超级管理员 / 全校区数据权限 (dataScope === 'all') 允许依据 Header x-campus-id 跨校区透视；
 * 2. 普通分校校长及授课老师严格强制锁定为 Token 绑定的所属校区，杜绝前端恶意篡改 Header 越权访问其他校区数据。
 */
export const CurrentCampus = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    const headerCampusId = request.headers['x-campus-id'] as string;

    // 未经 JWT 鉴权的请求或本地无会话请求（如部分公开接口），保留兼容 Header
    if (!user) {
      return headerCampusId || 'campus-bj-hq';
    }

    // 检查是否具备全集团/超级管理员跨校区透视权限
    const isSuperAdmin =
      user.dataScope === 'all' ||
      user.roles?.some(
        (r: any) =>
          r.code === 'super_admin' ||
          r.code === 'admin' ||
          r.id === 'r1' ||
          r.dataScope === 'all',
      ) ||
      user.permissions?.includes('*') ||
      user.permissions?.includes('admin:all');

    if (isSuperAdmin) {
      return headerCampusId || user.campusId || 'campus-bj-hq';
    }

    // 普通教职工：强制锁定为其归属校区，忽略伪造的 Header
    return user.campusId || 'campus-bj-hq';
  },
);

