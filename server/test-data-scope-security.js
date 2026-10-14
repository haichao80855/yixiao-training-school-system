/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」行级数据隔离策略引擎 (DataScopePolicyEngine)
 * 安全红蓝对抗渗透测试套件 (Security Penetration Test Suite)
 * 验证：单实体查改删防越权、防数据主键探测 (Anti-Oracle)、列表自动行级隔离与超管透视
 * ==============================================================================
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = '127.0.0.1';

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function login(account, password = '123456') {
  const res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { account, password },
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`登录失败 [${account}]: ${JSON.stringify(res.body)}`);
  }
  return res.body.data?.accessToken || res.body.data?.token || res.body.accessToken || res.body.token;
}

async function runSecurityTests() {
  console.log('================================================================================');
  console.log('🛡️  DataScopePolicyEngine 行级数据隔离与跨校区防水平越权渗透测试套件');
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

  let serverProcess = null;
  const isRunning = await checkPort(PORT, HOST);

  if (!isRunning) {
    console.log(`>>> 后端服务未在端口 ${PORT} 运行，正在拉起 dist/main.js...`);
    serverProcess = spawn('node', ['dist/main.js'], {
      cwd: __dirname,
      stdio: 'pipe',
    });

    let ready = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (await checkPort(PORT, HOST)) {
        ready = true;
        console.log(`✓ NestJS 后端微服务启动就绪 (http://${HOST}:${PORT})\n`);
        break;
      }
    }
    if (!ready) {
      console.error('❌ 后端服务启动超时！');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  } else {
    console.log(`>>> 复用已在运行的后端服务 (http://${HOST}:${PORT})\n`);
  }

  try {
    // 1. 准备测试主体与跨校区目标实体
    const superAdminToken = await login('donghaichao', '123456');

    // 获取总部校区 (campus-bj-hq) 与 远洋校区 (campus-bj-yy)
    const hqCampus = await prisma.campus.findUnique({ where: { id: 'campus-bj-hq' } });
    const yyCampus = await prisma.campus.findUnique({ where: { id: 'campus-bj-yy' } });
    assert(hqCampus && yyCampus, '预置总部校区与远洋校区数据存在');

    // 确保远洋校区有一个合法的测试账号 (yy_teacher_test)
    let yyUser = await prisma.user.findFirst({
      where: { campusId: 'campus-bj-yy', account: 'yy_teacher_test' },
    });
    const bcrypt = require('bcryptjs');
    const pwdHash = await bcrypt.hash('123456', 10);
    const principalRole = await prisma.role.findFirst({ where: { code: 'principal' } });

    if (!yyUser) {
      yyUser = await prisma.user.create({
        data: {
          account: 'yy_teacher_test',
          password: pwdHash,
          realName: '远洋分校测试员工',
          phone: '13900008888',
          campusId: 'campus-bj-yy',
          dataScope: 'campus',
          status: 'active',
        },
      });
      if (principalRole) {
        await prisma.userRole.create({
          data: { userId: yyUser.id, roleId: principalRole.id },
        });
      }
    } else {
      await prisma.user.update({
        where: { id: yyUser.id },
        data: { password: pwdHash },
      });
      const hasRole = await prisma.userRole.findFirst({
        where: { userId: yyUser.id, roleId: principalRole.id },
      });
      if (!hasRole && principalRole) {
        await prisma.userRole.create({
          data: { userId: yyUser.id, roleId: principalRole.id },
        });
      }
    }
    const yyToken = await login('yy_teacher_test', '123456');
    assert(!!yyToken, '远洋分校测试员工成功登录并获取专属 JWT Token');

    // 获取总部校区的一个有效学员 (HQ Student)
    let hqStudent = await prisma.student.findFirst({
      where: { campusId: 'campus-bj-hq' },
    });
    if (!hqStudent) {
      hqStudent = await prisma.student.create({
        data: {
          name: '总部敏感测试学员',
          studentNo: 'STU-TEST-HQ-001',
          phone: '13811112222',
          campusId: 'campus-bj-hq',
          status: 'normal',
        },
      });
    }
    let yyStudent = await prisma.student.findFirst({
      where: { campusId: 'campus-bj-yy' },
    });
    if (!yyStudent) {
      yyStudent = await prisma.student.create({
        data: {
          name: '远洋本校测试学员',
          studentNo: 'STU-TEST-YY-001',
          phone: '13911113333',
          campusId: 'campus-bj-yy',
          status: 'normal',
        },
      });
    }
    assert(!!yyStudent, `获取远洋本校测试学员 (ID: ${yyStudent.id}, 校区: ${yyStudent.campusId})`);

    // -------------------------------------------------------------------------
    // 测试 1: 单实体详情跨校区防越权探测 (Anti-Oracle 盲注防护)
    // -------------------------------------------------------------------------
    const getRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${hqStudent.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${yyToken}` },
    });

    assert(
      getRes.status === 404 || getRes.status === 403,
      `测试 1: 远洋校区员工访问总部学员详情被安全拦截 (HTTP ${getRes.status})，杜绝敏感信息外泄`,
    );

    // -------------------------------------------------------------------------
    // 测试 2: 单实体跨校区非法修改防御 (Anti-Tamper)
    // -------------------------------------------------------------------------
    const originalRemark = hqStudent.remark;
    const updateRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: `/api/students/${hqStudent.id}`,
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${yyToken}`,
          'Content-Type': 'application/json',
        },
      },
      { remark: '恶意篡改攻击已由远洋注入' },
    );

    assert(
      updateRes.status === 404 || updateRes.status === 403,
      `测试 2: 远洋校区员工试图修改总部学员被拦截阻断 (HTTP ${updateRes.status})`,
    );

    const checkedHqStudent = await prisma.student.findUnique({ where: { id: hqStudent.id } });
    assert(
      checkedHqStudent.remark === originalRemark,
      '测试 2.1: 数据库底层核实：总部学员备注未被非法篡改',
    );

    // -------------------------------------------------------------------------
    // 测试 3: 单实体跨校区非法删除防御 (Anti-Delete)
    // -------------------------------------------------------------------------
    const deleteRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/students/${hqStudent.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${yyToken}` },
    });

    assert(
      deleteRes.status === 404 || deleteRes.status === 403,
      `测试 3: 远洋校区员工试图删除总部学员被拦截阻断 (HTTP ${deleteRes.status})`,
    );

    const stillExistsStudent = await prisma.student.findUnique({ where: { id: hqStudent.id } });
    assert(!!stillExistsStudent, '测试 3.1: 数据库底层核实：总部学员档案依然完好无损存续');

    // -------------------------------------------------------------------------
    // 测试 4: 跨校区非法提取钱包本金防御 (Wallet Anti-Theft)
    // -------------------------------------------------------------------------
    const withdrawRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: `/api/students/${hqStudent.id}/wallet/withdraw`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${yyToken}`,
          'Content-Type': 'application/json',
        },
      },
      { amount: 100, operator: '恶意攻击者' },
    );

    assert(
      withdrawRes.status === 404 || withdrawRes.status === 403,
      `测试 4: 跨校区提现偷取资金被强行阻断 (HTTP ${withdrawRes.status})`,
    );

    // -------------------------------------------------------------------------
    // 测试 5: 列表查询自动行级数据隔离 (Zero-Boilerplate Row-Level Scoping)
    // -------------------------------------------------------------------------
    const listRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/students?page=1&pageSize=50', // 故意不传 campusId
      method: 'GET',
      headers: { Authorization: `Bearer ${yyToken}` },
    });

    assert(listRes.status === 200, '测试 5: 远洋校区员工查询学员列表成功 (HTTP 200)');
    const studentsList = listRes.body.data ? listRes.body.data.list : (listRes.body.list || []);
    const allBelongToYy = studentsList.every((s) => s.campusId === 'campus-bj-yy');
    assert(
      allBelongToYy,
      `测试 5.1: 远洋校区员工返回的全部 ${studentsList.length} 名学员均严格属于远洋校区 (零跨校区数据掺杂)`,
    );

    // -------------------------------------------------------------------------
    // 测试 6: 超级管理员全集团跨校区透视能力
    // -------------------------------------------------------------------------
    const superListRes = await request({
      hostname: HOST,
      port: PORT,
      path: '/api/students?page=1&pageSize=50',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assert(superListRes.status === 200, '测试 6: 超管查询学员列表成功 (HTTP 200)');
    const superStudentsList = superListRes.body.data ? superListRes.body.data.list : (superListRes.body.list || []);
    const hasMultipleCampuses = new Set(superStudentsList.map((s) => s.campusId)).size > 1;
    assert(
      hasMultipleCampuses,
      `测试 6.1: 超管能够正常跨校区透视各分校业务数据 (跨越 ${new Set(superStudentsList.map((s) => s.campusId)).size} 个物理校区)`,
    );

    // -------------------------------------------------------------------------
    // 测试 7: 跨校区创建实体防伪造校区归属 (Anti-Forge Campus Creation)
    // -------------------------------------------------------------------------
    const forgeCreateRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/students',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${yyToken}`,
          'Content-Type': 'application/json',
        },
      },
      {
        name: '远洋员工试图伪造在总部开户的学员',
        studentNo: 'STU-FORGE-HQ-999',
        phone: '13988887777',
        campusId: 'campus-bj-hq', // 恶意伪造总部校区
      },
    );

    assert(
      forgeCreateRes.status === 403,
      `测试 7: 远洋员工试图向总部校区伪造写入数据被坚决拦截 (HTTP 403 Forbidden)`,
    );

    // 正常不传 campusId 时，引擎自动补齐当前用户所属校区
    const autoCampusCreateRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/students',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${yyToken}`,
          'Content-Type': 'application/json',
        },
      },
      {
        name: '远洋员工正常创建学员',
        studentNo: `STU-YY-AUTO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        phone: `139${Math.floor(10000000 + Math.random() * 90000000)}`,
        gender: 'male',
        // 故意不传 campusId
      },
    );

    assert(
      autoCampusCreateRes.status === 200 || autoCampusCreateRes.status === 201,
      `测试 7.1: 不传 campusId 时系统成功创建学员 (HTTP ${autoCampusCreateRes.status})`,
    );
    const createdStudent = autoCampusCreateRes.body.data || autoCampusCreateRes.body;
    assert(
      createdStudent.campusId === 'campus-bj-yy',
      `测试 7.2: 引擎底层自动安全补齐当前校区归属 (campusId=${createdStudent.campusId})`,
    );

    // 清理自动创建的测试学员
    if (createdStudent.id) {
      await prisma.student.delete({ where: { id: createdStudent.id } });
    }

    console.log(`\n🎉 全部 ${passed}/${total} 项行级数据隔离与红蓝对抗安全测试均 100% 通过！\n`);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSecurityTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
