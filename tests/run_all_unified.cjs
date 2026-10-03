/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」全栈一体化自动化测试守护运行器
 * 自动管理 NestJS 服务端生命周期，串行穿透 Dual-Track 与全栈 E2E 测试
 * ==============================================================================
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}`, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('================================================================================');
  console.log('🚀 拓视未来教育「一校教培系统」一体化全流程自动化测试套件执行');
  console.log('================================================================================\n');

  // 1. 运行双轨逻辑测试 (Tier 1 ~ Tier 4, 287 项用例)
  console.log('>>> [Step 1/3] 执行 Tier 1 ~ Tier 4 分层业务用例...\n');
  try {
    execSync('node tests/runner.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  } catch (e) {
    console.error('❌ 双轨分层测试未通过！');
    process.exit(1);
  }

  // 2. 检查或拉起 NestJS 服务端
  let serverProcess = null;
  const isServerRunning = await checkPort(3001);

  if (!isServerRunning) {
    console.log('\n>>> [Step 2/3] 检测到后端微服务未运行，正在启动 Node.js NestJS 服务进程...');
    serverProcess = spawn('node', ['dist/main.js'], {
      cwd: path.resolve(__dirname, '../server'),
      stdio: 'pipe',
    });

    let ready = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (await checkPort(3001)) {
        ready = true;
        console.log('✓ NestJS 服务端已成功就绪 (http://127.0.0.1:3001)\n');
        break;
      }
    }

    if (!ready) {
      console.error('❌ NestJS 服务端未能在 10 秒内启动就绪！');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('\n>>> [Step 2/3] 检测到后端微服务已在运行 (http://127.0.0.1:3001)');
  }

  // 3. 运行全栈 E2E 与后端全领域集成测试
  console.log('\n>>> [Step 3/3] 运行全栈端到端业务闭环穿透测试与后端各领域套件...\n');
  let testError = null;

  try {
    // 运行全栈穿透测试
    execSync('node tests/e2e_full_stack_integration.cjs', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });

    // 运行后端模块领域测试
    const serverDir = path.resolve(__dirname, '../server');
    execSync('node test-auth-and-system.js', { stdio: 'inherit', cwd: serverDir });
    execSync('node test-curriculum-and-student.js', { stdio: 'inherit', cwd: serverDir });
    execSync('node test-educational-and-attendance.js', { stdio: 'inherit', cwd: serverDir });
    execSync('node test-financial-and-approval.js', { stdio: 'inherit', cwd: serverDir });

    console.log('\n================================================================================');
    console.log('🏆 恭喜！全栈端到端、双轨分层与后端微服务所有测试断言 100% 全部通过！');
    console.log('================================================================================\n');
  } catch (err) {
    testError = err;
    console.error('❌ 测试执行过程中捕获失败断言:', err.message);
  } finally {
    if (serverProcess) {
      console.log('[Cleanup] 正常关闭测试用守护后端进程...');
      serverProcess.kill('SIGTERM');
    }
  }

  if (testError) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
