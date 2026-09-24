const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

console.log('================================================================');
console.log('拓视未来教育「一校教培系统」教务中心-班级与班容 批量排课端到端逻辑验证');
console.log('================================================================\n');

// 1. 编译并加载 src/mocks/educational.ts
const tsSource = fs.readFileSync(path.resolve(__dirname, '../src/mocks/educational.ts'), 'utf8');

// 模拟 window / localStorage
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; }
};
global.window = {
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; }
  }
};

const jsSource = ts.transpileModule(tsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true
  }
}).outputText;

const moduleCache = {};
function loadTsModule(relPath) {
  const fullPath = path.resolve(__dirname, relPath);
  if (moduleCache[fullPath]) return moduleCache[fullPath];
  const code = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const m = { exports: {} };
  moduleCache[fullPath] = m.exports;
  const f = new Function('require', 'module', 'exports', 'window', js);
  f(customRequire, m, m.exports, global.window);
  moduleCache[fullPath] = m.exports;
  return m.exports;
}

function customRequire(modPath) {
  if (modPath.startsWith('./')) {
    const candidate = modPath.endsWith('.ts') ? modPath : `${modPath}.ts`;
    const target = path.resolve(__dirname, '../src/mocks', candidate);
    if (fs.existsSync(target)) {
      return loadTsModule(path.relative(__dirname, target));
    }
  }
  return require(modPath);
}
const educational = loadTsModule('../src/mocks/educational.ts');
if (educational.MOCK_CLASSES.length === 0 && educational.restoreEducationalMockData) {
  educational.restoreEducationalMockData();
}

console.log('【Step 1】查询当前校区的班级列表...');
const classes = educational.getClasses({ campusId: 'campus-bj-hq' });
console.log(`✓ 成功获取校区班级 ${classes.length} 个`);
assert(classes.length > 0, '班级列表不能为空');

const targetClass = classes[0];
console.log(`  选中目标班级: [${targetClass.code}] ${targetClass.name}`);
console.log(`  当前排课进度: ${targetClass.completedLessons || 0} / ${targetClass.totalLessons || 48} 讲`);
console.log(`  初始排课描述: ${targetClass.scheduleDesc || '无'}`);

console.log('\n【Step 2】执行批量排课测试 (智能未来日期: 2026-09-26, 每周六 14:00-16:00, 循环 16 次)...');
const batchOptions = {
  startDate: '2026-09-26',
  startTime: '14:00',
  endTime: '16:00',
  repeatCount: 16,
  teacherId: targetClass.teacherId,
  classroomId: targetClass.classroomId,
  forceIfConflict: true
};

const result = educational.batchScheduleClass(targetClass.id, batchOptions);
console.log(`✓ 排课结果: success=${result.success}, 生成课次=${result.createdEvents.length}, 冲突数=${result.conflicts.length}`);
console.log(`  系统反馈: ${result.message}`);

assert.strictEqual(result.success, true, '批量排课必须返回 success=true');
assert.strictEqual(result.createdEvents.length, 16, '必须成功生成 16 节课次');

console.log('\n【Step 3】验证生成的排课课次日期与时区 (确保不发生东八区日期倒退一天)...');
assert.strictEqual(result.createdEvents[0].date, '2026-09-26', '第 1 讲必须是 2026-09-26 (周六)');
assert.strictEqual(result.createdEvents[1].date, '2026-10-03', '第 2 讲必须是 2026-10-03 (周六)');
assert.strictEqual(result.createdEvents[15].date, '2027-01-09', '第 16 讲必须是 2027-01-09 (周六)');
console.log('✓ 首末课次日期完全准确，无 UTC 时区偏差！');

console.log('\n【Step 4】验证班级实体信息自动联动更新...');
const updatedClass = educational.getClassById(targetClass.id);
console.log(`  更新后排课进度: ${updatedClass.completedLessons} 讲`);
console.log(`  更新后排课描述: ${updatedClass.scheduleDesc}`);
assert(updatedClass.completedLessons >= 16, '班级进度应增加 16 讲');
assert(updatedClass.scheduleDesc.includes('14:00-16:00'), '班级描述中应包含排课时段');

console.log('\n【Step 5】验证持久化储存与看板检索 (getScheduleEvents)...');
// 查询 2026-09-21 到 2026-09-27 (即当前系统基准周 2026-09-22 所在周)
const weekEvents = educational.getScheduleEvents({
  startDate: '2026-09-21',
  endDate: '2026-09-27',
  campusId: 'campus-bj-hq'
});
console.log(`  基准周 (2026-09-21 ~ 2026-09-27) 检索到排课事件数: ${weekEvents.length}`);
const myEvent = weekEvents.find(e => e.classId === targetClass.id && e.date === '2026-09-26');
assert(!!myEvent, '基准周排课看板中必须能检索到 2026-09-26 的新排课次！');
console.log(`  ✓ 看板成功命中新排课次: [${myEvent.lessonTitle}] ${myEvent.className} (${myEvent.startTime}-${myEvent.endTime})`);

console.log('\n【Step 6】验证多班级批量排课支持 (applyToAllSelected)...');
if (classes.length >= 2) {
  const class2 = classes[1];
  const res2 = educational.batchScheduleClass(class2.id, {
    ...batchOptions,
    startDate: '2026-09-27', // 周日班
    repeatCount: 12
  });
  assert(res2.success, '第二班批量排课应成功');
  assert.strictEqual(res2.createdEvents.length, 12, '第二班应生成 12 节课');
  console.log(`  ✓ 班级 2 [${class2.name}] 成功生成 ${res2.createdEvents.length} 讲课次`);
}

console.log('\n================================================================');
console.log('🎉 批量排课端到端全链路业务逻辑全部校验通过！无任何报错！');
console.log('================================================================');
