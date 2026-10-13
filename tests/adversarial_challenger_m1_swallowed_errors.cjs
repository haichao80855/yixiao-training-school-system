/**
 * 对抗性检验脚本：视图层假双写与静默吞噬后端异常扫描
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 检查 catch 吞噬后调用 Mock 或显示成功
    if (line.includes('catch (apiErr)') || line.includes('catch {') || line.includes('.catch(() => {})')) {
      // 检查后续 15 行内是否有 ElMessage.success 或 内存 mock 写入
      const windowLines = lines.slice(i, Math.min(lines.length, i + 15)).join('\n');
      if (
        (windowLines.includes('ElMessage.success') ||
         windowLines.includes('addClass') ||
         windowLines.includes('updateClass') ||
         windowLines.includes('submitRollCall') ||
         windowLines.includes('deleteScheduleEvent') ||
         windowLines.includes('addScheduleEvent')) &&
        !windowLines.includes('throw ')
      ) {
        if (!line.includes('// 弹窗取消') && !windowLines.includes('// 弹窗取消') && !windowLines.includes('// cancelled')) {
          violations.push({
            line: i + 1,
            snippet: line.trim(),
            context: windowLines
          });
        }
      }
    }
    if (line.includes("'学员 ' +") || line.includes('"学员 " +') || line.includes('盛通未来学院附小')) {
      violations.push({
        line: i + 1,
        snippet: line.trim(),
        context: line.trim()
      });
    }
  }

  return violations;
}

function getAllVueFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllVueFiles(full));
    } else if (file.endsWith('.vue')) {
      results.push(full);
    }
  }
  return results.sort();
}

const viewsDir = path.resolve(__dirname, '../src/views');
const targetFiles = getAllVueFiles(viewsDir);

console.log('=== 对抗性实测: 全量扫描业务视图假双写与吞噬后端异常缺陷 (全量 41 个组件) ===\n');

let totalViolations = 0;
for (const fullPath of targetFiles) {
  const relPath = path.relative(path.resolve(__dirname, '..'), fullPath);
  const violations = scanFile(fullPath);
  if (violations.length > 0) {
    console.log(`❌ 发现违规文件: ${relPath} (共 ${violations.length} 处违规):`);
    violations.forEach(v => {
      console.log(`   - 第 ${v.line} 行: ${v.snippet}`);
    });
    totalViolations += violations.length;
  } else {
    console.log(`✅ 文件无吞噬假写: ${relPath}`);
  }
}

console.log(`\n总计发现 ${totalViolations} 处假双写/吞噬异常违规！`);
if (totalViolations > 0) {
  console.log('结论: 存在假双写与异常吞噬缺陷，未能完全达成 Acceptance Criteria 2！');
}
