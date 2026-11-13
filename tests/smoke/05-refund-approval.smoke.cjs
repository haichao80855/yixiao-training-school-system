/**
 * 冒烟 5：退费审批。执行校长给本校区学员报读后发起退费 (接口)，财务在「业务审批工作台」逐级点「同意」直到办结；
 * 核对审批单办结、退费订单生效、课包保持已退费。
 * (执行校长发起异动曾经一律返回 500，PR #54 修复；这里用执行校长发起，相当于再验证一次。)
 */
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, api, check, clickText } = require('./helpers.cjs');

const prisma = new PrismaClient();

runSmoke('退费审批', async (s) => {
  const { token, user } = await apiLogin('principal');
  const stamp = Date.now().toString(36);
  const name = `冒烟退费${stamp}`;
  const created = await api(token, 'POST', '/api/students', { name, gender: 'female', phone: `137${String(Date.now()).slice(-8)}`, campusId: user.campusId });
  const studentId = created.body?.data?.id;
  const course = (await prisma.course.findFirst({ where: { status: 'published' } })) || (await prisma.course.findFirst());
  const enroll = await api(token, 'POST', '/api/students/enroll', { studentId, courseId: course.id, totalLessons: 10, pricePerLesson: 200, paymentMethod: 'wechat' });
  const packageId = enroll.body?.data?.packageId;
  check(Boolean(packageId), '执行校长给学员报读 10 课时 (接口)');
  const refund = await api(token, 'POST', `/api/student/${studentId}/movement`, { type: 'refund', packageId, reasonCategory: '学业调整', reasonDetail: '冒烟测试退费' });
  const flowId = refund.body?.data?.approvalFlowId;
  check(Boolean(flowId), `执行校长发起退费，生成审批单 (接口返回 ${refund.status})`);

  await loginAs(s, 'finance');
  const page = s.page;
  await page.goto(`${s.url}/financial/approvalFlow`, { waitUntil: 'networkidle0' });

  for (let step = 1; step <= 3; step++) {
    const flow = await prisma.approvalFlow.findUnique({ where: { id: flowId } });
    if (flow.status !== 'pending') break;
    // 在列表里找到这名学员的审批单，点「同意」→「确认通过」
    await page.waitForFunction((n) => [...document.querySelectorAll('.el-table__row')].some((r) => r.innerText.includes(n)), {}, name);
    const agree = await page.evaluateHandle((n) => {
      const row = [...document.querySelectorAll('.el-table__fixed-right .el-table__row, .el-table__row')].find((r) => r.innerText.includes(n) || r.querySelector('button'));
      const rows = [...document.querySelectorAll('.el-table__row')];
      const idx = rows.findIndex((r) => r.innerText.includes(n));
      // 固定列和主表的行号一一对应
      const candidates = [...document.querySelectorAll('.el-table__row')].filter((_, i) => i % rows.length === idx % rows.length);
      return candidates.flatMap((r) => [...r.querySelectorAll('button')]).find((b) => b.innerText.trim() === '同意' && b.offsetParent !== null) || row;
    }, name);
    await agree.asElement().click();
    await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && d.innerText.includes('审批通过确认')));
    await clickText(page, '确认通过', '.el-dialog button');
    for (let i = 0; i < 50; i++) {
      const f = await prisma.approvalFlow.findUnique({ where: { id: flowId } });
      if (f.currentStep > flow.currentStep || f.status !== 'pending') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const now = await prisma.approvalFlow.findUnique({ where: { id: flowId } });
    check(now.status === 'approved' || now.currentStep > flow.currentStep, `第 ${flow.currentStep} 级审批通过 (现在：${now.status === 'approved' ? '已办结' : `第 ${now.currentStep} 级`})`);
    await page.waitForNetworkIdle({ idleTime: 300 }).catch(() => {});
  }

  const flow = await prisma.approvalFlow.findUnique({ where: { id: flowId }, include: { nodes: true } });
  check(flow.status === 'approved', '审批单已办结');
  check(flow.nodes.filter((n) => n.action === 'pass').length === 3, '三级审批都有「同意」记录');
  const refundOrder = await prisma.order.findUnique({ where: { id: refund.body.data.orderId } });
  check(refundOrder && refundOrder.status !== 'rejected' && refundOrder.status !== 'pending', `退费订单生效 (状态 ${refundOrder?.status})`);
  const pkg = await prisma.studentCoursePackage.findUnique({ where: { id: packageId } });
  check(pkg.status === 'refunded' && pkg.remainingLessons === 0, '课包保持已退费、课时清零');
}).finally(() => prisma.$disconnect());
