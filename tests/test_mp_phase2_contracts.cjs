const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 运行微信小程序端阶段二（教学履约闭环）契约测试');
console.log('======================================================');

// 1. 验证编译产物 app.json 中的 package-edu 路由挂载
const distAppJsonPath = path.resolve(__dirname, '../mini-program/dist/build/mp-weixin/app.json');
assert.ok(fs.existsSync(distAppJsonPath), '❌ 编译产物 app.json 不存在！');
const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

const eduSubPkg = appJson.subPackages.find((s) => s.root === 'package-edu');
assert.ok(eduSubPkg, '❌ 缺少教务分包 package-edu 配置');

const expectedEduPages = [
  'lecture/index',
  'lecture/roll-call',
  'evaluation/edit',
  'evaluation/manage',
];

for (const p of expectedEduPages) {
  assert.ok(eduSubPkg.pages.includes(p), `❌ package-edu 缺少核心页面: ${p}`);
}
console.log('✔ package-edu 4 大教学履约页面路由挂载验证通过');

// 2. 验证 API 契约 (api/edu.ts)
const eduApiTsPath = path.resolve(__dirname, '../mini-program/src/api/edu.ts');
assert.ok(fs.existsSync(eduApiTsPath), '❌ api/edu.ts 不存在');
const eduApiContent = fs.readFileSync(eduApiTsPath, 'utf8');

const expectedApiMethods = [
  'getSchedules',
  'getFulfillmentWorkbench',
  'fulfillLesson',
  'reverseFulfillment',
  'commitEvaluation',
  'uploadPhoto',
  'uploadVideo',
];

for (const method of expectedApiMethods) {
  assert.ok(
    eduApiContent.includes(method),
    `❌ api/edu.ts 缺少必须的 API 方法契约: ${method}`
  );
}
console.log('✔ eduApi 包含结课履约、反结课冲正、课评提交与多媒体上传等全量 API 契约');

// 3. 验证讲台与排课课表 (package-edu/lecture/index.vue - 对齐截图 012~015)
const lecturePagePath = path.resolve(__dirname, '../mini-program/src/package-edu/lecture/index.vue');
const lectureContent = fs.readFileSync(lecturePagePath, 'utf8');

assert.ok(lectureContent.includes('calendar-strip-card') || lectureContent.includes('weekDays'), '❌ 讲台页面缺少周日历日期滑块');
assert.ok(lectureContent.includes('showActionSheet'), '❌ 讲台页面缺少 ActionSheet 更多操作抽屉');
assert.ok(lectureContent.includes('showResourceModal'), '❌ 讲台页面缺少备课资源/PPT-HTML弹窗');
assert.ok(lectureContent.includes('package-edu/lecture/roll-call'), '❌ 讲台页面缺少点名签到直连跳转');
assert.ok(lectureContent.includes('isCalendarExpanded'), '❌ 讲台日历缺少下拉展开状态机');
assert.ok(lectureContent.includes('month-calendar-panel'), '❌ 讲台日历缺少下拉月视图面板');
assert.ok(lectureContent.includes('handlePrevPeriod'), '❌ 讲台日历缺少向前翻月/翻周选取上月日期方法');
assert.ok(lectureContent.includes('todayDateStr'), '❌ 讲台日历缺少动态今日日期计算');
assert.ok(lectureContent.includes('handleMonthPickerChange'), '❌ 讲台日历缺少月份选择器切换方法');
console.log('✔ 讲台课表页 (012~015) 周日历下拉展开、选取上月日期与今日默认选中契约通过');

// 4. 验证课次点名签到 (package-edu/lecture/roll-call.vue - 对齐截图 016)
const rollCallPath = path.resolve(__dirname, '../mini-program/src/package-edu/lecture/roll-call.vue');
const rollCallContent = fs.readFileSync(rollCallPath, 'utf8');

assert.ok(rollCallContent.includes('section-action-strip'), '❌ 点名页缺少实到/应到出勤统计横幅');
assert.ok(rollCallContent.includes('push-notice-banner'), '❌ 点名页缺少微信服务号上课提醒推送通知条');
assert.ok(rollCallContent.includes('status-toggle-btn') || rollCallContent.includes('toggleStudentStatus'), '❌ 点名页缺少到课/请假/旷课/补课状态流转');
assert.ok(rollCallContent.includes('package-edu/evaluation/edit'), '❌ 点名页缺少跳转写课评逻辑');
console.log('✔ 课次详情签到页 (016) 出勤统计、点名状态、课评入口契约通过');

// 5. 验证写课评与防丢失机制 (package-edu/evaluation/edit.vue - 对齐截图 017~018)
const evalEditPath = path.resolve(__dirname, '../mini-program/src/package-edu/evaluation/edit.vue');
const evalEditContent = fs.readFileSync(evalEditPath, 'utf8');

assert.ok(evalEditContent.includes('template-selector-card') || evalEditContent.includes('currentTemplateName'), '❌ 课评页缺少预设模板选择');
assert.ok(evalEditContent.includes('studyContent'), '❌ 课评页缺少学习内容输入区域');
assert.ok(evalEditContent.includes('handleChoosePhoto') && evalEditContent.includes('handleChooseVideo'), '❌ 课评页缺少随堂实况照片/视频上传');
assert.ok(evalEditContent.includes('!uploadedVideo'), '❌ 课评页上传一个视频后未隐藏上传视频卡片');
assert.ok(evalEditContent.includes('removeVideo'), '❌ 课评页缺少移除视频方法');
assert.ok(evalEditContent.includes('最多只能上传一个视频'), '❌ 课评页缺少最多上传一个视频的拦截防线');
assert.ok(evalEditContent.includes('showExitModal'), '❌ 课评页缺少退出防丢确认弹窗 (018_课评_退出提醒)');
assert.ok(evalEditContent.includes('handleSubmitEvaluation') && evalEditContent.includes('handleSaveDraft'), '❌ 课评页缺少保存草稿与提交推送动作');
console.log('✔ 课评编辑页 (017~018) 模板选择、单视频上限与隐藏、多媒体上传与退出确认弹窗契约通过');

// 6. 验证课评管理列表 (package-edu/evaluation/manage.vue - 对齐截图 055)
const evalManagePath = path.resolve(__dirname, '../mini-program/src/package-edu/evaluation/manage.vue');
const evalManageContent = fs.readFileSync(evalManagePath, 'utf8');

assert.ok(evalManageContent.includes('search-input') || evalManageContent.includes('searchKeyword'), '❌ 课评管理缺少搜索框');
assert.ok(evalManageContent.includes('push-status-tag'), '❌ 课评管理缺少已推送/未推送状态标签');
assert.ok(evalManageContent.includes('evaluation-student-card'), '❌ 课评管理缺少课评记录卡片列表');
console.log('✔ 课评管理页 (055) 检索、状态流转与课评记录卡片契约通过');

// 7. 验证课评写错修订闭环 (Evaluation Revision Lifecycle - ADR-0010 & 方案二)
const drawerPath = path.resolve(__dirname, '../mini-program/src/components/LessonGrowthReviewDrawer.vue');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');

assert.ok(drawerContent.includes('header-edit-pill'), '❌ 学情卡抽屉头部缺少【改课评】快捷操作胶囊');
assert.ok(drawerContent.includes('re-edit-btn'), '❌ 学情卡抽屉底部缺少【改课评】操作按钮');
assert.ok(drawerContent.includes('isRevision=1'), '❌ 学情卡跳转编辑页缺少 isRevision=1 参数');

assert.ok(evalEditContent.includes('isRevisionMode'), '❌ 课评编辑页缺少 isRevisionMode 修订模式感知');
assert.ok(evalEditContent.includes('保存并更新'), '❌ 课评编辑页修订模式缺少【保存并更新】文案切换');
assert.ok(evalEditContent.includes('evictGrowthCache'), '❌ 课评编辑页提交缺少失效学情卡本地缓存调用');

const coordinatorPath = path.resolve(__dirname, '../mini-program/src/coordinators/fulfillment/coordinator.ts');
const coordinatorContent = fs.readFileSync(coordinatorPath, 'utf8');
assert.ok(coordinatorContent.includes('isEvaluated'), '❌ 履约协调器 hydrateStudentDraft 缺少 isEvaluated 已评标记');
assert.ok(coordinatorContent.includes('currentComment'), '❌ 履约协调器 hydrateStudentDraft 缺少历史评语回填');
// 8. 看学情：5 维核心素养雷达图已下线，改为展示「课程内容与知识点大纲」(与家长端「本节课学了什么」同源)
assert.ok(!drawerContent.includes('radarSvgUri') && !drawerContent.includes('radar-svg-img'), '❌ 看学情不应再渲染 5 维核心素养雷达图');
assert.ok(drawerContent.includes('课程内容与知识点大纲'), '❌ 看学情缺少「课程内容与知识点大纲」板块');
assert.ok(drawerContent.includes('growthData.courseOutline'), '❌ 课程大纲板块必须绑定投影器下发的 courseOutline');
assert.ok(!drawerContent.includes('<svg viewBox'), '❌ 学情卡严禁直接使用 WXML 不支持的裸 <svg> 标签');
console.log('✔ 看学情课程内容与知识点大纲板块契约通过 (雷达图已下线)');

console.log('\n🎉 所有阶段二契约断言均 100% 验证通过！');
