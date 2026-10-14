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
  console.log('================================================================');
  console.log('跨校区课程交付中心（CourseDeliveryEngine）专项验证套件');
  console.log('多校区授权准入、未授权建班强阻断、大盘交付目录与转校资质核验');
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

  // 准备测试数据：获取 2 个校区
  const campuses = await prisma.campus.findMany({ take: 2 });
  assert(campuses.length >= 2, '数据库至少存在 2 所物理校区');
  const campusA = campuses[0];
  const campusB = campuses[1];

  const teacher = await prisma.user.findFirst();
  assert(!!teacher, '数据库存在测试讲师');

  // 获取测试教室
  let classroom = await prisma.classroom.findFirst({ where: { campusId: campusB.id } });
  if (!classroom) {
    classroom = await prisma.classroom.findFirst();
  }
  assert(!!classroom, '数据库存在测试教室');

  // 2. 创建一门专属测试课程，初始仅授权给校区 A，未授权给校区 B
  const courseCode = `CRS-TEST-DELIVERY-${Date.now()}`;
  const testCourse = await prisma.course.create({
    data: {
      code: courseCode,
      name: `跨校区交付测试课程-${Date.now().toString().slice(-4)}`,
      cover: 'https://example.com/cover.png',
      pricePerLesson: 120,
      totalLessons: 16,
      subject: 'python',
      grade: 'middle',
      attribute: 'regular',
      status: 'enabled',
    },
  });

  // 仅对校区 A 授权
  await prisma.courseCampusAuth.create({
    data: {
      courseId: testCourse.id,
      campusId: campusA.id,
    },
  });

  console.log('\n--- 场景一：未授权校区违规开班建课强阻断 ---');
  const unauthClassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campusB.id, // 未授权的校区 B
      courseId: testCourse.id,
      classroomId: classroom.id,
      teacherId: teacher.id,
      code: `CLS-UNAUTH-${Date.now()}`,
      name: '未授权测试班级',
      capacity: 8,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  );
  assert(unauthClassRes.status === 400, '向未授权校区 B 创建班级被 400 强阻断');
  const unauthMsg = unauthClassRes.body?.message || '';
  assert(
    unauthMsg.includes('未对校区') && unauthMsg.includes('开放交付授权'),
    `拦截提示契合领域规则: "${unauthMsg}"`,
  );

  console.log('\n--- 场景二：停用（disabled）课程严禁开班交付 ---');
  // 临时停用课程
  await prisma.course.update({
    where: { id: testCourse.id },
    data: { status: 'disabled' },
  });
  // 即使在已授权的校区 A 开班也应被拦截
  const disabledClassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campusA.id,
      courseId: testCourse.id,
      classroomId: classroom.id,
      teacherId: teacher.id,
      code: `CLS-DISABLED-${Date.now()}`,
      name: '停用课程测试班级',
      capacity: 8,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  );
  assert(disabledClassRes.status === 400, '停用状态课程开班被 400 强阻断');
  assert(
    (disabledClassRes.body?.message || '').includes('停用状态'),
    '阻断提示明确指出课程处于停用状态',
  );

  // 恢复课程为 enabled
  await prisma.course.update({
    where: { id: testCourse.id },
    data: { status: 'enabled' },
  });

  console.log('\n--- 场景三：跨校区批量授权交付与开班准入成功 ---');
  // 通过接口将课程同时授权给校区 A 与校区 B
  const authRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${testCourse.id}/campus-auth`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusIds: [campusA.id, campusB.id],
    },
  );
  assert(authRes.status === 200 || authRes.status === 201, '跨校区授权接口调用成功');

  // 现在在校区 B 建班应顺利通过
  const authorizedClassRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/educational/classes',
      method: 'POST',
      headers: authHeaders,
    },
    {
      campusId: campusB.id,
      courseId: testCourse.id,
      classroomId: classroom.id,
      teacherId: teacher.id,
      code: `CLS-AUTH-${Date.now()}`,
      name: '授权合格班级',
      capacity: 8,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  );
  assert(authorizedClassRes.status === 200 || authorizedClassRes.status === 201, '授予校区交付资质后建班成功');
  const createdClass = authorizedClassRes.body?.data || authorizedClassRes.body;
  assert(createdClass.courseId === testCourse.id, '班级课程外键准确绑定');

  console.log('\n--- 场景四：校区交付大盘快照（Deliverable Catalog Snapshot）---');
  const catalogRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/delivery-catalog/${campusB.id}`,
      method: 'GET',
      headers: authHeaders,
    },
  );
  assert(catalogRes.status === 200, '获取校区交付大盘目录成功响应 200');
  const catalogData = catalogRes.body?.data || catalogRes.body;
  assert(catalogData.campusId === campusB.id, '目录归属校区正确');
  assert(Array.isArray(catalogData.catalog), '返回可交付课程数组列表');
  const foundInCatalog = catalogData.catalog.find((c) => c.id === testCourse.id);
  assert(!!foundInCatalog, '大盘目录中包含新授权课程');
  assert(foundInCatalog.activeClassCount >= 1, '新授权课程的大盘班级统计聚合准确');

  console.log('\n--- 场景五：跨校区转校资质核验与风控拦截 ---');
  // 创建一个测试学员，归属于校区 B，持有专属课程的有效课包
  const studentSeq = Math.floor(100000 + Math.random() * 900000);
  const studentForTransfer = await prisma.student.create({
    data: {
      campusId: campusB.id,
      studentNo: `STDEL${studentSeq}`,
      name: `转校测试学员-${studentSeq}`,
      gender: 'female',
      phone: `139${studentSeq.toString().slice(0, 8)}`,
      status: 'normal',
    },
  });

  const testPkg = await prisma.studentCoursePackage.create({
    data: {
      studentId: studentForTransfer.id,
      courseId: testCourse.id,
      totalLessons: 16,
      remainingLessons: 16,
      pricePerLesson: 120,
      status: 'active',
    },
  });

  // 现在剥夺校区 A 对该课程的交付授权（模拟校区 A 未引入此高端课）
  await prisma.courseCampusAuth.deleteMany({
    where: {
      courseId: testCourse.id,
      campusId: campusA.id,
    },
  });

  // 此时学员尝试从校区 B 转校至校区 A
  const transferRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentForTransfer.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_campus',
      targetCampusId: campusA.id,
      reasonCategory: '跨区搬家',
      reasonDetail: '申请跨校区转移',
    },
  );
  assert(transferRes.status === 400, '目标校区无对应课程交付资质时转校被 400 拦截');
  const transferMsg = transferRes.body?.message || '';
  assert(
    transferMsg.includes('未获课程') && transferMsg.includes('交付授权'),
    `转校拦截原因准确指明缺失课程: "${transferMsg}"`,
  );

  // 重新补齐校区 A 授权
  await prisma.courseCampusAuth.create({
    data: { courseId: testCourse.id, campusId: campusA.id },
  });

  // 再次申请转校，顺利通过
  const transferOkRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${studentForTransfer.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_campus',
      targetCampusId: campusA.id,
      reasonCategory: '跨区搬家',
      reasonDetail: '授权补齐后再次转校',
    },
  );
  assert(transferOkRes.status === 200 || transferOkRes.status === 201, '目标校区资质齐备后转校成功');
  const updatedStudent = await prisma.student.findUnique({
    where: { id: studentForTransfer.id },
  });
  assert(updatedStudent.campusId === campusA.id, '学员所属校区已物理迁移至目标校区 A');

  // 清理测试数据
  await prisma.class.deleteMany({
    where: { id: createdClass.id },
  });
  await prisma.studentCoursePackage.deleteMany({
    where: { id: testPkg.id },
  });
  await prisma.courseCampusAuth.deleteMany({
    where: { courseId: testCourse.id },
  });
  await prisma.course.delete({
    where: { id: testCourse.id },
  });

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项跨校区课程交付中心专项测试断言 100% 验证通过！`);
  console.log('================================================================');
}

runTests()
  .catch((e) => {
    console.error('测试运行异常失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
