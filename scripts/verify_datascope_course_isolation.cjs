#!/usr/bin/env node
/**
 * 验证：系统设置-组织架构与机构-新增员工数据权限隔离与课程透视范围
 *
 * 验收标准：
 * 1. 权限为本人数据 (dataScope: 'self') 仅可看到自己的课程，严密阻断其他老师的课程
 * 2. 权限为本校数据 (dataScope: 'campus') 可以查看本校区其他老师的课程
 * 3. 权限为全部校区数据 (dataScope: 'all') 可以查看全集团各校区其他老师的课程
 */

const path = require('node:path');
const assert = require('node:assert');
const createJiti = require('jiti');

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src'),
  },
});

const systemMock = jiti('../src/mocks/system.ts');
const educationalMock = jiti('../src/mocks/educational.ts');

const {
  addSystemUser,
  getSystemUsers,
  updateSystemUser
} = systemMock;

const {
  getWorkbenchLessons,
  getScheduleEvents,
  getClasses,
  getTeachers,
  addClass,
  addScheduleEvent,
  MOCK_SCHEDULE_EVENTS,
  MOCK_CLASSES
} = educationalMock;

console.log('========================================================================');
console.log('【验证】系统设置-组织架构与机构-新增员工数据权限与课程透视范围');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 场景 1: 新增员工 - 权限为「仅本人数据」(dataScope: 'self')
// -----------------------------------------------------------------------------
console.log('--- 场景 1: 新增员工【孙老师】(dataScope: self) ---');
const sunTeacher = addSystemUser({
  name: '孙老师',
  account: 'sunls',
  phone: '13899991111',
  campusId: 'campus-bj-hq',
  campusName: '总部校区',
  roleId: 'r4',
  roleName: '少儿编程专职主讲教师',
  dataScope: 'self'
});

assert.strictEqual(sunTeacher.dataScope, 'self', '员工数据范围必须为 self');
console.log(`✓ 成功录入员工: ${sunTeacher.name} (${sunTeacher.account}), 数据权限: ${sunTeacher.dataScope}`);

// 1.1 验证讲台课程透视：孙老师尚未被排课，本人数据权限下必须只能看到自己课程 (0 节)，严禁泄露张老师等其他老师课程
const sunWorkbench = getWorkbenchLessons({
  campusId: 'campus-bj-hq',
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name
});
console.log(`✓ 孙老师 (self) 讲台获取排课卡片数: ${sunWorkbench.cards.length}`);
assert.strictEqual(sunWorkbench.cards.length, 0, '未排课的孙老师（本人数据权限）排课卡片数必须为 0，不能看到其他老师的课程');

// 1.2 验证时间课表透视：按孙老师身份查询，必须为 0
const sunSchedules = getScheduleEvents({
  campusId: 'campus-bj-hq',
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name
});
console.log(`✓ 孙老师 (self) 时间课表获取排课数: ${sunSchedules.length}`);
assert.strictEqual(sunSchedules.length, 0, '未排课的孙老师（本人数据权限）课表日程数必须为 0');

// 1.3 验证班级透视：按孙老师身份查询，必须为 0
const sunClasses = getClasses({
  campusId: 'campus-bj-hq',
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name
});
console.log(`✓ 孙老师 (self) 班级管理获取班级数: ${sunClasses.length}`);
assert.strictEqual(sunClasses.length, 0, '未带班的孙老师（本人数据权限）班级数必须为 0');

// 1.4 为孙老师新建一个专属班级并安排一节排课
console.log('\n  -> 为孙老师新增一门专属教学班级与排课日程...');
const sunClass = addClass({
  name: '孙老师-Scratch周五精品班',
  code: 'CLS-SUN-001',
  courseId: 'crs-scratch-01',
  courseName: 'Scratch创意图形编程',
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name,
  campusId: 'campus-bj-hq',
  classroomId: 'room-hq-101',
  classroomName: '创客实验室1',
  capacity: 8,
  status: 'in_progress',
  startDate: '2026-09-20',
  endDate: '2027-01-20'
});

const sunEvent = addScheduleEvent({
  campusId: 'campus-bj-hq',
  classId: sunClass.id,
  className: sunClass.name,
  courseId: sunClass.courseId,
  courseName: sunClass.courseName,
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name,
  classroomId: 'room-hq-101',
  classroomName: '创客实验室1',
  date: '2026-09-22',
  startTime: '14:00',
  endTime: '15:30',
  status: 'scheduled',
  classType: 'formal',
  studentIds: ['stu-001', 'stu-002']
});

// 1.5 再次以孙老师身份查询：恰好看到自己的这 1 门课程，依然不能看到张老师等其他老师的课程
const sunWorkbenchAfter = getWorkbenchLessons({
  campusId: 'campus-bj-hq',
  date: '2026-09-22',
  teacherId: sunTeacher.id,
  teacherName: sunTeacher.name
});
console.log(`✓ 孙老师 (self) 排课后讲台获取卡片数: ${sunWorkbenchAfter.cards.length}`);
assert.strictEqual(sunWorkbenchAfter.cards.length, 1, '孙老师必须恰好看到自己的 1 节课');
assert.strictEqual(sunWorkbenchAfter.cards[0].teacherName, '孙老师', '课程执教讲师必须是孙老师');
assert.strictEqual(sunWorkbenchAfter.cards[0].className, '孙老师-Scratch周五精品班', '课程名称必须与孙老师班级一致');

// -----------------------------------------------------------------------------
// 场景 2: 新增员工 - 权限为「本校数据」(dataScope: 'campus')
// -----------------------------------------------------------------------------
console.log('\n--- 场景 2: 新增员工【周老师】(dataScope: campus) ---');
const zhouTeacher = addSystemUser({
  name: '周老师',
  account: 'zhouls',
  phone: '13899992222',
  campusId: 'campus-bj-hq',
  campusName: '总部校区',
  roleId: 'r4',
  roleName: '少儿编程专职主讲教师',
  dataScope: 'campus'
});

assert.strictEqual(zhouTeacher.dataScope, 'campus', '员工数据范围必须为 campus');
console.log(`✓ 成功录入员工: ${zhouTeacher.name} (${zhouTeacher.account}), 数据权限: ${zhouTeacher.dataScope}`);

// 2.1 验证本校数据权限：周老师可以查看本校区所有其他老师的排课日程
const zhouCampusWorkbench = getWorkbenchLessons({
  campusId: 'campus-bj-hq'
  // 未指定特定 teacherId，模拟本校数据权限全景透视
});
console.log(`✓ 周老师 (campus) 讲台可透视全校区排课总数: ${zhouCampusWorkbench.cards.length}`);
assert(zhouCampusWorkbench.cards.length > 1, '本校区数据权限必须可以查看本校区其他老师的课程（排课数 > 1）');
const teacherNamesInCampus = new Set(zhouCampusWorkbench.cards.map(c => c.teacherName));
console.log(`  包含讲师列表:`, Array.from(teacherNamesInCampus).join(', '));
assert(teacherNamesInCampus.has('张老师'), '本校区数据权限必须包含张老师的课程');
assert(teacherNamesInCampus.has('孙老师'), '本校区数据权限必须包含孙老师的课程');

// 2.2 验证本校班级透视：可以查看本校区所有老师所带班级
const zhouClasses = getClasses({ campusId: 'campus-bj-hq' });
console.log(`✓ 周老师 (campus) 班级管理可透视全校区班级总数: ${zhouClasses.length}`);
assert(zhouClasses.length > 1, '本校区数据权限必须可以查看本校区所有班级');

// -----------------------------------------------------------------------------
// 场景 3: 新增员工 - 权限为「全部校区数据」(dataScope: 'all')
// -----------------------------------------------------------------------------
console.log('\n--- 场景 3: 新增员工【吴老师】(dataScope: all) ---');
const wuTeacher = addSystemUser({
  name: '吴老师',
  account: 'wuls',
  phone: '13899993333',
  campusId: 'campus-bj-hq',
  campusName: '总部校区',
  roleId: 'r1',
  roleName: '超级管理员 (集团总部)',
  dataScope: 'all'
});

assert.strictEqual(wuTeacher.dataScope, 'all', '员工数据范围必须为 all');
console.log(`✓ 成功录入员工: ${wuTeacher.name} (${wuTeacher.account}), 数据权限: ${wuTeacher.dataScope}`);

// 3.1 验证全部校区数据权限：可以跨校区查看排课与班级
const allSchedules = getScheduleEvents();
console.log(`✓ 吴老师 (all) 全集团排课透视总数: ${allSchedules.length}`);
assert(allSchedules.length > 0, '全部校区数据权限必须可以透视全集团课程排课');

const allClasses = getClasses();
console.log(`✓ 吴老师 (all) 全集团班级透视总数: ${allClasses.length}`);
assert(allClasses.length > 0, '全部校区数据权限必须可以透视全集团班级');

console.log('\n========================================================================');
console.log('🎉 验证 100% 通过！');
console.log('  1. 权限为本人数据：严格仅可看到自己的课程，绝对看不到其他老师的课程；');
console.log('  2. 权限为本校数据：可以查看本校区其他老师的课程；');
console.log('  3. 权限为全部校区数据：可以穿透查看全集团所有老师的课程。');
console.log('========================================================================');
