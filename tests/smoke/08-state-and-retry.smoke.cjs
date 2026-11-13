/**
 * 冒烟 8：状态保持与失败重试 (流畅度改进第 4 期)。
 * - 学员列表的搜索关键字写在地址栏：刷新页面、去别的页面再返回，列表还是原来的筛选结果；
 * - 审批页默认「待我审批」，切到「已通过」后刷新仍停在「已通过」；
 * - 学员列表加载失败时显示「加载失败」和重试按钮 (不是「暂无数据」)，点重试后正常显示。
 */
const { PrismaClient } = require('../../server/node_modules/@prisma/client');
const { runSmoke, loginAs, apiLogin, check } = require('./helpers.cjs');

const prisma = new PrismaClient();

runSmoke('状态保持与失败重试', async (s) => {
  const { user } = await apiLogin('principal');
  const tag = `__t_${Date.now().toString(36)}`;
  const student = await prisma.student.create({ data: { campusId: user.campusId, name: `状态保持${tag}`, studentNo: tag, gender: 'female', phone: '13900000000' } });
  try {
    await loginAs(s, 'principal');
    const page = s.page;
    const textHas = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);

    // ---------- 关键字写进地址栏，刷新和返回后还在 ----------
    await page.goto(`${s.url}/studentCenter/allStudent`, { waitUntil: 'networkidle0' });
    const input = await page.waitForSelector('input[placeholder*="姓名"]');
    await input.type(tag);
    await page.waitForFunction((t) => location.search.includes(encodeURIComponent(t)) || location.search.includes(t), {}, tag);
    await page.waitForNetworkIdle();
    check(await textHas(student.name), '按关键字搜到了学员');
    await page.reload({ waitUntil: 'networkidle0' });
    check((await page.$eval('input[placeholder*="姓名"]', (el) => el.value)) === tag && (await textHas(student.name)), '刷新后搜索框和结果都还在');
    await page.goto(`${s.url}/dashboard`, { waitUntil: 'networkidle0' });
    await page.goBack({ waitUntil: 'networkidle0' });
    check((await page.$eval('input[placeholder*="姓名"]', (el) => el.value)) === tag, '去别的页面再返回，搜索条件还在');

    // ---------- 审批页标签 ----------
    await page.goto(`${s.url}/financial/approvalFlow`, { waitUntil: 'networkidle0' });
    const activeLabel = () => page.evaluate(() => [...document.querySelectorAll('button.el-button--primary')].map((b) => b.innerText.trim()).find((t) => /待我审批|已通过|已驳回|全部状态/.test(t)) || '');
    check((await activeLabel()).startsWith('待我审批'), '审批页默认打开「待我审批」');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('已通过')).click());
    await page.waitForFunction(() => location.search.includes('status=approved'));
    await page.reload({ waitUntil: 'networkidle0' });
    check((await activeLabel()).startsWith('已通过'), '切到「已通过」后刷新，仍停在「已通过」');

    // ---------- 加载失败可重试 ----------
    await page.setRequestInterception(true);
    let failNext = true;
    const onRequest = (req) => {
      if (failNext && req.url().includes('/api/students?')) {
        failNext = false;
        req.abort('failed');
      } else {
        req.continue();
      }
    };
    page.on('request', onRequest);
    await page.goto(`${s.url}/studentCenter/allStudent?q=${tag}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('重新加载'));
    check(!(await textHas('暂无数据')), '加载失败时显示失败原因和「重新加载」，不显示「暂无数据」');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('重新加载')).click());
    await page.waitForFunction((n) => document.body.innerText.includes(n), {}, student.name);
    check(true, '点「重新加载」后学员列表正常显示');
    page.off('request', onRequest);
    await page.setRequestInterception(false);
  } finally {
    await prisma.student.deleteMany({ where: { id: student.id } });
    await prisma.$disconnect();
  }
});
