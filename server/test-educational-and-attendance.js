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

async function runTests() {
  console.log('================================================================');
  console.log('拓视未来教育「一校教培系统」后端第四步（教务排课与考勤反结课）集成测试');
  console.log('================================================================\n');

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

  // 1. 登录超管获取 Token 与基础上下文
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
  const token = loginRes.body.data.accessToken;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 获取校区
  const campusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  const hqCampus = campusesRes.body.data[0];

  // 获取当前用户及教师列表
  const profileRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
    headers: authHeaders,
  });
  const teacherId = profileRes.body.data.id || profileRes.body.data.user?.id;

  // 获取可用课程
  const coursesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/curriculum/courses',
    method: 'GET',
    headers: authHeaders,
  });
  const course = coursesRes.body.data.list[0];

  // ----------------------------------------------------------------
  // 2. 教室资源管理 (Classrooms)
  // ----------------------------------------------------------------
  console.log('\n--- 2. 教室资源管理 API 验证 ---');

  const classroomListRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/classrooms?campusId=${hqCampus.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(classroomListRes.status === 200, '教室列表查询成功返回 200');
  assert(classroomListRes.body.data.length > 0, '种子数据包含初始化教室');

  const testRoomCode = `CR-TEST-${Date.now().toString().slice(-4)}`;
  const createRoomRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classrooms',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: hqCampus.id,
      code: testRoomCode,
      name: '乐博人工智能创客新阶实验室',
      capacity: 16,
      type: 'maker',
    },
  );
  assert(createRoomRes.status === 201 || createRoomRes.status === 200, '新建教室资源成功');
  const classroomId = createRoomRes.body.data.id;

  // ----------------------------------------------------------------
  // 3. 班级档案管理与学员进班 (Classes)
  // ----------------------------------------------------------------
  console.log('\n--- 3. 班级档案管理与学员进班 API 验证 ---');

  const testClassCode = `CLS-AUTO-${Date.now().toString().slice(-4)}`;
  const createClassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: hqCampus.id,
      courseId: course.id,
      code: testClassCode,
      name: '2026秋季少儿AI周六晨间精品班',
      teacherId,
      classroomId,
      capacity: 10,
      startDate: '2026-09-01',
      endDate: '2027-01-15',
    },
  );
  assert(createClassRes.status === 201 || createClassRes.status === 200, '新建班级档案成功');
  const classId = createClassRes.body.data.id;

  // 创建学员并开单购买该课程
  const studentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: '考勤测试学员-小明',
      gender: 'male',
      phone: '13900001111',
      campusId: hqCampus.id,
    },
  );
  const testStudent = studentRes.body.data;

  // 开单签约
  const enrollRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: testStudent.id,
      courseId: course.id,
      totalLessons: 24,
      bonusLessons: 2,
      pricePerLesson: 300,
      paymentMethod: 'wechat',
    },
  );
  assert(enrollRes.status === 200 || enrollRes.status === 201, '学员购买课程课包成功 (24+2=26课时)');

  // 将学员绑定编入该班级
  const bindRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${classId}/students`,
      method: 'POST',
      headers: authHeaders,
    },
    { studentId: testStudent.id },
  );
  assert(bindRes.status === 200 || bindRes.status === 201, '学员成功编入班级');
  assert(bindRes.body.data.currentStudentCount === 1, '班级学员计数自增为 1');

  // ----------------------------------------------------------------
  // 4. 7×15 动态甘特排课与三维碰撞检测引擎 (Collision Engine)
  // ----------------------------------------------------------------
  console.log('\n--- 4. 7×15 排课与三维碰撞检测引擎 API 验证 ---');

  const dayNum = Math.floor(10 + Math.random() * 18);
  const testScheduleDate = `2026-11-${dayNum}`;
  const scheduleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: hqCampus.id,
      classId,
      teacherId,
      classroomId,
      date: testScheduleDate,
      startTime: '09:00',
      endTime: '10:30',
      semanticType: 'regular',
      classType: 'formal',
    },
  );
  assert(scheduleRes.status === 201 || scheduleRes.status === 200, '排课日程创建成功 (09:00-10:30)');
  const scheduleEventId = scheduleRes.body.data.id;
  assert(typeof scheduleRes.body.data.laneIndex === 'number', '首个日程自适应分配到 Lane 泳道');

  // 4.2 碰撞检测 1：同一讲师同时段冲突预检 (09:30 - 11:00 重叠)
  const teacherCollisionRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/check-collision',
      method: 'POST',
      headers: authHeaders,
    },
    {
      date: testScheduleDate,
      startTime: '09:30',
      endTime: '11:00',
      teacherId,
      classroomId: classroomListRes.body.data[1]?.id || 'diff-room',
      classId: 'diff-class',
    },
  );
  assert(teacherCollisionRes.status === 200 || teacherCollisionRes.status === 201, '碰撞检测接口响应成功');
  assert(teacherCollisionRes.body.data.hasConflict === true, '精准捕获讲师时段重叠冲突');
  assert(
    teacherCollisionRes.body.data.conflicts.some((c) => c.type === 'teacher'),
    '冲突类型准确识别为 teacher',
  );

  // 4.3 碰撞检测 2：同一教室被占冲突预检 (10:00 - 11:30 重叠)
  const roomCollisionRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules/check-collision',
      method: 'POST',
      headers: authHeaders,
    },
    {
      date: testScheduleDate,
      startTime: '10:00',
      endTime: '11:30',
      teacherId: 'diff-teacher',
      classroomId,
      classId: 'diff-class',
    },
  );
  assert(roomCollisionRes.body.data.hasConflict === true, '精准捕获物理教室占用冲突');
  assert(
    roomCollisionRes.body.data.conflicts.some((c) => c.type === 'classroom'),
    '冲突类型准确识别为 classroom',
  );

  // 4.4 强行录入重叠冲突日程 -> 系统自适应标记为红框 conflict
  const conflictScheduleRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/schedules',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: hqCampus.id,
      classId,
      teacherId,
      classroomId,
      date: testScheduleDate,
      startTime: '09:30',
      endTime: '11:00',
    },
  );
  assert(conflictScheduleRes.body.data.semanticType === 'conflict', '盛通高保真规则生效：重叠日程自动赋予 conflict 警示语义');
  assert(typeof conflictScheduleRes.body.data.laneIndex === 'number', '重叠日程自适应平移到对应 Lane 泳道，避免视觉重叠遮挡');

  // 清理冲突临时日程
  await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/schedules/${conflictScheduleRes.body.data.id}`,
    method: 'DELETE',
    headers: authHeaders,
  });

  // ----------------------------------------------------------------
  // 5. 随堂点名消课与盛通防重放反结课冲正机制 (Roll Call & Reversal)
  // ----------------------------------------------------------------
  console.log('\n--- 5. 随堂点名消课与盛通防重放反结课冲正 API 验证 ---');

  // 5.1 获取该日程的点名名单与课包余额
  const rollCallStudentsRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/schedules/${scheduleEventId}/roll-call-students`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(rollCallStudentsRes.status === 200, '获取点名名单接口返回 200');
  assert(rollCallStudentsRes.body.data.length === 1, '名单中包含绑定的测试学员小明');
  assert(rollCallStudentsRes.body.data[0].remainingLessons === 26, '点名前课包剩余课时为 26');

  // 5.2 提交随堂点名消课
  const rollCallRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/attendances/roll-call',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId,
      items: [
        {
          studentId: testStudent.id,
          status: 'present',
          deductLessons: 1,
          comment: '课堂表现优秀，Scratch 迷宫算法逻辑清晰！',
          score: 98,
          rating: 'A+',
        },
      ],
    },
  );
  assert(rollCallRes.status === 200 || rollCallRes.status === 201, '随堂点名消课成功');
  assert(rollCallRes.body.data.completedCount === 1, '成功扣课 1 人');

  // 验证点名后课包扣减与日程状态流转
  const profileAfterRollCall = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${testStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  const pkgAfterRollCall = profileAfterRollCall.body.data.packages.find((p) => p.courseId === course.id);
  assert(pkgAfterRollCall.remainingLessons === 25, '课包课时原子扣减正确 (26 - 1 = 25)');
  assert(pkgAfterRollCall.consumedLessons === 1, '已消耗课时增加为 1');

  // 验证日程状态变更为 completed
  const schedulesAfterRollCall = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/schedules?date=${testScheduleDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  const currentSchedule = schedulesAfterRollCall.body.data.find((s) => s.id === scheduleEventId);
  assert(currentSchedule.status === 'completed', '日程状态流转为已结课 completed');
  assert(currentSchedule.semanticType === 'completed', '日程语义色彩流转为结课绿 (completed)');

  // 验证防重复点名保护
  const duplicateRollCall = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/attendances/roll-call',
      method: 'POST',
      headers: authHeaders,
    },
    {
      scheduleEventId,
      items: [{ studentId: testStudent.id, status: 'present' }],
    },
  );
  assert(duplicateRollCall.status === 400, '已结课日程禁止重复点名 (400)');

  // 5.3 盛通反结课 / 撤销点名冲正机制 (防重放与课时原路退还)
  const reverseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${scheduleEventId}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    {},
  );
  assert(reverseRes.status === 200 || reverseRes.status === 201, '盛通反结课冲正执行成功');
  assert(reverseRes.body.data.refundedLessons === 1, '成功原路退还 1 课时');

  // 验证反结课后课包与日程回滚
  const profileAfterReverse = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${testStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  const pkgAfterReverse = profileAfterReverse.body.data.packages.find((p) => p.courseId === course.id);
  assert(pkgAfterReverse.remainingLessons === 26, '课包课时成功原路回滚退还为 26');
  assert(pkgAfterReverse.consumedLessons === 0, '已消课时回滚为 0');

  // 验证日程恢复为 scheduled
  const schedulesAfterReverse = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/educational/schedules?date=${testScheduleDate}`,
    method: 'GET',
    headers: authHeaders,
  });
  const revertedSchedule = schedulesAfterReverse.body.data.find((s) => s.id === scheduleEventId);
  assert(revertedSchedule.status === 'scheduled', '排课日程成功回滚为 scheduled 待上课');
  assert(revertedSchedule.semanticType === 'regular', '日程色彩恢复为常规蓝 regular');

  // 5.4 验证防重放攻击：已被冲正的记录禁止再次发起反结课
  const replayAttackRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/schedules/${scheduleEventId}/reverse`,
      method: 'POST',
      headers: authHeaders,
    },
    {},
  );
  assert(replayAttackRes.status === 400, '盛通防重放风控生效：已冲正日程严禁二次反结课 (400)');

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项教务排课与考勤消课冲正业务断言 100% 验证通过！`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  process.exit(1);
});
