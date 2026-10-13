import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions_required';
export const PERMISSIONS_ANY_KEY = 'permissions_any_required';

/**
 * 声明路由或控制器所需的操作权限码 (全满足/AND关系)
 * 示例: @RequirePermissions('system:user:delete')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * 声明路由或控制器所需的操作权限码 (任一满足即可/OR关系)
 * 示例: @RequireAnyPermissions('system:user:view', 'system:org:view')
 */
export const RequireAnyPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);

