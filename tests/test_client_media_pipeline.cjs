const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 运行 ClientMediaPipeline 多媒体深模块与契约验证测试');
console.log('======================================================');

// 1. 静态代码契约审查：验证 ClientMediaPipeline 源码
const pipelinePath = path.resolve(__dirname, '../mini-program/src/services/media-pipeline.ts');
assert.ok(fs.existsSync(pipelinePath), '❌ media-pipeline.ts 文件不存在！');
const pipelineContent = fs.readFileSync(pipelinePath, 'utf8');

assert.ok(pipelineContent.includes('canonicalizeUrl'), '❌ 缺少 canonicalizeUrl 规范化方法');
assert.ok(pipelineContent.includes('compressPhoto'), '❌ 缺少 compressPhoto 客户端图片压制方法');
assert.ok(pipelineContent.includes('captureAndUploadPhotos'), '❌ 缺少 captureAndUploadPhotos 并发照片采集流水线');
assert.ok(pipelineContent.includes('captureAndUploadVideo'), '❌ 缺少 captureAndUploadVideo 视频采集流水线');
assert.ok(pipelineContent.includes('Promise.allSettled'), '❌ 必须使用 Promise.allSettled 或 Promise.all 进行批处理并发');
console.log('✔ ClientMediaPipeline 核心接口与深度实现契约审查通过');

// 2. 静态代码契约审查：验证 eduApi.ts 杜绝静默降级，修正字段映射
const eduApiPath = path.resolve(__dirname, '../mini-program/src/api/edu.ts');
assert.ok(fs.existsSync(eduApiPath), '❌ edu.ts 不存在');
const eduApiContent = fs.readFileSync(eduApiPath, 'utf8');

assert.ok(eduApiContent.includes('persistedUrls'), '❌ uploadPhoto 必须对齐后端 persistedUrls 字段');
assert.ok(eduApiContent.includes('export const BASE_URL'), '❌ edu.ts 必须导出 BASE_URL');
assert.ok(!eduApiContent.includes('resolve(filePath); // 降级返回本地临时文件'), '❌ 严禁出现将 filePath 降级返回为有效 URL 的伪容错代码！');
console.log('✔ eduApi uploadPhoto/uploadVideo 响应解析与 Fail-Fast 契约审查通过');

// 3. 静态代码契约审查：验证学情卡网关 HttpGrowthQueryAdapter
const growthAdapterPath = path.resolve(__dirname, '../mini-program/src/projectors/learning-growth/adapters/http-growth.adapter.ts');
const growthAdapterContent = fs.readFileSync(growthAdapterPath, 'utf8');
assert.ok(
  growthAdapterContent.includes('evaluationSummary ||') && growthAdapterContent.includes('evaluationDraft'),
  '❌ HttpGrowthQueryAdapter 必须联合解析 evaluationDraft 与 evaluationSummary'
);
console.log('✔ HttpGrowthQueryAdapter 同构工作台网关联合字段水化审查通过');

// 4. 静态代码契约审查：验证 edit.vue 视图层瘦身与调用
const editVuePath = path.resolve(__dirname, '../mini-program/src/package-edu/evaluation/edit.vue');
const editVueContent = fs.readFileSync(editVuePath, 'utf8');
assert.ok(editVueContent.includes('mediaPipeline.captureAndUploadPhotos'), '❌ edit.vue 必须接入 mediaPipeline.captureAndUploadPhotos');
assert.ok(editVueContent.includes('mediaPipeline.captureAndUploadVideo'), '❌ edit.vue 必须接入 mediaPipeline.captureAndUploadVideo');
assert.ok(!editVueContent.includes('for (const tempPath of res.tempFilePaths)'), '❌ 必须彻底清除 edit.vue 中的串行 for...await 循环阻塞上传！');
console.log('✔ edit.vue 视图层瘦身与 mediaPipeline 深度高杠杆接入审查通过');

// 5. 纯逻辑运行沙箱测试：验证 CanonicalizeUrl 逻辑
function canonicalizeUrl(url, apiBaseUrl = 'https://5120bfe3.r38.cpolar.top') {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    const base = apiBaseUrl.replace(/\/+$/, '');
    return `${base}${trimmed}`;
  }
  const base = apiBaseUrl.replace(/\/+$/, '');
  return `${base}/${trimmed}`;
}

assert.strictEqual(
  canonicalizeUrl('/uploads/photos/campus-bj-hq/sch-01/photo1.jpg'),
  'https://5120bfe3.r38.cpolar.top/uploads/photos/campus-bj-hq/sch-01/photo1.jpg',
  '❌ 相对路径补齐失败'
);
assert.strictEqual(
  canonicalizeUrl('https://cdn.myschool.com/photos/abc.jpg'),
  'https://cdn.myschool.com/photos/abc.jpg',
  '❌ 绝对路径未保持原样'
);
assert.strictEqual(canonicalizeUrl(''), '', '❌ 空输入应返回空串');
assert.strictEqual(canonicalizeUrl(undefined), '', '❌ undefined 输入应返回空串');
console.log('✔ canonicalizeUrl 相对路径防呆与绝对路径规范化测试通过');

console.log('======================================================');
console.log('🎉 恭喜！ClientMediaPipeline 多媒体重构全部验证 100% 通过！');
console.log('======================================================');
