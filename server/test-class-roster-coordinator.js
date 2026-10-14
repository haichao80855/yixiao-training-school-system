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

async function runTests() {
  console.log('================================================================================');
  console.log('学员班级入班协调器（ClassRosterCoordinator）高可靠深模块专项验证套件');
  console.log('覆盖：并发 CAS 班容锁、原班人数冲减、移出回退待分班池、学籍自愈、幂等性与老端点兼容');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;
  function assert(condition, desc) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS [${passed}]: ${desc}`);
    } else {
      console.error(`  ✗ FAIL [${total}]: ${desc}`);
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
  const token = loginRes.body?.data?.accessToken || loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. 准备基础环境数据
  const campus = await prisma.campus.findFirst();
  assert(!!campus, '数据库存在测试校区');

  let course = await prisma.course.findFirst();
  if (!course) {
    course = await prisma.course.create({
      data: {
        campusId: campus.id,
        name: '协调器专项测试少儿编程精品课',
        code: `CRS-ROSTER-${Date.now()}`,
        cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300',
        category: 'programming',
        pricePerLesson: 150,
        totalLessons: 30,
        lessonDuration: 60,
        capacity: 10,
        status: 'published',
      },
    });
  }
  assert(!!course, '数据库存在测试课程');

  const classroom = await prisma.classroom.findFirst();
  assert(!!classroom, '数据库存在测试教室');

  const teacher = await prisma.user.findFirst();
  assert(!!teacher, '数据库存在测试讲师');

  const now = new Date();
  const future = new Date(Date.now() + 90 * 86400000);

  // 3. 创建测试班级 A (小容量班级 capacity = 2, 当前人数 0)
  const classA = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      classroomId: classroom.id,
      code: `CLS-CAS-A-${Date.now()}`,
      name: '协调器测试班级A-容量2',
      capacity: 2,
      currentStudentCount: 0,
      startDate: now,
      endDate: future,
      teacherId: teacher.id,
      status: 'recruiting',
    },
  });

  // 创建测试班级 B (容量 5, 当前人数 0)
  const classB = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      classroomId: classroom.id,
      code: `CLS-CAS-B-${Date.now()}`,
      name: '协调器测试班级B-容量5',
      capacity: 5,
      currentStudentCount: 0,
      startDate: now,
      endDate: future,
      teacherId: teacher.id,
      status: 'recruiting',
    },
  });

  // 4. 创建测试学员与未分班课包 S1, S2, S3
  async function createTestStudent(suffix) {
    const seq = Math.floor(100000 + Math.random() * 900000);
    const student = await prisma.student.create({
      data: {
        campusId: campus.id,
        studentNo: `STU-ROSTER-${suffix}-${seq}`,
        name: `分班测试生-${suffix}`,
        gender: 'male',
        phone: `1380000${String(seq).slice(0, 4)}`,
        status: 'normal',
      },
    });

    const pkg = await prisma.studentCoursePackage.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        totalLessons: 24,
        remainingLessons: 24,
        consumedLessons: 0,
        status: 'active',
        classId: null, // 未分班状态
      },
    });

    return { student, pkg };
  }

  const s1 = await createTestStudent('S1');
  const s2 = await createTestStudent('S2');
  const s3 = await createTestStudent('S3');

  // ==========================================================================
  // 测试 1: 服务端待分班名册查询与大盘聚合接口 (getUnassignedRoster)
  // ==========================================================================
  const unassignedRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/unassigned?page=1&pageSize=50',
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(unassignedRes.status === 200, '待分班名册接口返回 HTTP 200');
  const unassignedData = unassignedRes.body?.data || unassignedRes.body;
  assert(Array.isArray(unassignedData?.list), '待分班列表包含 list 数组');
  assert(typeof unassignedData?.total === 'number' && unassignedData.total >= 3, '待分班总数 total >= 3');
  assert(unassignedData?.summary && unassignedData.summary.totalStudents >= 3, '待分班 summary.totalStudents 聚合正确');
  assert(unassignedData.summary.totalUnassignedLessons >= 72, '待分班 summary.totalUnassignedLessons 包含 3 名测试学员课时');

  const foundS1 = unassignedData.list.find((item) => item.studentId === s1.student.id);
  assert(!!foundS1, '在待分班名册中精准检索到学员 S1');

  // ==========================================================================
  // 测试 2: 原子批量入班与学籍状态推进 (assignStudents)
  // ==========================================================================
  const assignRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/assign',
      method: 'POST',
      headers: authHeaders,
    },
    {
      classId: classA.id,
      studentIds: [s1.student.id, s2.student.id],
      packageIds: [s1.pkg.id, s2.pkg.id],
    },
  );
  assert(assignRes.status === 200 || assignRes.status === 201, '批量分班 S1, S2 进入班级 A 成功');
  const assignResult = assignRes.body?.data || assignRes.body;
  assert(assignResult.assignedCount === 2, '成功编入 2 名学员');
  assert(assignResult.currentStudentCount === 2, '返回班级 A 最新在读人数为 2');
  assert(assignResult.isFull === true, '班级 A 达到满员状态 isFull = true');

  // 数据库一致性校验
  const classAAfterAssign = await prisma.class.findUnique({ where: { id: classA.id } });
  assert(classAAfterAssign.currentStudentCount === 2, '数据库班级 A currentStudentCount 原子更新为 2');

  const s1Pkg = await prisma.studentCoursePackage.findUnique({ where: { id: s1.pkg.id } });
  const s2Pkg = await prisma.studentCoursePackage.findUnique({ where: { id: s2.pkg.id } });
  assert(s1Pkg.classId === classA.id && s2Pkg.classId === classA.id, 'S1 和 S2 课包 classId 均原子绑定至班级 A');

  const s1Stu = await prisma.student.findUnique({ where: { id: s1.student.id } });
  const s2Stu = await prisma.student.findUnique({ where: { id: s2.student.id } });
  assert(s1Stu.status === 'in_class' && s2Stu.status === 'in_class', 'S1 和 S2 学籍状态自动流转推进为 in_class');

  // ==========================================================================
  // 测试 3: 班容行级乐观 CAS 锁拦截超编 (ClassCapacityExceededException)
  // ==========================================================================
  const overflowRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/assign',
      method: 'POST',
      headers: authHeaders,
    },
    {
      classId: classA.id,
      studentIds: [s3.student.id],
    },
  );
  assert(overflowRes.status === 409 || overflowRes.status === 400, '向已满班级 A 塞入 S3 时被协调器拒绝，返回 HTTP 409/400');
  const overflowMsg = overflowRes.body?.message || '';
  assert(
    overflowMsg.includes('容量') || overflowMsg.includes('超编') || overflowMsg.includes('不足'),
    '错误提示包含明确的容量超编警示信息',
  );

  // 校验数据库绝无假写入
  const classAAfterOverflow = await prisma.class.findUnique({ where: { id: classA.id } });
  assert(classAAfterOverflow.currentStudentCount === 2, '防超编生效：班级 A 人数依然严格锁定为 2');
  const s3PkgBefore = await prisma.studentCoursePackage.findUnique({ where: { id: s3.pkg.id } });
  assert(s3PkgBefore.classId === null, '防超编生效：S3 课包 classId 保持 null 未被污染');

  // ==========================================================================
  // 测试 4: 毫秒级并发竞争 CAS 锁互斥测试 (Concurrent Race Test)
  // ==========================================================================
  // 创建容量仅为 1 的测试班级 C
  const classC = await prisma.class.create({
    data: {
      campusId: campus.id,
      courseId: course.id,
      classroomId: classroom.id,
      code: `CLS-RACE-${Date.now()}`,
      name: '高并发抢占测试班级C-容量1',
      capacity: 1,
      currentStudentCount: 0,
      startDate: now,
      endDate: future,
      teacherId: teacher.id,
      status: 'recruiting',
    },
  });

  const s4 = await createTestStudent('S4-Race');
  const s5 = await createTestStudent('S5-Race');

  const [race1, race2] = await Promise.all([
    request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/educational/roster/assign',
        method: 'POST',
        headers: authHeaders,
      },
      { classId: classC.id, studentIds: [s4.student.id] },
    ),
    request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/educational/roster/assign',
        method: 'POST',
        headers: authHeaders,
      },
      { classId: classC.id, studentIds: [s5.student.id] },
    ),
  ]);

  const successCount = [race1, race2].filter((r) => r.status === 200 || r.status === 201).length;
  const failCount = [race1, race2].filter((r) => r.status === 409 || r.status === 400).length;
  assert(successCount === 1, '并发抢占中恰好仅有 1 笔请求抢占成功入班');
  assert(failCount === 1, '并发抢占中另外 1 笔被 CAS 乐观排他锁拦截拒收');

  const classCAfterRace = await prisma.class.findUnique({ where: { id: classC.id } });
  assert(classCAfterRace.currentStudentCount === 1, '班级 C 数据库实际人数精确锁定为 1，零超编事故');

  // ==========================================================================
  // 测试 5: 调班履约：跨班级原班人数原子冲减与新班人数递增 (Transfer Test)
  // ==========================================================================
  // 将 S1 从班级 A 重新分配到班级 B
  const transferRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/assign',
      method: 'POST',
      headers: authHeaders,
    },
    {
      classId: classB.id,
      studentIds: [s1.student.id],
    },
  );
  assert(transferRes.status === 200 || transferRes.status === 201, '跨班调班 S1 从班级 A 转移至班级 B 成功');

  const classAAfterTransfer = await prisma.class.findUnique({ where: { id: classA.id } });
  const classBAfterTransfer = await prisma.class.findUnique({ where: { id: classB.id } });
  assert(classAAfterTransfer.currentStudentCount === 1, '原班级 A 人数原子 -1（由 2 降为 1）');
  assert(classBAfterTransfer.currentStudentCount === 1, '目标班级 B 人数原子 +1（由 0 升为 1）');

  const s1PkgAfterTransfer = await prisma.studentCoursePackage.findUnique({ where: { id: s1.pkg.id } });
  assert(s1PkgAfterTransfer.classId === classB.id, 'S1 课包 classId 已原子转移至班级 B');

  // ==========================================================================
  // 测试 6: 移出班级回退待分班资产池与学籍自愈 (removeStudent)
  // ==========================================================================
  // 将 S2 从班级 A 中合规移出
  const removeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/remove',
      method: 'POST',
      headers: authHeaders,
    },
    {
      classId: classA.id,
      studentId: s2.student.id,
      reason: '学员个人时间调整申请退班回池',
    },
  );
  assert(removeRes.status === 200 || removeRes.status === 201, '学员 S2 移出班级 A 成功');
  const removeData = removeRes.body?.data || removeRes.body;
  assert(removeData.fallbackToUnassignedPool === true, '回执确认 fallbackToUnassignedPool = true');
  assert(removeData.newClassStudentCount === 0, '班级 A 最新人数归零为 0');
  assert(removeData.studentStatus === 'normal', '学员 S2 学籍状态回退为 normal');

  // 数据库持久化断言
  const classAAfterRemove = await prisma.class.findUnique({ where: { id: classA.id } });
  assert(classAAfterRemove.currentStudentCount === 0, '数据库班级 A currentStudentCount 归零为 0');

  const s2PkgAfterRemove = await prisma.studentCoursePackage.findUnique({ where: { id: s2.pkg.id } });
  assert(s2PkgAfterRemove.classId === null, '数据库中 S2 课包 classId 重置回 null（已回退待分班资产池）');

  const s2StuAfterRemove = await prisma.student.findUnique({ where: { id: s2.student.id } });
  assert(s2StuAfterRemove.status === 'normal', '数据库中 S2 学籍状态自动自愈为 normal');

  // ==========================================================================
  // 测试 7: 幂等性防护与班级花名册全景查询 (getClassRoster)
  // ==========================================================================
  // 再次将 S1 分配入班级 B（S1 已经在班级 B 中）
  const idempotentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/roster/assign',
      method: 'POST',
      headers: authHeaders,
    },
    {
      classId: classB.id,
      studentIds: [s1.student.id],
    },
  );
  assert(idempotentRes.status === 200 || idempotentRes.status === 201, '重复分配已在班学员，接口幂等成功');
  const idempotentData = idempotentRes.body?.data || idempotentRes.body;
  assert(idempotentData.assignedCount === 0, '幂等防护：实际新编入人数 assignedCount = 0');

  const classBAfterIdempotent = await prisma.class.findUnique({ where: { id: classB.id } });
  assert(classBAfterIdempotent.currentStudentCount === 1, '幂等防护：班级 B 人数依然为 1，无重复自增');

  // 获取班级 B 的花名册全景
  const rosterRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/roster/class/${classB.id}`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(rosterRes.status === 200, '查询班级 B 花名册全景成功');
  const rosterData = rosterRes.body?.data || rosterRes.body;
  assert(rosterData.classId === classB.id, '花名册 classId 匹配');
  assert(rosterData.capacity === 5, '花名册 capacity 为 5');
  assert(rosterData.currentStudentCount === 1, '花名册 currentStudentCount 为 1');
  assert(rosterData.availableCapacity === 4, '花名册 availableCapacity 为 4');
  assert(Array.isArray(rosterData.students) && rosterData.students.length === 1, '花名册学员列表长度为 1');
  assert(rosterData.students[0].studentId === s1.student.id, '花名册在读学员为 S1');

  // ==========================================================================
  // 测试 8: 遗留老路由兼容代理验证 (Legacy POST /api/educational/classes/:id/students)
  // ==========================================================================
  const legacyRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/educational/classes/${classB.id}/students`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentIds: [s3.student.id],
    },
  );
  assert(legacyRes.status === 200 || legacyRes.status === 201, '老接口路由成功代理至协调器');
  const classBAfterLegacy = await prisma.class.findUnique({ where: { id: classB.id } });
  assert(classBAfterLegacy.currentStudentCount === 2, '通过老接口编入 S3 后，班级 B 人数增至 2');

  // ==========================================================================
  // 5. 测试数据安全清理
  // ==========================================================================
  console.log('\n>>> [Cleanup] 正在清理协调器专项测试临时数据...');
  const testStudentIds = [s1.student.id, s2.student.id, s3.student.id, s4.student.id, s5.student.id];
  await prisma.studentCoursePackage.deleteMany({
    where: { studentId: { in: testStudentIds } },
  });
  await prisma.student.deleteMany({
    where: { id: { in: testStudentIds } },
  });
  await prisma.class.deleteMany({
    where: { id: { in: [classA.id, classB.id, classC.id] } },
  });

  console.log('================================================================================');
  console.log(`🎉 协调器深模块专项套件完成！共 ${passed}/${total} 项严苛断言 100% 全部通过！`);
  console.log('================================================================================\n');
}

runTests()
  .catch((e) => {
    console.error('测试运行异常中断:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
