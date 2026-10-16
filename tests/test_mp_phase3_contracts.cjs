const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 运行微信小程序端阶段三（学员与班级管理）契约测试');
console.log('======================================================');

// 1. 验证编译产物 app.json 中的 package-student 与 package-edu 路由挂载
const distAppJsonPath = path.resolve(__dirname, '../mini-program/dist/build/mp-weixin/app.json');
assert.ok(fs.existsSync(distAppJsonPath), '❌ 编译产物 app.json 不存在！');
const appJson = JSON.parse(fs.readFileSync(distAppJsonPath, 'utf8'));

const studentSubPkg = appJson.subPackages.find((s) => s.root === 'package-student');
assert.ok(studentSubPkg, '❌ 缺少学员分包 package-student 配置');

const expectedStudentPages = [
  'list/index',
  'detail/index',
  'enroll/wizard',
  'edit/index',
];

for (const p of expectedStudentPages) {
  assert.ok(studentSubPkg.pages.includes(p), `❌ package-student 缺少页面: ${p}`);
}

const eduSubPkg = appJson.subPackages.find((s) => s.root === 'package-edu');
assert.ok(eduSubPkg, '❌ 缺少教务分包 package-edu 配置');
assert.ok(eduSubPkg.pages.includes('class/index'), '❌ package-edu 缺少班级管理 class/index');
assert.ok(eduSubPkg.pages.includes('class/detail'), '❌ package-edu 缺少班级详情 class/detail');

console.log('✔ package-student 与 package-edu 路由挂载完整性校验通过');

// 2. 验证 API 模块契约 (studentApi, classApi, catalogApi)
const studentApiPath = path.resolve(__dirname, '../mini-program/src/api/student.ts');
assert.ok(fs.existsSync(studentApiPath), '❌ api/student.ts 不存在');
const studentApiContent = fs.readFileSync(studentApiPath, 'utf8');

const expectedStudentMethods = [
  'getStudents',
  'getStudentProfile',
  'enrollStudent',
  'createStudent',
  'updateStudent',
  'rechargeWallet',
  'executeMovement',
];
for (const m of expectedStudentMethods) {
  assert.ok(studentApiContent.includes(m), `❌ studentApi 缺少方法: ${m}`);
}

const classApiPath = path.resolve(__dirname, '../mini-program/src/api/class.ts');
assert.ok(fs.existsSync(classApiPath), '❌ api/class.ts 不存在');
const classApiContent = fs.readFileSync(classApiPath, 'utf8');

const expectedClassMethods = [
  'getClasses',
  'getClassDetail',
  'addClassStudents',
  'completeClass',
];
for (const m of expectedClassMethods) {
  assert.ok(classApiContent.includes(m), `❌ classApi 缺少方法: ${m}`);
}

const catalogApiPath = path.resolve(__dirname, '../mini-program/src/api/catalog.ts');
assert.ok(fs.existsSync(catalogApiPath), '❌ api/catalog.ts 不存在');
const catalogApiContent = fs.readFileSync(catalogApiPath, 'utf8');
assert.ok(catalogApiContent.includes('getCourses'), '❌ catalogApi 缺少 getCourses');
assert.ok(catalogApiContent.includes('getGoods'), '❌ catalogApi 缺少 getGoods');

console.log('✔ studentApi / classApi / catalogApi 核心业务契约校验通过');

// 3. 验证学员名册组件 (package-student/list/index.vue - 023 & 029)
const studentListPage = path.resolve(__dirname, '../mini-program/src/package-student/list/index.vue');
const studentListContent = fs.readFileSync(studentListPage, 'utf8');

assert.ok(studentListContent.includes('top-tabs-row'), '❌ 学员名册缺少顶部全部学员/待分班学员 Tab');
assert.ok(studentListContent.includes('search-input'), '❌ 学员名册缺少搜索输入框');
assert.ok(studentListContent.includes('filter-capsules-bar'), '❌ 学员名册缺少4联下拉筛选胶囊');
assert.ok(studentListContent.includes('student-card'), '❌ 学员名册缺少学员卡片');
assert.ok(studentListContent.includes('float-add-btn'), '❌ 学员名册缺少右下角悬浮蓝加号按钮');
console.log('✔ 学员名册页 (023 & 029) 结构与交互契约校验通过');

// 4. 验证学员档案详情 (package-student/detail/index.vue - 024~027)
const studentDetailPage = path.resolve(__dirname, '../mini-program/src/package-student/detail/index.vue');
const studentDetailContent = fs.readFileSync(studentDetailPage, 'utf8');

assert.ok(studentDetailContent.includes('avatar-badge-qi'), '❌ 学员详情缺少大头像启徽章');
assert.ok(studentDetailContent.includes('action-cursor-btn'), '❌ 学员详情缺少右上角橙色操作按钮');
assert.ok(studentDetailContent.includes('metrics-grid-row'), '❌ 学员详情缺少4栏关键数据指标');
assert.ok(studentDetailContent.includes('frozen-banner'), '❌ 学员详情缺少冻结课次通知横幅');
assert.ok(studentDetailContent.includes('detail-tabs-bar'), '❌ 学员详情缺少三大核心 Tab 栏');
assert.ok(studentDetailContent.includes('action-sheet-dialog'), '❌ 学员详情缺少操作 ActionSheet 弹窗');
console.log('✔ 学员全息档案页 (024~027) 4栏指标、3大Tab与操作抽屉契约校验通过');

// 5. 验证学员报名开单全向导 (package-student/enroll/wizard.vue - 034 & 089~093)
const enrollWizardPage = path.resolve(__dirname, '../mini-program/src/package-student/enroll/wizard.vue');
const enrollWizardContent = fs.readFileSync(enrollWizardPage, 'utf8');

assert.ok(enrollWizardContent.includes('search-step-view'), '❌ 报名向导缺少第一步学员查询与引导');
assert.ok(enrollWizardContent.includes('student-header-card'), '❌ 报名向导缺少选中学员卡片头部');
assert.ok(enrollWizardContent.includes('showCourseModal'), '❌ 报名向导缺少选择课程规格弹窗');
assert.ok(enrollWizardContent.includes('showGoodsModal'), '❌ 报名向导缺少选择教具教材弹窗');
assert.ok(enrollWizardContent.includes('showClassModal'), '❌ 报名向导缺少选择班级弹窗');
assert.ok(enrollWizardContent.includes('enroll-submit-big-btn'), '❌ 报名向导缺少底部去报名大按钮');
console.log('✔ 学员报名全向导 (034 & 089~093) 查学员/选课/选物/选班/下单契约校验通过');

// 6. 验证班级管理与班级详情 (package-edu/class/index.vue & detail.vue - 019~022)
const classListPage = path.resolve(__dirname, '../mini-program/src/package-edu/class/index.vue');
const classListContent = fs.readFileSync(classListPage, 'utf8');
assert.ok(classListContent.includes('class-record-card'), '❌ 班级管理缺少班级卡片');
assert.ok(classListContent.includes('class-attr-stats-row'), '❌ 班级管理缺少班容与开班状态行');

const classDetailPage = path.resolve(__dirname, '../mini-program/src/package-edu/class/detail.vue');
const classDetailContent = fs.readFileSync(classDetailPage, 'utf8');
assert.ok(classDetailContent.includes('class-tabs-bar'), '❌ 班级详情缺少三大 Tab (排课表/签到记录/班级学员)');
assert.ok(classDetailContent.includes('finish-class-btn'), '❌ 班级详情缺少结班归档按钮');
assert.ok(classDetailContent.includes('stu-roster-card'), '❌ 班级详情缺少在班花名册学员卡片');

console.log('✔ 班级管理与详情页 (019~022) 列表、排课与在班花名册契约校验通过');

console.log('\n🎉 所有阶段三契约断言均 100% 验证通过！');
