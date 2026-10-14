const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

const getData = (res) => res.body?.data || res.body || {};

async function runTests() {
  console.log('================================================================================');
  console.log('📅 拓视未来教育「一校教培系统」批量排课与三维碰撞深模块专项自动化实测套件');
  console.log('涵盖预演仿真、三维碰撞立体检测、同批自冲突、STRICT_ABORT 回滚与原子落盘');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      process.exit(1);
    }
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const HOST = '127.0.0.1';

  // 1. 登录超管获取 Token
  const loginRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account: 'donghaichao', password: '123456' },
  );
  assert(loginRes.status === 200 || loginRes.status === 201, '超管登录成功获取 Token');
  const token =
    loginRes.body?.data?.accessToken ||
    loginRes.body?.token ||
    loginRes.body?.access_token;
  assert(token, '有效 JWT 认证令牌已就绪');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. 准备测试数据 (寻找总部校区与测试班级)
  const campus =
    (await prisma.campus.findFirst({ where: { isHeadquarter: true } })) ||
    (await prisma.campus.findFirst({ where: { id: 'campus-bj-hq' } })) ||
    (await prisma.campus.findFirst());
  assert(campus, '已定位总部校区实体');

  const targetClass = await prisma.class.findFirst({
    where: { campusId: campus.id },
    include: { teacher: true, classroom: true, course: true },
  });
  assert(targetClass, `已定位排课目标实体班级: ${targetClass.name} (${targetClass.code})`);

  const initialScheduleCount = await prisma.scheduleEvent.count();

  // --------------------------------------------------------------------------
  // 测试组 1: 批量排课预演仿真 (Preview / Dry-Run)
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 1] 批量排课预演仿真 (零数据库写副作用) ---');

  const previewRes1 = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/preview',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07', // 选一个遥远的未来日期避免历史数据干扰
      startTime: '14:00',
      endTime: '16:00',
      teacherId: targetClass.teacherId,
      classroomId: targetClass.classroomId,
      recurrence: {
        frequency: 'weekly',
        repeatCount: 8,
      },
    },
  );

  assert(previewRes1.status === 200 || previewRes1.status === 201, '预演请求成功返回 200 OK');
  const d1 = getData(previewRes1);
  assert(d1.success === true, '预演仿真执行成功标记确立');
  assert(d1.totalPlannedSlots === 8, '预演准确推演生成 8 讲虚拟课次');
  assert(d1.slots && d1.slots.length === 8, '虚拟课次时间线明细集合完整');
  assert(d1.dateRange && d1.dateRange.startDate === '2026-11-07', '推演起始日期与规格一致');
  assert(
    d1.slots[0].durationMinutes === 120,
    '课次时长计算精准 (14:00-16:00 = 120分钟)',
  );

  // 断言数据库零写操作（零副作用保证）
  const afterPreviewCount = await prisma.scheduleEvent.count();
  assert(
    afterPreviewCount === initialScheduleCount,
    '预演仿真阶段对数据库零持久化写副作用 (ScheduleEvent 计数未发生变化)',
  );

  // --------------------------------------------------------------------------
  // 测试组 2: 营业窗口与跨午夜强校验
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 2] 营业时间窗口强约束 (07:00 ~ 22:00) ---');

  // 早于 07:00
  const tooEarlyRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/preview',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '06:30',
      endTime: '08:00',
    },
  );
  assert(tooEarlyRes.status === 400, '早于 07:00 排课被严格拦截 (400 BadRequest)');

  // 晚于 22:00
  const tooLateRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/preview',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '21:00',
      endTime: '22:15',
    },
  );
  assert(tooLateRes.status === 400, '晚于 22:00 排课被严格拦截 (400 BadRequest)');

  // 跨午夜
  const crossMidnightRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/preview',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '21:00',
      endTime: '01:00',
    },
  );
  assert(crossMidnightRes.status === 400, '跨午夜起止时间倒挂被严格拦截 (400 BadRequest)');

  // --------------------------------------------------------------------------
  // 测试组 3: 三维碰撞冲突检测 (讲师占用、教室占用、容量超限)
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 3] 三维碰撞冲突精准探测 ---');

  // 先在 2026-11-14 14:00-16:00 插入一个阻挡日程
  const blocker = await prisma.scheduleEvent.create({
    data: {
      campusId: campus.id,
      classId: targetClass.id,
      teacherId: targetClass.teacherId,
      classroomId: targetClass.classroomId,
      date: '2026-11-14',
      startTime: '14:30',
      endTime: '15:30',
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
    },
  });

  const previewWithConflict = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/preview',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '14:00',
      endTime: '16:00',
      teacherId: targetClass.teacherId,
      classroomId: targetClass.classroomId,
      recurrence: { repeatCount: 4 },
    },
  );

  assert(
    previewWithConflict.status === 200 || previewWithConflict.status === 201,
    '含冲突预演请求成功返回',
  );
  const dConflict = getData(previewWithConflict);
  assert(dConflict.conflictSlotsCount > 0, '精准探测到存在冲突课次');
  assert(dConflict.canCommitStrictly === false, '标记不可严格零冲突提交');
  assert(
    dConflict.collisions &&
      dConflict.collisions.some(
        (c) => c.category === 'TEACHER_CONFLICT' || c.category === 'CLASSROOM_OCCUPIED',
      ),
    '冲突分类明细中准确指出 TEACHER_CONFLICT 或 CLASSROOM_OCCUPIED',
  );

  // --------------------------------------------------------------------------
  // 测试组 4: STRICT_ABORT 遇冲突全量回滚保证 (All-or-Nothing)
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 4] STRICT_ABORT 严格策略遇冲突全量回滚 ---');

  const beforeAbortCount = await prisma.scheduleEvent.count();

  const commitStrictRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/batch',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '14:00',
      endTime: '16:00',
      teacherId: targetClass.teacherId,
      classroomId: targetClass.classroomId,
      recurrence: { repeatCount: 4 },
      conflictPolicy: 'STRICT_ABORT', // 严格模式
    },
  );

  assert(commitStrictRes.status === 400, 'STRICT_ABORT 模式遇冲突被阻断 (400 BadRequest)');
  const dStrict = commitStrictRes.body;
  assert(
    (dStrict.message || '').includes('STRICT_ABORT 严格策略已终止排课'),
    '阻断异常提示文案准确传达回滚信息',
  );

  const afterAbortCount = await prisma.scheduleEvent.count();
  assert(
    afterAbortCount === beforeAbortCount,
    '事务强原子性生效：未生成任何半程脏日程 (数据库记录计数完全一致)',
  );

  // --------------------------------------------------------------------------
  // 测试组 5: ALLOW_AND_FLAG 容错排课与红标跳动待调解
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 5] ALLOW_AND_FLAG 容错排课标记 conflict ---');

  const commitFlagRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/batch',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-11-07',
      startTime: '14:00',
      endTime: '16:00',
      teacherId: targetClass.teacherId,
      classroomId: targetClass.classroomId,
      recurrence: { repeatCount: 4 },
      conflictPolicy: 'ALLOW_AND_FLAG', // 容错放行
    },
  );

  assert(commitFlagRes.status === 200 || commitFlagRes.status === 201, 'ALLOW_AND_FLAG 排课提交成功');
  const dFlag = getData(commitFlagRes);
  assert(dFlag.persistedCount === 4, '成功原子持久化写入 4 讲日程');
  assert(dFlag.flaggedConflictCount > 0, '受撞课次被记录为冲突标记');

  // 查询数据库断言受撞课次是否被持久化为 semanticType: 'conflict'
  const createdConflicts = await prisma.scheduleEvent.findMany({
    where: {
      classId: targetClass.id,
      date: '2026-11-14',
      startTime: '14:00',
    },
  });
  assert(createdConflicts.length === 1, '受撞新日程已成功落库');
  assert(
    createdConflicts[0].semanticType === 'conflict',
    '受撞课次被持久化标记为 semanticType = "conflict" (红标待调解)',
  );

  // 清理测试用的 blocker 和本次生成的 4 条日程
  await prisma.scheduleEvent.deleteMany({
    where: {
      classId: targetClass.id,
      date: { in: ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'] },
    },
  });
  await prisma.scheduleEvent.deleteMany({ where: { id: blocker.id } });

  // --------------------------------------------------------------------------
  // 测试组 6: 纯净无冲突批量排课与自适应 4 泳道图染色持久化
  // --------------------------------------------------------------------------
  console.log('\n--- [测试组 6] 纯净无冲突批量排课与 Lane 泳道原子落盘 ---');

  const cleanBatchRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/batch',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campus.id,
      classIds: [targetClass.id],
      startDate: '2026-12-05',
      startTime: '09:00',
      endTime: '10:30',
      recurrence: { repeatCount: 6 },
    },
  );

  assert(cleanBatchRes.status === 200 || cleanBatchRes.status === 201, '纯净批量排课提交成功');
  const dClean = getData(cleanBatchRes);
  assert(dClean.persistedCount === 6, '原子持久化写入 6 讲日程');
  assert(dClean.flaggedConflictCount === 0, '无冲突排课冲突标记数为 0');

  const savedSchedules = await prisma.scheduleEvent.findMany({
    where: {
      classId: targetClass.id,
      date: { in: ['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26', '2027-01-02', '2027-01-09'] },
    },
  });
  assert(savedSchedules.length === 6, '数据库中真实持久化了 6 讲日程实体');
  assert(
    savedSchedules.every((s) => s.semanticType === 'regular'),
    '所有排课日程语义类型均为 regular 正式课',
  );
  assert(
    savedSchedules.every((s) => s.laneIndex >= 0 && s.laneIndex <= 3),
    '所有日程均分配了合法的 0~3 自适应泳道索引 (laneIndex)',
  );

  // 清理测试日程
  await prisma.scheduleEvent.deleteMany({
    where: {
      id: { in: savedSchedules.map((s) => s.id) },
    },
  });

  console.log('\n================================================================================');
  console.log(`🎉 恭喜！批量排课与三维碰撞深模块专项测试全部通过！通过用例: ${passed}/${total}`);
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

runTests().catch(async (err) => {
  console.error('测试异常中断:', err);
  await prisma.$disconnect();
  process.exit(1);
});
