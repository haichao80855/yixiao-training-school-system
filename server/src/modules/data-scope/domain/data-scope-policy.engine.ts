/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎 (DataScopePolicyEngine)
 * 纯领域核心模块实现 (Pure Domain Core Module)
 * 具备极浅接口、极深实现、零外置框架依赖特性
 * ==============================================================================
 */

import { AsyncLocalStorage } from 'async_hooks';
import {
  ActorContext,
  ScopedModelRule,
  CrossCampusTamperError,
  MissingScopeContextError,
} from './data-scope.types';

export class DataScopePolicyEngine {
  private readonly als = new AsyncLocalStorage<ActorContext>();
  private readonly rules = new Map<string, ScopedModelRule>();

  constructor() {
    this.initDefaultModelRules();
  }

  /**
   * 初始化内建受控业务模型拓扑规则
   */
  private initDefaultModelRules() {
    // 1. 直连校区基础实体 (单校区强闭包)
    const directModels = [
      'student',
      'classroom',
      'order',
      'servicefeerecord',
    ];
    for (const model of directModels) {
      this.registerRule({
        resource: model,
        campusField: 'campusId',
      });
    }

    // 2. 班级实体 (Class): 支持校区与授课讲师自身过滤
    this.registerRule({
      resource: 'class',
      campusField: 'campusId',
      customFilterBuilder: (actor, baseWhere) => {
        if (actor.dataScope === 'self') {
          const teacherId = actor.teacherId || actor.userId;
          return this.mergeWhereConditions(baseWhere, {
            campusId: actor.campusId,
            teacherId,
          });
        }
        return this.mergeWhereConditions(baseWhere, { campusId: actor.campusId });
      },
    });

    // 3. 排课日程 (ScheduleEvent):
    // - 仅本人权限 (self): 仅查看自身讲授课程
    // - 校区权限 (campus): 查看本校区全部排课 OR 教师本人在其他校区代课排课 (跨校区穿透视界)
    this.registerRule({
      resource: 'scheduleevent',
      customFilterBuilder: (actor, baseWhere) => {
        const teacherId = actor.teacherId || actor.userId;
        if (actor.dataScope === 'self') {
          return this.mergeWhereConditions(baseWhere, { teacherId });
        }
        // 校区级普通员工/讲师: 支持查看本校区排课，外派讲师支持查看跨校区代课排课
        return this.mergeWhereConditions(baseWhere, {
          OR: [
            { campusId: actor.campusId },
            ...(teacherId ? [{ teacherId }] : []),
          ],
        });
      },
    });

    // 4. 学员学籍异动 (StudentAbnormalMovement):
    // 跨校区转校双向可见法则: 来源校区与接收校区均享有查看与审计权
    this.registerRule({
      resource: 'studentabnormalmovement',
      customFilterBuilder: (actor, baseWhere) => {
        return this.mergeWhereConditions(baseWhere, {
          OR: [
            { campusId: actor.campusId },
            { targetCampusId: actor.campusId },
          ],
        });
      },
    });
  }

  /**
   * 注册扩展或自定义模型隔离策略
   */
  public registerRule(rule: ScopedModelRule) {
    this.rules.set(rule.resource.toLowerCase(), rule);
  }

  /**
   * 判断当前操作者是否具备全集团无界透视特权
   */
  public isUnrestricted(actor?: ActorContext | null): boolean {
    if (!actor) return false;
    return (
      actor.isBypassed === true ||
      actor.isSuperAdmin === true ||
      actor.dataScope === 'all' ||
      actor.campusId === 'all' ||
      actor.roles?.some((r) => r === 'super_admin' || r === 'admin' || r === 'r1') ||
      actor.permissions?.includes('*') ||
      actor.permissions?.includes('admin:all')
    );
  }

  /**
   * 1. 作用域生命周期管理入口 (runInScope)
   */
  public runInScope<T>(context: ActorContext, fn: () => Promise<T>): Promise<T> {
    return this.als.run(context, fn);
  }

  /**
   * 2. 显式逃生接缝入口 (bypass): 集团财务汇总、跨校区大屏专用
   */
  public bypass<T>(fn: () => Promise<T>): Promise<T> {
    const current = this.als.getStore();
    const bypassedContext: ActorContext = current
      ? { ...current, isBypassed: true }
      : {
          userId: 'system-bypass',
          campusId: 'all',
          dataScope: 'all',
          isBypassed: true,
          isSuperAdmin: true,
        };
    return this.als.run(bypassedContext, fn);
  }

  /**
   * 3. 临时切换校区上下文 (withCampus): 跨校区业务调拨
   */
  public withCampus<T>(targetCampusId: string, fn: () => Promise<T>): Promise<T> {
    const current = this.als.getStore();
    if (!current) {
      throw new MissingScopeContextError();
    }
    const switchedContext: ActorContext = {
      ...current,
      campusId: targetCampusId,
    };
    return this.als.run(switchedContext, fn);
  }

  /**
   * 获取当前异步调用链上的操作者上下文快照
   */
  public getContext(): ActorContext | null {
    return this.als.getStore() || null;
  }

  /**
   * 4. 计算读取操作行级数据过滤条件 (evaluateReadScope)
   */
  public evaluateReadScope(
    actor: ActorContext,
    resource: string,
    baseWhere: Record<string, any> = {},
  ): Record<string, any> {
    // 1. 超管 / 全校区 / 逃生绕行：无条件放行
    if (this.isUnrestricted(actor)) {
      return baseWhere;
    }

    // 2. 匹配已注册规则
    const rule = this.rules.get(resource.toLowerCase());
    if (rule?.customFilterBuilder) {
      const customCondition = rule.customFilterBuilder(actor, baseWhere);
      if (customCondition) {
        return customCondition;
      }
    }

    // 3. 通用单校区字段过滤
    const campusField = rule?.campusField || 'campusId';
    return this.mergeWhereConditions(baseWhere, {
      [campusField]: actor.campusId,
    });
  }

  /**
   * 5. 写入与异动变更权限断言 (assertWritePermission)
   */
  public assertWritePermission(actor: ActorContext, targetCampusId?: string): void {
    if (this.isUnrestricted(actor)) {
      return;
    }

    if (
      targetCampusId &&
      targetCampusId !== 'all' &&
      targetCampusId !== actor.campusId
    ) {
      throw new CrossCampusTamperError(actor.campusName || actor.campusId, targetCampusId);
    }
  }

  /**
   * 安全合并两个 WHERE 条件对象，杜绝因 SQL OR 优先级导致的逻辑逃逸
   */
  public mergeWhereConditions(
    baseWhere: Record<string, any> = {},
    scopeWhere: Record<string, any> = {},
  ): Record<string, any> {
    if (!baseWhere || Object.keys(baseWhere).length === 0) {
      return { ...scopeWhere };
    }
    if (!scopeWhere || Object.keys(scopeWhere).length === 0) {
      return { ...baseWhere };
    }

    // 如果原条件中含有顶层 OR 条件，必须封装为顶层 AND: [baseWhere, scopeWhere]，确保行级隔离条件强制生效
    if (baseWhere.OR || scopeWhere.OR) {
      return {
        AND: [baseWhere, scopeWhere],
      };
    }

    return {
      ...baseWhere,
      ...scopeWhere,
    };
  }
}
