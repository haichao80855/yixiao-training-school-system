/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎
 * Prisma 仓储接缝中间件适配器 (PrismaScopeMiddleware)
 * 在数据访问层透明完成 SQL 过滤条件注入与跨校区越权拦截
 * ==============================================================================
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { DataScopePolicyEngine } from '../domain/data-scope-policy.engine';
import { CrossCampusTamperError } from '../domain/data-scope.types';

export function createDataScopePrismaMiddleware(
  engine: DataScopePolicyEngine,
  getClient: () => PrismaClient,
): Prisma.Middleware {
  // 受校区行级隔离约束的实体模型字典 (小写，直接持有 campusId)
  const scopedModels = new Set([
    'student',
    'class',
    'scheduleevent',
    'classroom',
    'order',
    'servicefeerecord',
    'studentabnormalmovement',
  ]);

  return async (params, next) => {
    const lowerModel = params.model ? params.model.toLowerCase() : '';
    if (!params.model || !scopedModels.has(lowerModel)) {
      return next(params);
    }

    const ctx = engine.getContext();
    // 无上下文（如初始化种子数据、后台迁移脚本）或已显式 bypass 或具备全集团透视权限：直接放行
    if (!ctx || ctx.isBypassed || engine.isUnrestricted(ctx)) {
      return next(params);
    }

    params.args = params.args || {};

    // 1. 列表与聚合查询 (findMany / findFirst / count / aggregate / groupBy)
    if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args.where = engine.evaluateReadScope(ctx, lowerModel, params.args.where);
      return next(params);
    }

    // 2. 单实体查询 (findUnique): Prisma 原生限制 where 只能是唯一主键，在此安全平滑转换为带租户隔离的 findFirst
    if (params.action === 'findUnique') {
      params.action = 'findFirst';
      params.args.where = engine.evaluateReadScope(ctx, lowerModel, params.args.where);
      return next(params);
    }

    // 3. 批量更新与删除 (updateMany / deleteMany): 注入行级隔离条件
    if (['updateMany', 'deleteMany'].includes(params.action)) {
      params.args.where = engine.evaluateReadScope(ctx, lowerModel, params.args.where);
      return next(params);
    }

    // 4. 创建实体 (create): 自动回填校区归属并防伪造
    if (params.action === 'create') {
      if (params.args.data) {
        if (!params.args.data.campusId && ctx.campusId && ctx.campusId !== 'all') {
          params.args.data.campusId = ctx.campusId;
        } else if (
          params.args.data.campusId &&
          params.args.data.campusId !== 'all' &&
          params.args.data.campusId !== ctx.campusId
        ) {
          throw new CrossCampusTamperError(
            ctx.campusName || ctx.campusId,
            params.args.data.campusId,
          );
        }
      }
      return next(params);
    }

    // 5. 单实体更新与删除 (update / delete): 拦截跨校区越权篡改
    if (['update', 'delete'].includes(params.action)) {
      if (params.args.where?.id) {
        const client = getClient();
        if (client && (client as any)[lowerModel]) {
          const existing = await engine.bypass(async () => {
            return (client as any)[lowerModel].findUnique({
              where: { id: params.args.where.id },
              select: { campusId: true },
            });
          });
          if (existing && existing.campusId && existing.campusId !== ctx.campusId) {
            throw new CrossCampusTamperError(
              ctx.campusName || ctx.campusId,
              existing.campusId,
            );
          }
        }
      }
      return next(params);
    }

    return next(params);
  };
}
