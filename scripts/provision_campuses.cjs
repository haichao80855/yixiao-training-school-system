/**
 * 校区开通脚本 (幂等)
 * - 新增欢心英语、老城三人行 4 个校区及其组织节点
 * - 把总部校区改名为「拓视未来-原阳校区」
 * - 停用种子遗留校区；仍有账号或业务数据的校区默认跳过，需 --force-disable <校区ID> 显式确认
 *
 * 默认只预览，不写入：
 *   node scripts/provision_campuses.cjs
 *   node scripts/provision_campuses.cjs --apply
 *   node scripts/provision_campuses.cjs --apply --force-disable campus-bj-yy
 */
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));

const HQ_CAMPUS_ID = 'campus-bj-hq';
const HQ_CAMPUS_NAME = '拓视未来-原阳校区';
const NEW_CAMPUSES = [
  { id: 'campus-hx-lc', name: '欢心英语老城校区' },
  { id: 'campus-hx-xc', name: '欢心英语新城校区' },
  { id: 'campus-srx-lc-sf', name: '老城三人行书法' },
  { id: 'campus-srx-lc-ms', name: '老城三人行美术' },
];
const LEGACY_CAMPUS_IDS = ['campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'];

function parseArgs(argv) {
  const forceDisable = new Set();
  argv.forEach((arg, index) => {
    if (arg === '--force-disable' && argv[index + 1]) {
      forceDisable.add(argv[index + 1]);
    }
  });
  return { apply: argv.includes('--apply'), forceDisable };
}

async function countCampusUsage(db, campusId) {
  const where = { campusId };
  const [users, students, classes, classrooms, schedules, orders, serviceFees, evaluations] = await Promise.all([
    db.user.count({ where }),
    db.student.count({ where }),
    db.class.count({ where }),
    db.classroom.count({ where }),
    db.scheduleEvent.count({ where }),
    db.order.count({ where }),
    db.serviceFeeRecord.count({ where }),
    db.lessonEvaluation.count({ where }),
  ]);
  return { users, students, classes, classrooms, schedules, orders, serviceFees, evaluations };
}

async function provision(db, { apply, forceDisable }) {
  const skipped = [];
  const log = (message) => console.log(`${apply ? '[执行]' : '[预览]'} ${message}`);

  const hq = await db.campus.findUnique({ where: { id: HQ_CAMPUS_ID }, include: { orgNode: true } });
  if (!hq) {
    throw new Error(`未找到总部校区 ${HQ_CAMPUS_ID}，已中止，未写入任何数据`);
  }

  // 1. 总部校区改名
  if (hq.name !== HQ_CAMPUS_NAME) {
    log(`总部校区改名：${hq.name} -> ${HQ_CAMPUS_NAME}`);
    if (apply) {
      await db.campus.update({ where: { id: hq.id }, data: { name: HQ_CAMPUS_NAME } });
    }
  } else {
    log(`总部校区名称已是 ${HQ_CAMPUS_NAME}，跳过`);
  }
  if (hq.orgNode && hq.orgNode.name !== HQ_CAMPUS_NAME && apply) {
    await db.orgNode.update({ where: { id: hq.orgNode.id }, data: { name: HQ_CAMPUS_NAME } });
  }

  // 2. 新增校区：与 SystemService.createCampus 相同，校区与组织节点成对创建
  for (const target of NEW_CAMPUSES) {
    const sameId = await db.campus.findUnique({ where: { id: target.id } });
    if (sameId) {
      log(`校区已存在，跳过：${target.name} (${target.id})`);
      continue;
    }
    const sameName = await db.campus.findFirst({ where: { name: target.name } });
    if (sameName) {
      skipped.push(`${target.name} 已以其他 ID 存在 (${sameName.id})，未重复创建`);
      continue;
    }

    log(`新增校区：${target.name} (${target.id})`);
    if (apply) {
      const orgNode = await db.orgNode.create({
        data: {
          companyId: hq.companyId,
          code: `NODE-${target.id.toUpperCase()}`,
          name: target.name,
          type: 'campus',
          level: 3,
          parentId: hq.orgNode ? hq.orgNode.parentId : null,
        },
      });
      await db.campus.create({
        data: {
          id: target.id,
          companyId: hq.companyId,
          code: target.id,
          name: target.name,
          isHeadquarter: false,
          orgNodeId: orgNode.id,
        },
      });
    }
  }

  // 3. 停用遗留校区：只改状态，数据全部保留
  for (const campusId of LEGACY_CAMPUS_IDS) {
    const campus = await db.campus.findUnique({ where: { id: campusId } });
    if (!campus) {
      log(`遗留校区不存在，跳过：${campusId}`);
      continue;
    }
    if (campus.status !== 'active') {
      log(`遗留校区已停用，跳过：${campus.name} (${campusId})`);
      continue;
    }

    const usage = await countCampusUsage(db, campusId);
    const inUse = Object.values(usage).some((count) => count > 0);
    const usageText = Object.entries(usage).map(([key, count]) => `${key}=${count}`).join(' ');
    if (inUse && !forceDisable.has(campusId)) {
      skipped.push(`${campus.name} (${campusId}) 仍有数据，未停用：${usageText}。确认后加 --force-disable ${campusId}`);
      continue;
    }

    log(`停用遗留校区：${campus.name} (${campusId})，${usageText}`);
    if (apply) {
      await db.campus.update({ where: { id: campusId }, data: { status: 'inactive' } });
      if (campus.orgNodeId) {
        await db.orgNode.update({ where: { id: campus.orgNodeId }, data: { status: 'inactive' } });
      }
    }
  }

  return skipped;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const skipped = options.apply
      ? await prisma.$transaction((tx) => provision(tx, options))
      : await provision(prisma, options);

    if (skipped.length > 0) {
      console.log('\n需要人工确认：');
      skipped.forEach((item) => console.log(`  - ${item}`));
    }
    console.log(options.apply ? '\n已写入。' : '\n以上为预览，未写入任何数据。确认后加 --apply 执行。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
