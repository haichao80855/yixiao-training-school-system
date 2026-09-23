const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

console.log('================================================================');
console.log('盛通教育「一校教培系统」教务-讲台(Workbench)与深度课评系统 端到端验证');
console.log('================================================================\n');

// 模拟 window / localStorage
const storage = {};
global.window = {
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; }
  }
};

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

console.log('【Step 1】查询讲台当日排课卡片与 7 维指标统计...');
const workbenchData = educational.getWorkbenchLessons({ campusId: 'campus-bj-hq' });
console.log(`✓ 讲台检索到排课卡片总数: ${workbenchData.cards.length}`);
console.log(`  7 维指标看板:`, workbenchData.stats);
assert(workbenchData.cards.length > 0, '讲台排课卡片列表不能为空');
assert(typeof workbenchData.stats.lessonCount === 'number', '课次数量必须为数字');
assert(typeof workbenchData.stats.attendedTimes === 'number', '到课人次必须为数字');
assert(typeof workbenchData.stats.signedRate === 'number', '出勤率必须为数字');

const targetLesson = workbenchData.cards[0];
console.log(`  选取讲台焦点课程: [${targetLesson.className}] - ${targetLesson.lessonTitle || '首课'}`);
console.log(`  当前状态: ${targetLesson.status} | 讲师: ${targetLesson.teacherName} | 教室: ${targetLesson.classroomName}`);

console.log('\n【Step 2】执行上课与结课生命周期驱动...');
const startRes = educational.startLesson(targetLesson.id);
console.log(`  上课响应: ${startRes.message}`);
assert.strictEqual(startRes.success, true, '上课必须成功');
const afterStartLesson = educational.getWorkbenchLessons({ campusId: 'campus-bj-hq' }).cards.find(c => c.id === targetLesson.id);
assert.strictEqual(afterStartLesson.status, 'in_progress', '课次状态应流转至 in_progress');

const finishRes = educational.finishLesson(targetLesson.id);
console.log(`  结课响应: ${finishRes.message}`);
assert.strictEqual(finishRes.success, true, '结课必须成功');
const afterFinishLesson = educational.getWorkbenchLessons({ campusId: 'campus-bj-hq' }).cards.find(c => c.id === targetLesson.id);
assert.strictEqual(afterFinishLesson.status, 'completed', '课次状态应流转至 completed');

console.log('\n【Step 3】获取课评预置模板...');
const templates = educational.getEvaluationTemplates();
console.log(`✓ 成功获取系统课评专业模板 ${templates.length} 套:`);
templates.forEach(t => console.log(`  - [${t.id}] ${t.name} (${t.category})`));
assert(templates.length >= 4, '必须包含通用、单片机、Scratch、Python等至少4套模板');

console.log('\n【Step 4】执行课评录入与暂存草稿 (Draft)...');
const draftPayload = {
  lessonTimeId: targetLesson.id,
  classId: targetLesson.classId,
  className: targetLesson.className,
  lessonTitle: targetLesson.lessonTitle || '第1讲：机械手臂舵机控制',
  templateId: 'tmpl-microbit',
  templateName: '单片机硬件科创课评模板',
  studyContent: '<p><strong>单片机舵机控制与红外避障小车实训</strong></p><p>1. 掌握数字引脚与模拟引脚的区别与信号读取</p>',
  rating: 5,
  voiceUrl: 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/audio/eval_test.mp3',
  voiceDuration: 45,
  videoUrl: 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/video/test.mp4',
  photoList: [
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500',
    'https://images.unsplash.com/photo-1588072432836-e10032774350?w=500',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'
  ],
  teacherComment: '通过游戏的方式吸引学生兴趣，在整个编程过程中循序渐进！',
  aiPolished: false
};

const draftEval = educational.saveLessonEvaluation(draftPayload, false);
console.log(`✓ 课评草稿暂存成功: ID=${draftEval.id}, Status=${draftEval.status}`);
assert.strictEqual(draftEval.status, 'draft', '暂存状态必须为 draft');
assert.strictEqual(draftEval.photoList.length, 3, '必须存储 3 张现场照片');

console.log('\n【Step 5】执行 AI 润色并【保存并发送家长端】(Published)...');
const publishedPayload = {
  ...draftPayload,
  teacherComment: draftPayload.teacherComment + ' 🌟 在教育心理学正向激励引导下，孩子不仅掌握了计算机科学精髓，更培养了严谨的逻辑闭环！',
  aiPolished: true
};

const publishedEval = educational.saveLessonEvaluation(publishedPayload, true);
console.log(`✓ 课评正式推送成功: ID=${publishedEval.id}, Status=${publishedEval.status}, 推送时间=${publishedEval.publishTime}`);
assert.strictEqual(publishedEval.status, 'published', '推送状态必须为 published');
assert.strictEqual(publishedEval.aiPolished, true, 'AI润色标记应为 true');
assert(!!publishedEval.publishTime, '推送时间不可为空');

console.log('\n【Step 6】验证数据持久化存储与回查 (模拟页面刷新)...');
const restored = educational.getLessonEvaluationByLessonId(targetLesson.id);
assert(!!restored, '必须能够根据课次 ID 精确检索到已发布的课评记录');
assert.strictEqual(restored.rating, 5, '综合评分必须为 5 星');
assert.strictEqual(restored.photoList.length, 3, '相册照片持久化完整');
console.log(`  ✓ 成功回查已落盘课评: [${restored.templateName}] 评分: ${restored.rating}星 | 状态: ${restored.status}`);

console.log('\n【Step 7】再次查询讲台，验证课评状态联动...');
const refreshedWorkbench = educational.getWorkbenchLessons({ campusId: 'campus-bj-hq' });
const updatedCard = refreshedWorkbench.cards.find(c => c.id === targetLesson.id);
console.log(`  讲台卡片课评状态联动: ${updatedCard.evaluationStatus}`);
assert.strictEqual(updatedCard.evaluationStatus, 'published', '讲台卡片课评状态必须联动呈现 published');

console.log('\n================================================================');
console.log('🎉 教学讲台与深度课评系统全链路业务逻辑全部校验通过！无任何报错！');
console.log('================================================================');
