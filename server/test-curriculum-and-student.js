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
  console.log('拓视未来教育「一校教培系统」后端第三步（教研课程与学员中心）集成测试');
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

  // 1. 登录超管账号获取 JWT Token
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

  // 获取系统校区列表，供后续关联使用
  const campusesRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/system/campuses',
    method: 'GET',
    headers: authHeaders,
  });
  assert(campusesRes.status === 200, '成功获取基础校区列表');
  const campuses = campusesRes.body.data;
  const hqCampus = campuses.find((c) => c.isHeadquarter) || campuses[0];
  const secondCampus = campuses[1];

  // ----------------------------------------------------------------
  // 2. 教研课程中台 API 验证
  // ----------------------------------------------------------------
  console.log('\n--- 2. 教研课程中台 API 验证 ---');

  // 2.1 课程列表分页与过滤
  const courseListRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/curriculum/courses?page=1&pageSize=5',
    method: 'GET',
    headers: authHeaders,
  });
  assert(courseListRes.status === 200, '课程分页列表接口返回 200');
  assert(courseListRes.body.data.list.length > 0, '种子数据包含已初始化的标准课程');
  const existingCourse = courseListRes.body.data.list[0];

  // 2.2 课程详情与单元课次大纲
  const courseDetailRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/curriculum/courses/${existingCourse.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(courseDetailRes.status === 200, '课程详情接口返回 200');
  assert(Array.isArray(courseDetailRes.body.data.authorizedCampuses), '课程详情包含授权校区列表');

  // 2.3 新增自定义课程
  const testCourseCode = `CRS-AI-TEST-${Date.now().toString().slice(-4)}`;
  const newCourseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/curriculum/courses',
      method: 'POST',
      headers: authHeaders,
    },
    {
      code: testCourseCode,
      name: 'Python与人工智能机器人创新进阶课',
      cover: '/covers/python_robot.svg',
      pricePerLesson: 320,
      totalLessons: 48,
      subject: 'python',
      grade: 'middle',
      attribute: 'extended',
      description: '针对高年级少儿的人工智能感知与编程高阶课',
      campusIds: [hqCampus.id],
    },
  );
  assert(newCourseRes.status === 201 || newCourseRes.status === 200, '创建新课程接口成功');
  const createdCourseId = newCourseRes.body.data.id;
  assert(newCourseRes.body.data.code === testCourseCode, '创建课程代码匹配');

  // 2.4 新增大纲单元与课次
  const unitRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${createdCourseId}/units`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      unitName: '单元一：计算机视觉与 OpenCV 编程初探',
      sort: 1,
      lessons: [
        { lessonName: '第1课：图像色彩通道与像素矩阵', durationMin: 90, sort: 1 },
        { lessonName: '第2课：人脸特征点识别与追踪算法', durationMin: 90, sort: 2 },
      ],
    },
  );
  assert(unitRes.status === 201 || unitRes.status === 200, '成功为课程新增大纲单元');
  assert(unitRes.body.data.lessons.length === 2, '单元下包含 2 节对应课次');

  // 2.5 课程跨校区重新授权
  const authUpdateRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${createdCourseId}/campus-auth`,
      method: 'POST',
      headers: authHeaders,
    },
    { campusIds: [hqCampus.id, secondCampus.id] },
  );
  assert(authUpdateRes.status === 201 || authUpdateRes.status === 200, '跨校区多选授权接口成功');
  assert(authUpdateRes.body.data.length === 2, '成功授权 2 个物理校区');

  // 2.6 课程状态机切换 (禁用 -> 启用)
  const disableRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${createdCourseId}/status`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'disabled' },
  );
  assert(disableRes.body.data.status === 'disabled', '课程状态成功切换为停用 (disabled)');

  const enableRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/curriculum/courses/${createdCourseId}/status`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { status: 'enabled' },
  );
  assert(enableRes.body.data.status === 'enabled', '课程状态恢复为启用 (enabled)');

  // ----------------------------------------------------------------
  // 3. 学员中心档案与 360° 全景画像验证
  // ----------------------------------------------------------------
  console.log('\n--- 3. 学员中心档案与 360° 全景画像验证 ---');

  // 3.1 学员分页列表
  const studentListRes = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/students?page=1&pageSize=5',
    method: 'GET',
    headers: authHeaders,
  });
  assert(studentListRes.status === 200, '学员列表接口返回 200');
  assert(studentListRes.body.data.list.length > 0, '种子数据包含初始化学员');
  const firstStudent = studentListRes.body.data.list[0];
  assert(firstStudent.warningLevel !== undefined, '学员列表成功附带消课预警级别');

  // 3.2 创建新学员
  const newStudentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: '测试学员-林小童',
      gender: 'female',
      phone: '13888889999',
      campusId: hqCampus.id,
      parentName: '林爸爸',
      school: '中关村第一小学',
      birthday: '2016-06-15',
      address: '北京市海淀区中关村南大街1号',
    },
  );
  assert(newStudentRes.status === 201 || newStudentRes.status === 200, '创建学员档案接口成功');
  const createdStudent = newStudentRes.body.data;
  assert(createdStudent.studentNo.startsWith('S'), '自动生成正规学号格式 (S...)');
  assert(createdStudent.wallet !== null, '学员创建时自动绑定初始化电子零钱包');

  // 3.3 查看学员 360° 全景画像
  const profileRes = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(profileRes.status === 200, '学员 360° 画像接口返回 200');
  assert(profileRes.body.data.walletSummary.principalBalance === 0, '初始零钱包本金为 0');
  assert(Array.isArray(profileRes.body.data.packages), '360° 画像包含在读课包卡片数组');
  assert(Array.isArray(profileRes.body.data.walletLedgers), '360° 画像包含钱包流水账本');

  // ----------------------------------------------------------------
  // 4. 报名单开单与合同签约向导验证
  // ----------------------------------------------------------------
  console.log('\n--- 4. 报名单开单与合同签约向导验证 ---');

  const enrollRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students/enroll',
      method: 'POST',
      headers: authHeaders,
    },
    {
      studentId: createdStudent.id,
      courseId: createdCourseId,
      totalLessons: 48,
      bonusLessons: 4,
      pricePerLesson: 320,
      discountAmount: 360,
      paymentMethod: 'wechat',
      channel: 'ground',
      remark: '2026秋季新学期签约开单',
    },
  );
  assert(enrollRes.status === 201 || enrollRes.status === 200, '报名单开单签约接口成功');
  assert(enrollRes.body.data.orderNo.startsWith('ORD-'), '自动生成正式订单号 ORD-...');
  // 应收实付: 48 * 320 - 360 = 15360 - 360 = 15000
  assert(enrollRes.body.data.actualAmount === 15000, '开单实付金额高精度核算正确 (¥15000)');
  assert(enrollRes.body.data.totalLessons === 52, '总课时数正确累加赠送课时 (48+4=52)');
  const packageId = enrollRes.body.data.packageId;

  // 验证签约后，学员 360° 画像中课包已激活
  const profileAfterEnroll = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(profileAfterEnroll.body.data.packages.length === 1, '学员课包列表中出现新开课包');
  assert(profileAfterEnroll.body.data.packages[0].remainingLessons === 52, '课包初始剩余课时为 52');

  // ----------------------------------------------------------------
  // 5. 7 分支学员异动状态机业务穿透验证
  // ----------------------------------------------------------------
  console.log('\n--- 5. 7 分支学员异动状态机业务穿透验证 ---');

  // 5.1 异动分支 1：停课休学 (suspend)
  const suspendRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${createdStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'suspend',
      reasonCategory: '生病休学',
      reasonDetail: '因骨折需休养 30 天',
      suspendDays: 30,
    },
  );
  assert(suspendRes.status === 201 || suspendRes.status === 200, '停课休学异动提交成功');

  const studentSuspended = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(studentSuspended.body.data.status === 'suspended', '学员状态流转为已休学 (suspended)');

  // 5.2 异动分支 2：复课顺延合同 (resume)
  const resumeRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${createdStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'resume',
      reasonCategory: '康复返校',
      reasonDetail: '身体康复，恢复正常授课并顺延有效期',
      suspendDays: 30,
    },
  );
  assert(resumeRes.status === 201 || resumeRes.status === 200, '复课异动申请成功');

  const studentResumed = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(studentResumed.body.data.status === 'normal', '学员状态自动恢复为在读正常 (normal)');

  // 5.3 异动分支 3：跨校区转移 (transfer_campus)
  const transferCampusRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${createdStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_campus',
      reasonCategory: '家庭搬迁/距离过远',
      targetCampusId: secondCampus.id,
      reasonDetail: '转至望京科技园校区',
    },
  );
  assert(transferCampusRes.status === 201 || transferCampusRes.status === 200, '转校异动成功');

  const studentTransferredCampus = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(
    studentTransferredCampus.body.data.campusId === secondCampus.id,
    '学员所属校区租户 ID 成功变更至目标校区',
  );

  // 5.4 异动分支 4：换课折算 (change_course)
  const changeCourseRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${createdStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'change_course',
      packageId: packageId,
      targetCourseId: existingCourse.id,
      reasonCategory: '学员兴趣调整',
      reasonDetail: '改学 Scratch 启蒙体系',
    },
  );
  assert(changeCourseRes.status === 201 || changeCourseRes.status === 200, '换课折算异动成功');

  // 5.5 异动分支 5：课包转让给二胎家庭/其他学员 (transfer_student)
  // 先新建二胎学员
  const secondStudentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/students',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: '测试二胎学员-林小妹',
      gender: 'female',
      phone: '13888889999',
      campusId: secondCampus.id,
      parentName: '林爸爸',
    },
  );
  const secondStudent = secondStudentRes.body.data;

  // 获取林小童换课后的最新课包 ID
  const profileAfterChange = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${createdStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  const activePackage = profileAfterChange.body.data.packages.find((p) => p.status === 'active');
  assert(activePackage !== undefined, '换课后生成了有效的新课程课包');

  const transferStudentRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${createdStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'transfer_student',
      packageId: activePackage.id,
      targetStudentId: secondStudent.id,
      reasonCategory: '转给二胎/直系亲属',
      reasonDetail: '哥哥课时转给妹妹学习',
    },
  );
  assert(transferStudentRes.status === 201 || transferStudentRes.status === 200, '转让课包异动成功');

  // 验证第二学员收到了该课包
  const secondStudentProfile = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${secondStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  assert(secondStudentProfile.body.data.packages.length === 1, '受让学员已成功接管该课包');

  // 5.6 异动分支 6：退费 (refund) - 盛通防腐退费核算
  const refundPackageId = secondStudentProfile.body.data.packages[0].id;
  const refundRes = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/students/${secondStudent.id}/movement`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'refund',
      packageId: refundPackageId,
      reasonCategory: '其他原因退款',
      reasonDetail: '由于家庭原因申请退费',
    },
  );
  assert(refundRes.status === 201 || refundRes.status === 200, '盛通防腐退费异动核算并执行成功');
  assert(refundRes.body.data.targetData.refundStatus === 'refunded', '课包标记为已退费');

  // 验证退费后课包剩余课时清零
  const finalProfile = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/students/${secondStudent.id}/profile`,
    method: 'GET',
    headers: authHeaders,
  });
  const refundedPackage = finalProfile.body.data.packages.find((p) => p.id === refundPackageId);
  assert(refundedPackage.status === 'refunded', '课包终态为 refunded');
  assert(refundedPackage.remainingLessons === 0, '退费后剩余可用课时清零');
  assert(finalProfile.body.data.abnormals.length > 0, '学员画像中完整留存异动审计轨迹');

  console.log('\n================================================================');
  console.log(`🎉 全部 ${passed}/${total} 项教研与学员中心业务断言 100% 验证通过！`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('测试运行异常失败:', err);
  process.exit(1);
});
