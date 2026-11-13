/**
 * 冒烟 1：各角色从登录页登录后的落地页和菜单 (真实浏览器 + 构建后的前端 + 临时后端)。
 * 完整的权限矩阵在 tests/unit/route-access-matrix.server.spec.js，这里确认真实页面上看到的一致。
 */
const { runSmoke, loginAs, pageText, check } = require('./helpers.cjs');

async function menuItems(page) {
  await page.waitForSelector('.app-menu');
  return page.evaluate(() => [...document.querySelectorAll('.app-menu .el-menu-item')].map((el) => el.textContent.trim()));
}

runSmoke('各角色登录与菜单', async (s) => {
  const { url } = s;
  let page = s.page;

  // 密码错误：留在登录页并提示原因
  await page.goto(`${url}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[placeholder="用户名 / 工号 / 手机号"]', 'zhangjh');
  await page.type('input[placeholder="请输入密码"]', 'wrong-password');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.el-message', { timeout: 10000 });
  check(new URL(page.url()).pathname === '/login', '密码错误时留在登录页');

  // 没登录直接打开后台页面：去登录页，登录后回到原本要去的页面
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${url}/financial/orderManagement`, { waitUntil: 'networkidle0' });
  check(new URL(page.url()).pathname === '/login', '没登录打开后台页面会去登录页');
  await loginAs(s, 'principal', '/financial/orderManagement');
  page = s.page;
  check(new URL(page.url()).pathname === '/financial/orderManagement', '执行校长登录后回到原本要去的订单页面');

  // 执行校长：能看到老师课酬
  await page.goto(`${url}/dashboard`, { waitUntil: 'networkidle0' });
  const principal = await menuItems(page);
  check(principal.includes('老师课酬') && principal.includes('订单营收流水'), `执行校长菜单有「老师课酬」「订单营收流水」(共 ${principal.length} 项)`);

  // 财务：有财务页面，没有老师课酬和角色管理；直接输入老师课酬地址被送回首页
  await loginAs(s, 'finance');
  page = s.page;
  check(new URL(page.url()).pathname === '/dashboard', '财务登录后进入控制台看板');
  const finance = await menuItems(page);
  check(finance.includes('订单营收流水') && finance.includes('业务审批工作台'), '财务菜单有订单和审批');
  check(!finance.includes('老师课酬') && !finance.includes('角色与权限'), '财务菜单没有「老师课酬」和「角色管理」');
  await page.goto(`${url}/financial/teacherPay`, { waitUntil: 'networkidle0' });
  check(new URL(page.url()).pathname === '/dashboard', '财务直接输入老师课酬地址被送回首页');

  // 课程顾问：有学员和教务页面，没有财务页面
  await loginAs(s, 'advisor');
  page = s.page;
  const advisor = await menuItems(page);
  check(advisor.includes('全部学员全景') && !advisor.includes('订单营收流水'), '课程顾问菜单有学员页面、没有财务页面');

  // 集团超管：能看到角色管理
  await loginAs(s, 'superAdmin');
  page = s.page;
  const admin = await menuItems(page);
  check(admin.includes('角色与权限') && admin.includes('老师课酬'), `集团超管菜单最全 (共 ${admin.length} 项)`);

  // 纯教师账号：登录后直接进教师端
  await loginAs(s, 'teacher');
  page = s.page;
  check(new URL(page.url()).pathname.startsWith('/teacher'), '任课老师登录后进入教师端');
  check((await pageText(page)).length > 0, '教师端页面有内容');
});
