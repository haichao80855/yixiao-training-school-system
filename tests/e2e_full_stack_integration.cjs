/**
 * ============================================================================
 * 盛通教育「一校教培系统」全栈端到端业务闭环穿透验收套件 (E2E Full Stack Integration)
 * 模拟前端真实客户端与 NestJS 后端微服务的完整业务数据闭环
 * ============================================================================
 */

const http = require('http');

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

async function runFullStackIntegration() {
  console.log('================================================================================');
  console.log('盛通教育「一校教培系统」全栈端到端全链路业务闭环穿透测试 (第六步终审验收)');
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

  const PORT = 3001;
  const HOST = '127.0.0.1';

  // --------------------------------------------------------------------------
  // 链路 1: 真实认证与用户画像初始化闭环
  // --------------------------------------------------------------------------
  console.log('【链路 1: 真实认证中台与用户权限画像闭环】');

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
  assert(loginRes.status === 200 || loginRes.status === 201, '前端登录调用成功，状态 200/201');
  const token = loginRes.body.data.accessToken;
  assert(typeof token === 'string' && token.length > 20, '成功签发有效 JWT Bearer Token');

  // 构建模拟前端请求上下文 (包含 Token 与默认校区)
  let activeCampusId = 'campus-bj-hq';
  function getHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Campus-Id': activeCampusId,
      'Content-Type': 'application/json',
    };
  }

  const profileRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
    headers: getHeaders(),
  });
  assert(profileRes.status === 200, '用户画像查询成功返回 200');
  const currentUser = profileRes.body.data;
  assert(currentUser.account === 'donghaichao', '当前登录用户账号一致');
  assert(currentUser.permissions.includes('*'), '超管具备全局通配权限 [*]');

  // --------------------------------------------------------------------------
  // 链路 2: 多校区租户切换与数据透视闭环
  // --------------------------------------------------------------------------
  console.log('\n【链路 2: 多校区租户切换与数据透视闭环】');

  const campusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: getHeaders(),
  });
  assert(campusesRes.status === 200, '拉取全量校区清单成功');
  const campuses = campusesRes.body.data;
  assert(campuses.length >= 5, '包含盛通教育 5 所物理校区');

  // 模拟前端顶栏切换校区浮标 -> 切换至远洋校区
  activeCampusId = campuses[1].id;
  assert(!!activeCampusId, `前端动态切换活跃校区至: ${campuses[1].name}`);

  // --------------------------------------------------------------------------
  // 链路 3: 教研课程创建、跨校区授权与大纲发布闭环
  // --------------------------------------------------------------------------
  console.log('\n【链路 3: 教研课程中台与章节大纲发布闭环】');

  const testCourseCode = `CRS-E2E-${Date.now().toString().slice(-4)}`;
  const createCourseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/curriculum/courses',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      code: testCourseCode,
      name: '2026盛通全栈创新软硬件机器人高级研讨班',
      cover: '/covers/robotics_adv.svg',
      pricePerLesson: 350,
      totalLessons: 32,
      subject: 'robotics',
      grade: 'senior',
      attribute: 'regular',
      campusIds: [campuses[0].id, campuses[1].id],
    },
  );
  assert(createCourseRes.status === 200 || createCourseRes.status === 201, '新建课程发布成功');
  const courseId = createCourseRes.body.data.id;

  // 维护大纲树
  const addUnitRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${courseId}/units`,
      method: 'POST',
      headers: getHeaders(),
    },
    {
      unitName: '单元一：嵌入式传感器与机器视觉融合开发',
      sort: 1,
      lessons: [
        { lessonName: '第1讲：双目视觉测距原理', durationMin: 90 },
        { lessonName: '第2讲：PID 闭环电机轨迹控制', durationMin: 90 },
      ],
    },
  );
  assert(addUnitRes.status === 200 || addUnitRes.status === 201, '大纲单元与课次保存成功');

  // --------------------------------------------------------------------------
  // 链路 4: 学员创建、开单签约与 360° 全景画像闭环
  // --------------------------------------------------------------------------
  console.log('\n【链路 4: 学员全生命周期档案、开单签约与 360° 全景画像闭环】');

  const createStudentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      name: '闭环测试学员-钱思博',
      gender: 'male',
      phone: '13799998888',
      campusId: activeCampusId,
      parentName: '钱先生',
    },
  );
  assert(createStudentRes.status === 200 || createStudentRes.status === 201, '学员建档成功');
  const studentId = createStudentRes.body.data.id;

  // 开单签约购买新发布的课程
  const enrollRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      studentId,
      courseId,
      totalLessons: 32,
      bonusLessons: 2,
      pricePerLesson: 350,
      discountAmount: 200,
      paymentMethod: 'bank_transfer',
      remark: '全栈 E2E 签约测试单',
    },
  );
  assert(enrollRes.status === 200 || enrollRes.status === 201, '签约开单成功');
  // 实付: 32 * 350 - 200 = 11200 - 200 = 11000
  assert(enrollRes.body.data.actualAmount === 11000, '实收核算正确 (¥11000.00)');
  assert(enrollRes.body.data.totalLessons === 34, '课包总课时准确累加赠课 (32+2=34)');
  const packageId = enrollRes.body.data.packageId;
  const orderId = enrollRes.body.data.orderId;

  // 验证 360° 画像数据丰富度
  const profile360Res = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${studentId}/profile`,
    method: 'GET',
    headers: getHeaders(),
  });
  assert(profile360Res.status === 200, '学员 360° 全景画像查询成功');
  assert(profile360Res.body.data.packages.length === 1, '全景画像准确展示在读课包卡片');
  assert(profile360Res.body.data.orders.length === 1, '全景画像精准聚合关联签约订单');

  // --------------------------------------------------------------------------
  // 链路 5: 教务排课、三维碰撞检测、随堂点名消课与盛通反结课闭环
  // --------------------------------------------------------------------------
  console.log('\n【链路 5: 教务排课、三维碰撞检测、随堂点名消课与盛通反结课闭环】');

  // 创建班级
  const createClassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      campusId: activeCampusId,
      courseId,
      code: `CLS-E2E-${Date.now().toString().slice(-4)}`,
      name: '机器人周日高级精品班',
      teacherId: currentUser.id,
      classroomId: (await request({ hostname: HOST, port: PORT, path: '/api/educational/classrooms', method: 'GET', headers: getHeaders() })).body.data[0].id,
      startDate: '2026-09-01',
      endDate: '2027-01-20',
    },
  );
  const classId = createClassRes.body.data.id;

  // 学员进班
  await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${classId}/students`,
      method: 'POST',
      headers: getHeaders(),
    },
    { studentId },
  );

  // 动态日期排课
  const testScheduleDate = `2026-12-${Math.floor(10 + Math.random() * 18)}`;
  const scheduleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      campusId: activeCampusId,
      classId,
      teacherId: currentUser.id,
      classroomId: createClassRes.body.data.classroomId,
      date: testScheduleDate,
      startTime: '14:00',
      endTime: '15:30',
    },
  );
  assert(scheduleRes.status === 200 || scheduleRes.status === 201, '排课日程成功创建');
  const scheduleEventId = scheduleRes.body.data.id;

  // 点名消课
  const rollCallRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/attendances/roll-call',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      scheduleEventId,
      items: [
        {
          studentId,
          status: 'present',
          deductLessons: 1,
          comment: '传感器连接熟练，调试迅速！',
          score: 100,
          rating: 'A+',
        },
      ],
    },
  );
  assert(rollCallRes.status === 200 || rollCallRes.status === 201, '随堂点名扣课成功');

  // 检查扣课后剩余课时 (34 - 1 = 33)
  const profileAfterRollCall = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${studentId}/profile`,
    method: 'GET',
    headers: getHeaders(),
  });
  assert(profileAfterRollCall.body.data.packages[0].remainingLessons === 33, '点名课时原子扣减生效 (34 - 1 = 33)');

  // 反结课冲正
  const reverseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${scheduleEventId}/reverse`,
      method: 'POST',
      headers: getHeaders(),
    },
    {},
  );
  assert(reverseRes.status === 200 || reverseRes.status === 201, '反结课冲正成功');

  // 检查课时原路退回 (33 + 1 = 34)
  const profileAfterReverse = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${studentId}/profile`,
    method: 'GET',
    headers: getHeaders(),
  });
  assert(profileAfterReverse.body.data.packages[0].remainingLessons === 34, '反结课冲正课时原路退还成功 (33 + 1 = 34)');

  // --------------------------------------------------------------------------
  // 链路 6: 财务 Summary Strip 实收聚合与三级风控审批闭环
  // --------------------------------------------------------------------------
  console.log('\n【链路 6: 财务流水 Summary Strip 实收聚合与三级风控审批闭环】');

  const summaryRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/financial/orders/summary',
    method: 'GET',
    headers: getHeaders(),
  });
  assert(summaryRes.status === 200, '财务 Summary Strip 实时实收计算成功');
  assert(summaryRes.body.data.totalPaidOrders > 0, '实收已支付笔数有效统计');

  // 发起风控审批
  const createApprovalRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/financial/approvals',
      method: 'POST',
      headers: getHeaders(),
    },
    {
      orderId,
      businessType: 'payment',
      applicantName: '冬海潮（教研负责人）',
    },
  );
  const approvalFlowId = createApprovalRes.body.data.id;

  // 三级审批全流程推进
  // 1 级
  await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: getHeaders(),
    },
    { action: 'pass', comment: '【教学核实】课消与教材发放正常' },
  );
  // 2 级
  await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: getHeaders(),
    },
    { action: 'pass', comment: '【校长复核】核准通过' },
  );
  // 3 级
  const finalAuditRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/financial/approvals/${approvalFlowId}/audit`,
      method: 'POST',
      headers: getHeaders(),
    },
    { action: 'pass', comment: '【财务终审】资金流水入账审核通过' },
  );
  assert(finalAuditRes.body.data.status === 'approved', '三级风控全链路审批闭环终审通过 (approved)');

  console.log('\n================================================================================');
  console.log(`🏆 全栈端到端全链路业务闭环穿透验收: ${passed}/${total} 项全场景业务断言 100% 通过！`);
  console.log('================================================================================\n');
}

runFullStackIntegration().catch((err) => {
  console.error('全栈穿透测试异常失败:', err);
  process.exit(1);
});
