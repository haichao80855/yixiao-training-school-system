/**
 * 课评状态判定的前端契约：
 * - Web 课评弹窗保存时，老师没动过的学员只提交出勤，不产生空课评条目
 * - 小程序【看学情】不能只看课次级的 isPublished
 * 运行命令: node tests/test_evaluation_override_payload.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTsModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', outputText)(mod, mod.exports);
  return mod.exports;
}

const { buildEvaluationOverride } = loadTsModule('src/views/educational/components/lessonEvaluationOverride.ts');

const student = (patch = {}) => ({
  studentId: 's1',
  attendanceStatus: 'present',
  deductLessons: 1,
  isEvaluated: false,
  rating: 5,
  comment: '',
  performanceTag: '',
  photos: [],
  videoUrl: '',
  ...patch,
});
const EVALUATION_FIELDS = ['personalizedComment', 'rating', 'performanceTag', 'photos', 'videoUrl', 'isEvaluated'];

// 没动过的学员：只同步出勤。字段全部缺失时服务端才会跳过条目写入
const untouched = buildEvaluationOverride(student({ attendanceStatus: 'late', deductLessons: 2 }));
assert.deepStrictEqual(untouched, { studentId: 's1', attendanceStatus: 'late', deductLessons: 2 });
console.log('✓ 没动过的学员只提交出勤');

// 老师操作过的任何一项都要保留
for (const [label, patch] of [
  ['评语', { comment: '进步很大' }],
  ['照片', { photos: ['/a.jpg'] }],
  ['视频', { videoUrl: '/a.mp4' }],
  ['标签', { performanceTag: '专注' }],
  ['改过评分', { rating: 3 }],
  ['已暂存', { isEvaluated: true }],
]) {
  const payload = buildEvaluationOverride(student(patch));
  for (const field of EVALUATION_FIELDS) {
    assert.ok(field in payload, `${label}: 应提交 ${field}`);
  }
}
console.log('✓ 老师写过或改过的内容都会提交');

// 有内容时标记为已评定；只改评分不算写完
assert.strictEqual(buildEvaluationOverride(student({ comment: '进步很大' })).isEvaluated, true);
assert.strictEqual(buildEvaluationOverride(student({ rating: 3 })).isEvaluated, false);
console.log('✓ 已评定标记与内容一致');

// 已写过的评语被清空：isEvaluated 为真，必须提交空值才能真正清除
const cleared = buildEvaluationOverride(student({ isEvaluated: true }));
assert.strictEqual(cleared.personalizedComment, '');
console.log('✓ 清空已有评语时仍会提交');

const edu = fs.readFileSync(path.join(root, 'mini-program/src/api/edu.ts'), 'utf8');
assert.ok(
  /typeof s\.isPublished === 'boolean'\s*\?\s*Boolean\(s\.isPublished && s\.hasPersonalEvaluation\)/.test(edu),
  '小程序【看学情】必须同时判断 isPublished 与 hasPersonalEvaluation',
);
console.log('✓ 小程序已推送判定同时要求专属课评内容');
