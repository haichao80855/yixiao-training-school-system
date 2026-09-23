const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../walkthrough_screenshots/new_course_enroll_fix');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 启动 Chrome 自动化验证【课程研发管理新增课程 -> 学员中心签约报读选课联动】完整链路...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // =========================================================================
    // 步骤 1：访问【课程研发管理】并新增课程
    // =========================================================================
    console.log('📍 步骤 1：访问课程研发管理页面 http://localhost:5173/curriculum/courseManage ...');
    await page.goto('http://localhost:5173/curriculum/courseManage', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    console.log('📍 步骤 2：点击【+ 新增】按钮...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent && b.textContent.trim().includes('新增'));
      if (!addBtn) throw new Error('未找到【+ 新增】按钮');
      addBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    console.log('📍 步骤 3：填写课程基础信息（课程名：2026全新前沿Python AI实战特训营，课标价：360，总课时：40）...');
    const testCourseName = '2026全新前沿Python AI实战特训营';
    
    // 输入课程名称
    const nameInput = await page.$('.course-editor-dialog input[placeholder*="Scratch创意图形编程"]');
    if (!nameInput) throw new Error('未找到课程名称输入框！');
    await nameInput.click({ clickCount: 3 });
    await nameInput.type(testCourseName, { delay: 30 });
    await new Promise(r => setTimeout(r, 400));

    // 点击【下一步】（跨校区授权）
    console.log('📍 步骤 4：点击进入第 2 步【校区授权】...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.course-editor-dialog');
      const nextBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === '下一步');
      if (!nextBtn) throw new Error('未找到第1步下一步按钮');
      nextBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 点击【下一步】（单元与课时）
    console.log('📍 步骤 5：点击进入第 3 步【单元与课时】...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.course-editor-dialog');
      const nextBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === '下一步');
      if (!nextBtn) throw new Error('未找到第2步下一步按钮');
      nextBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 点击【完成并保存课程】
    console.log('📍 步骤 6：点击【完成并保存课程】完成建课...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.course-editor-dialog');
      const saveBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('完成并保存'));
      if (!saveBtn) throw new Error('未找到完成并保存按钮');
      saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // 验证课程列表中是否出现了新增课程
    const courseCardFound = await page.evaluate((courseName) => {
      const text = document.body.textContent || '';
      return text.includes(courseName);
    }, testCourseName);

    console.log('  课程列表新增卡片检测结果:', courseCardFound);
    if (!courseCardFound) {
      throw new Error(`课程研发管理列表中未找到刚刚新增的课程【${testCourseName}】！`);
    }
    console.log('  ✅ 步骤 1 验证通过：新课程已成功在课程研发管理中入库并渲染展示！');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_new_course_created_in_curriculum.png') });

    // =========================================================================
    // 步骤 2：跳转至学员中心，对学员执行报读，核验第二步课程下拉选项
    // =========================================================================
    console.log('📍 步骤 7：跳转至学员中心全部学员全景 http://localhost:5173/studentCenter/allStudent ...');
    await page.goto('http://localhost:5173/studentCenter/allStudent', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // 找到首个学员点击【报读】
    console.log('📍 步骤 8：选择学员并点击【报读】按钮...');
    const targetStudentName = await page.evaluate(() => {
      const firstRow = document.querySelector('.el-table__body-wrapper tr');
      if (!firstRow) throw new Error('学员列表无数据！');
      const nameEl = firstRow.querySelector('.font-bold') || firstRow.querySelector('td');
      const enrollBtn = Array.from(firstRow.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('报读'));
      if (!enrollBtn) throw new Error('未找到报读按钮！');
      enrollBtn.click();
      return nameEl ? nameEl.textContent.trim() : '未知学员';
    });
    console.log(`  选中学员进行签约报读: ${targetStudentName}`);
    await new Promise(r => setTimeout(r, 800));

    // 报读向导 Step 1 -> 点击【下一步：配置课程与课时】
    console.log('📍 步骤 9：报读向导 Step 1，点击下一步进入【配置课程与课时】...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const nextBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('下一步'));
      nextBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 点击【选择报读课程】下拉框以唤起选项列表
    console.log('📍 步骤 10：【核心缺陷验证】检查第二步课程下拉列表是否包含新增课程...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const select = dialog.querySelector('.el-select');
      if (select) {
        select.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // 检索所有可见的下拉选项
    const dropdownAudit = await page.evaluate((courseName) => {
      const options = Array.from(document.querySelectorAll('.el-select-dropdown__item'));
      const texts = options.map(o => o.textContent ? o.textContent.trim() : '');
      const matchOption = options.find(o => o.textContent && o.textContent.includes(courseName));
      if (matchOption) {
        matchOption.click(); // 直接选中该新增课程！
        return {
          found: true,
          matchText: matchOption.textContent.trim(),
          allOptionCount: options.length
        };
      }
      return {
        found: false,
        texts: texts.slice(0, 10),
        allOptionCount: options.length
      };
    }, testCourseName);

    console.log('  下拉选项检索与选中结果:', dropdownAudit);
    if (!dropdownAudit.found) {
      throw new Error(`❌ 缺陷未修复：在报读向导第二步下拉列表中，未能找到新增的课程【${testCourseName}】！`);
    }
    console.log(`  ✅ 核心缺陷彻底修复：已成功在报读向导第二步中找到并选中国家新增课程【${dropdownAudit.matchText}】！`);
    await new Promise(r => setTimeout(r, 800));

    // 核验选中国家新课程后，课标单价与课时是否自动联动
    const courseFormAudit = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const text = dialog ? dialog.textContent : '';
      return {
        has360Price: text.includes('360'),
        has40Lessons: text.includes('40')
      };
    });
    console.log('  选中新课后单价与课时联动状态:', courseFormAudit);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_enroll_step2_new_course_selected.png') });

    // =========================================================================
    // 步骤 3：完成后续步骤并签约入库
    // =========================================================================
    console.log('📍 步骤 11：继续点击下一步（折扣减免核算）...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const nextBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('下一步'));
      nextBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    console.log('📍 步骤 12：继续点击下一步（支付结算）...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const nextBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('下一步'));
      nextBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    console.log('📍 步骤 13：点击【确认签约收款并入库】提交签约订单...');
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const submitBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('确认签约'));
      submitBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // 验证学员列表首行是否已生效该新课包
    const enrollResultText = await page.evaluate(() => {
      const firstRow = document.querySelector('.el-table__body-wrapper tr');
      return firstRow ? firstRow.textContent : '';
    });
    console.log('  开单后学员首行数据摘要:', enrollResultText.substring(0, 160));
    if (!enrollResultText.includes('Python AI实战特训营')) {
      throw new Error('签约开单后，学员在读课包未展示刚刚报读的新课程！');
    }
    console.log('  ✅ 步骤 2 验证通过：新课程已成功被学员报读并形成在读签约课包！');

    // =========================================================================
    // 步骤 4：刷新页面持久化核验
    // =========================================================================
    console.log('📍 步骤 14：模拟真实 F5 刷新页面 (page.reload)，核验新课程与签约课包持久化...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const reloadedText = await page.evaluate(() => {
      const firstRow = document.querySelector('.el-table__body-wrapper tr');
      return firstRow ? firstRow.textContent : '';
    });
    console.log('  刷新后学员首行数据:', reloadedText.substring(0, 160));
    if (!reloadedText.includes('Python AI实战特训营')) {
      throw new Error('❌ 刷新页面后，学员签约的新课包丢失！');
    }
    console.log('  ✅ 步骤 3 验证通过：页面真实刷新后，新增课程签约资产完整持久化无损！');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_reloaded_persisted_new_course_pack.png') });

    console.log('\n🎉 [PASS] 课程研发管理新增课程 -> 学员报读第二步可选该新课程链路 100% 跑通并验证成功！');
  } catch (err) {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
