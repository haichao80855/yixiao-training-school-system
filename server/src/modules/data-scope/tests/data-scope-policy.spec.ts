/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎
 * 纯领域单元测试套件 (Pure Domain Unit Tests - 100% In-Memory)
 * 零框架依赖、毫秒级执行
 * ==============================================================================
 */

import { strict as assert } from 'assert';
import { DataScopePolicyEngine } from '../domain/data-scope-policy.engine';
import { TestActorBuilder } from '../adapters/test-actor.builder';
import { CrossCampusTamperError } from '../domain/data-scope.types';

export async function runDataScopePolicyTests(): Promise<{ total: number; passed: number }> {
  console.log('================================================================================');
  console.log('🛡️  DataScopePolicyEngine 纯领域核心与 4 级 RBAC 矩阵单元测试套件');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as Promise<void>).then(() => {
          passed++;
          console.log(`  ✓ PASS [${passed}]: ${desc}`);
        });
      }
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${desc}`);
      console.error(err);
      throw err;
    }
  }

  const engine = new DataScopePolicyEngine();

  // 1. 直连校区实体过滤
  test('直连模型：普通分校员工查询学员时，强制注入本校区过滤条件', () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-yy').build();
    const where = engine.evaluateReadScope(actor, 'student', { status: 'active' });
    assert.deepEqual(where, {
      status: 'active',
      campusId: 'campus-bj-yy',
    });
  });

  test('直连模型：超管全集团透视时，保留原查询条件且不注入校区限制', () => {
    const superAdmin = TestActorBuilder.superAdmin().build();
    const where = engine.evaluateReadScope(superAdmin, 'student', { status: 'active' });
    assert.deepEqual(where, { status: 'active' });
  });

  // 2. 授课日程排课穿透规则
  test('排课日程：仅本人权限 (self) 的教师仅能查看自身授课排课日程', () => {
    const teacher = TestActorBuilder.teacher('campus-bj-hq', 't-888').build();
    const where = engine.evaluateReadScope(teacher, 'scheduleevent', { date: '2026-10-15' });
    assert.deepEqual(where, {
      date: '2026-10-15',
      teacherId: 't-888',
    });
  });

  test('排课日程：校区权限 (campus) 的教师既能看本校区课表，也能透视其在其他校区的代课日程', () => {
    const campusTeacher = TestActorBuilder.standardCampusUser('campus-bj-hq')
      .withTeacher('t-888')
      .build();
    const where = engine.evaluateReadScope(campusTeacher, 'scheduleevent', { date: '2026-10-15' });
    assert.deepEqual(where, {
      AND: [
        { date: '2026-10-15' },
        {
          OR: [
            { campusId: 'campus-bj-hq' },
            { teacherId: 't-888' },
          ],
        },
      ],
    });
  });

  // 3. 学员学籍异动双向可见法则
  test('学籍异动：转校异动记录对转出校区与接收校区同时可见', () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-cy').build();
    const where = engine.evaluateReadScope(actor, 'studentabnormalmovement');
    assert.deepEqual(where, {
      OR: [
        { campusId: 'campus-bj-cy' },
        { targetCampusId: 'campus-bj-cy' },
      ],
    });
  });

  // 4. 上下文穿透与逃生接缝
  await test('上下文管理：runInScope 能够在微任务调用链中精准维护当前操作者上下文', async () => {
    const actor1 = TestActorBuilder.standardCampusUser('campus-1').build();
    const actor2 = TestActorBuilder.standardCampusUser('campus-2').build();

    await Promise.all([
      engine.runInScope(actor1, async () => {
        assert.equal(engine.getContext()?.campusId, 'campus-1');
      }),
      engine.runInScope(actor2, async () => {
        assert.equal(engine.getContext()?.campusId, 'campus-2');
      }),
    ]);

    assert.equal(engine.getContext(), null);
  });

  await test('逃生接缝：bypass 允许显式逃生执行跨校区汇总大屏查询', async () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-hq').build();

    await engine.runInScope(actor, async () => {
      // 常规状态受控
      const normalWhere = engine.evaluateReadScope(engine.getContext()!, 'order');
      assert.equal(normalWhere.campusId, 'campus-bj-hq');

      // 显式逃生
      await engine.bypass(async () => {
        const bypassCtx = engine.getContext()!;
        assert.equal(bypassCtx.isBypassed, true);
        const bypassWhere = engine.evaluateReadScope(bypassCtx, 'order', { status: 'paid' });
        assert.deepEqual(bypassWhere, { status: 'paid' });
      });

      // 退出逃生块后自动复原受控上下文
      assert.equal(engine.getContext()?.isBypassed, false);
    });
  });

  await test('调拨接缝：withCampus 允许在事务或业务调拨中临时切换目标校区', async () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-hq').build();

    await engine.runInScope(actor, async () => {
      await engine.withCampus('campus-bj-wj', async () => {
        assert.equal(engine.getContext()?.campusId, 'campus-bj-wj');
        const where = engine.evaluateReadScope(engine.getContext()!, 'student');
        assert.equal(where.campusId, 'campus-bj-wj');
      });

      // 退出调拨块后恢复主属校区
      assert.equal(engine.getContext()?.campusId, 'campus-bj-hq');
    });
  });

  // 5. 写入与异动变更权限断言
  test('写入断言：跨校区恶意篡改时抛出 CrossCampusTamperError', () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-hq').build();
    assert.throws(
      () => engine.assertWritePermission(actor, 'campus-bj-yy'),
      (err: any) => err instanceof CrossCampusTamperError,
    );
  });

  test('写入断言：同校区写入操作安全放行', () => {
    const actor = TestActorBuilder.standardCampusUser('campus-bj-hq').build();
    assert.doesNotThrow(() => engine.assertWritePermission(actor, 'campus-bj-hq'));
  });

  test('写入断言：超级管理员跨校区写入安全放行', () => {
    const superAdmin = TestActorBuilder.superAdmin().build();
    assert.doesNotThrow(() => engine.assertWritePermission(superAdmin, 'campus-bj-yy'));
  });

  // 6. 复杂 OR 查询安全合并
  test('条件合并：当原始查询中带有顶层 OR 时，封装为顶层 AND 避免运算符优先级逃逸', () => {
    const baseWhere = {
      OR: [
        { name: { contains: '张' } },
        { phone: { contains: '138' } },
      ],
    };
    const scopeWhere = { campusId: 'campus-bj-hq' };

    const merged = engine.mergeWhereConditions(baseWhere, scopeWhere);
    assert.deepEqual(merged, {
      AND: [
        baseWhere,
        scopeWhere,
      ],
    });
  });

  console.log(`\n🎉 全部 ${passed}/${total} 项纯领域单测均通过！\n`);
  return { total, passed };
}

// 支持直接脚本运行
if (require.main === module) {
  runDataScopePolicyTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
