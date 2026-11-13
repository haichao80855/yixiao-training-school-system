/**
 * 冒烟 2：报名开单。执行校长在「全部学员」里找到学员，打开档案 → 报读开单，走完 4 步向导并提交；
 * 然后用接口核对学员名下有了课包、生成了订单。
 * 学员用接口提前建好 (造数据走接口，界面只测关键操作)。
 */
const { runSmoke, loginAs, apiLogin, api, check, clickText, chooseOption, waitMessage } = require('./helpers.cjs');

runSmoke('报名开单', async (s) => {
  const { token, user } = await apiLogin('principal');
  const stamp = Date.now().toString(36);
  const name = `冒烟报名${stamp}`;
  const created = await api(token, 'POST', '/api/students', { name, gender: 'male', phone: `139${String(Date.now()).slice(-8)}`, campusId: user.campusId });
  check(created.status === 201 || created.status === 200, `接口建好学员「${name}」`);
  const studentId = created.body?.data?.id;

  await loginAs(s, 'principal');
  const page = s.page;
  await page.goto(`${s.url}/studentCenter/allStudent`, { waitUntil: 'networkidle0' });

  // 搜索并打开学员档案
  await page.type('input[placeholder="输入姓名、S948918 或手机号..."]', name);
  await clickText(page, '查询', 'button');
  await page.waitForNetworkIdle({ idleTime: 300 });
  await clickText(page, name, '.el-table .cursor-pointer, .el-table span, .el-table div');
  await clickText(page, '报读开单', 'button');
  await page.waitForSelector('.el-dialog .el-steps', { visible: true });
  check(true, '从学员档案打开报读开单向导');

  // 第 1 步：学员已锁定为当前学员，校区默认
  await clickText(page, '下一步', '.el-dialog button');
  // 第 2 步：选课程 (第一门可选课程)，课时用推荐值
  await chooseOption(page, '选择报读课程')
  await clickText(page, '下一步', '.el-dialog button');
  // 第 3 步：不用优惠
  await clickText(page, '下一步', '.el-dialog button');
  // 第 4 步：微信支付并提交
  await clickText(page, '微信支付', '.el-dialog .el-radio-button');
  const summary = await page.$eval('.el-dialog', (el) => el.innerText);
  check(summary.includes(name) && /实付金额/.test(summary), '确认清单里显示学员姓名和实付金额');
  await clickText(page, '确认签约收款并入库', '.el-dialog button');
  const msg = await waitMessage(page, /成功|已提交|待审批|入库/);
  check(Boolean(msg), `提交后提示：${msg}`);

  // 接口核对：学员有了课包和订单
  await page.waitForNetworkIdle({ idleTime: 300 }).catch(() => {});
  const profile = await api(token, 'GET', `/api/students/${studentId}/profile`);
  const packages = profile.body?.data?.packages || [];
  check(packages.length === 1, `学员名下有 1 个课包 (实际 ${packages.length})`);
  check(packages[0].totalLessons > 0, `课包课时 ${packages[0].totalLessons} > 0`);
  const orders = await api(token, 'GET', `/api/financial/orders?keyword=${encodeURIComponent(name)}`);
  const list = Array.isArray(orders.body?.data) ? orders.body.data : orders.body?.data?.list || [];
  check(list.some((o) => (o.student?.name || o.studentName) === name), '订单列表里有这名学员的新订单');
});
