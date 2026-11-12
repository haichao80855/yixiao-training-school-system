/**
 * 数据权限中间件的校区隔离表清单与数据库结构一致：清单里的每张表都必须有 campusId 字段。
 *
 * 背景：中间件会给按校区限定的账号自动在这些表的查询和创建里加 campusId。
 * 2026-11-13 发现清单里误列了没有 campusId 的 StudentAbnormalMovement (学员异动)，
 * 执行校长等账号办理任何异动都返回 500。这个离线测试防止再次出现。
 *
 * 运行：cd server && npm run build && node test-data-scope-schema.js
 */
const assert = require('assert');
const { Prisma } = require('@prisma/client');
const { DATA_SCOPED_MODELS } = require('./dist/modules/data-scope/adapters/prisma-scope.middleware');

let passed = 0;
function check(cond, desc) {
  assert.ok(cond, `❌ ${desc}`);
  passed += 1;
  console.log(`  ✓ PASS [${passed}]: ${desc}`);
}

console.log('数据权限：校区隔离表清单与数据库结构一致性');
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name.toLowerCase(), m]));

check(Array.isArray(DATA_SCOPED_MODELS) && DATA_SCOPED_MODELS.length > 0, `中间件导出了隔离表清单 (${DATA_SCOPED_MODELS.join(', ')})`);
for (const name of DATA_SCOPED_MODELS) {
  const model = models.get(name);
  check(Boolean(model), `清单里的 ${name} 是真实存在的数据表`);
  check(model.fields.some((f) => f.name === 'campusId'), `${model.name} 有 campusId 字段 (否则按校区限定的账号访问它会报 500)`);
}

const movement = models.get('studentabnormalmovement');
check(
  !DATA_SCOPED_MODELS.includes('studentabnormalmovement') || movement.fields.some((f) => f.name === 'campusId'),
  '学员异动表要么不在清单里，要么有 campusId 字段',
);

console.log(`\n🎉 ${passed} 项检查通过\n`);
