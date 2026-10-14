/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎
 * HTTP 请求上下文拦截器适配器 (ScopeContextInterceptor - Web Adapter)
 * 桥接 NestJS 请求管道、JWT 凭据与 AsyncLocalStorage 异步生命周期
 * ==============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, lastValueFrom, from } from 'rxjs';
import { DataScopePolicyEngine } from '../domain/data-scope-policy.engine';
import { ActorContext, DataScopeViolationError } from '../domain/data-scope.types';
import { resolveCampusScope } from '../../../common/campus-scope.policy';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class ScopeContextInterceptor implements NestInterceptor {
  constructor(
    private readonly engine: DataScopePolicyEngine,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 1. 公开接口自动放行
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    // 未鉴权用户放行（由 JwtAuthGuard 负责拦截；若被放行则按无上下文处理）
    if (!user) {
      return next.handle();
    }

    // 2. 解析校区作用域与 RBAC 数据权限
    const headerCampusId = req.headers ? (req.headers['x-campus-id'] as string) : undefined;
    const queryCampusId = (req.query?.campusId as string) || (req.body?.campusId as string);

    let resolved;
    try {
      resolved = resolveCampusScope(user, queryCampusId, headerCampusId);
    } catch (err: any) {
      throw err instanceof ForbiddenException ? err : new ForbiddenException(err.message);
    }

    const isSuperAdmin =
      resolved.canAccessAll ||
      user.dataScope === 'all' ||
      user.roles?.some((r: any) => {
        const code = typeof r === 'string' ? r : r.code;
        return code === 'super_admin' || code === 'admin' || code === 'r1';
      });

    const actor: ActorContext = {
      userId: user.id || user.userId || 'unknown-user',
      campusId: resolved.targetCampusId || user.campusId || 'campus-bj-hq',
      campusName: user.campusName,
      dataScope: user.dataScope || (isSuperAdmin ? 'all' : 'campus'),
      departmentId: resolved.departmentId,
      teacherId: resolved.teacherId || user.teacherId || user.id,
      roles: user.roles?.map((r: any) => (typeof r === 'string' ? r : r.code)) || [],
      permissions: user.permissions || [],
      isSuperAdmin,
      isBypassed: false,
    };

    // 3. 在 Node.js AsyncLocalStorage 作用域内执行后续流水线
    return from(
      this.engine.runInScope(actor, async () => {
        try {
          return await lastValueFrom(next.handle());
        } catch (err: any) {
          if (err instanceof DataScopeViolationError) {
            throw new ForbiddenException(err.message);
          }
          throw err;
        }
      }),
    );
  }
}
