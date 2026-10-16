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
console.log('✔ 讲台课表页 (012~015) 周日历、卡片操作与备课资源交互契约通过');

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
assert.ok(evalEditContent.includes('showExitModal'), '❌ 课评页缺少退出防丢确认弹窗 (018_课评_退出提醒)');
assert.ok(evalEditContent.includes('handleSubmitEvaluation') && evalEditContent.includes('handleSaveDraft'), '❌ 课评页缺少保存草稿与提交推送动作');
console.log('✔ 课评编辑页 (017~018) 模板选择、多媒体上传与退出确认弹窗契约通过');

// 6. 验证课评管理列表 (package-edu/evaluation/manage.vue - 对齐截图 055)
const evalManagePath = path.resolve(__dirname, '../mini-program/src/package-edu/evaluation/manage.vue');
const evalManageContent = fs.readFileSync(evalManagePath, 'utf8');

assert.ok(evalManageContent.includes('search-input') || evalManageContent.includes('searchKeyword'), '❌ 课评管理缺少搜索框');
assert.ok(evalManageContent.includes('push-status-tag'), '❌ 课评管理缺少已推送/未推送状态标签');
assert.ok(evalManageContent.includes('evaluation-student-card'), '❌ 课评管理缺少课评记录卡片列表');
console.log('✔ 课评管理页 (055) 检索、状态流转与课评记录卡片契约通过');

console.log('\n🎉 所有阶段二契约断言均 100% 验证通过！');
