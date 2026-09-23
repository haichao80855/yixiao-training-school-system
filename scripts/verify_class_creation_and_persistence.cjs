const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../walkthrough_screenshots/class_creation_fix');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 启动 Chrome 自动化验证【新设班级主讲老师关联组织架构专职教师、固定教室快捷新建、新增班级刷新持久化】完整链路...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', msg => console.log('  [Browser Console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('  [Browser PageError]', err.message));

  try {
    // =========================================================================
    // 步骤 1：访问【班级与班容】页面
    // =========================================================================
    console.log('📍 步骤 1：访问班级与班容页面 http://localhost:5173/educational/classManagement ...');
    await page.goto('http://localhost:5173/educational/classManagement', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // 截屏 1：班级管理页面与操作栏（展示【🏛️ 教室管理】与【+ 新设教学班级】）
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_class_management_page_and_header.png') });

    const step1Info = await page.evaluate(() => ({
      campusId: localStorage.getItem('yixiao_current_campus_id'),
      rowCount: document.querySelectorAll('.el-table__row').length,
      pageText: document.querySelector('.bg-white')?.textContent?.slice(0, 150)
    }));
    console.log('  步骤 1 页面初始数据状态:', step1Info);

    // =========================================================================
    // 步骤 2：点击【+ 新设教学班级】打开弹窗
    // =========================================================================
    console.log('📍 步骤 2：点击【+ 新设教学班级】按钮...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('新设教学班级'));
      if (!btn) throw new Error('未找到【+ 新设教学班级】按钮');
      btn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // =========================================================================
    // 步骤 3：【核心缺陷 1 验证】主讲老师下拉框是否来自组织架构的专职主讲教师
    // =========================================================================
    console.log('📍 步骤 3：【核心缺陷 1 验证】展开【主讲老师】下拉框，核验组织架构中的专职主讲教师...');
    // 点击主讲老师下拉框
    await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const formItems = Array.from(dialog.querySelectorAll('.el-form-item'));
      const teacherItem = formItems.find(item => item.textContent && item.textContent.includes('主讲老师'));
      if (!teacherItem) throw new Error('未找到主讲老师表单项');
      const select = teacherItem.querySelector('.el-select');
      if (select) select.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // 获取并检索当前激活下拉框的下拉项
    const teacherOptions = await page.evaluate(() => {
      // 优先从特定 popper-class 检索，若无则取顶层 popper
      let topPopper = document.querySelector('.class-form-teacher-popper');
      if (!topPopper) {
        const poppers = Array.from(document.querySelectorAll('.el-popper, .el-select__popper'))
          .filter(p => {
            const style = window.getComputedStyle(p);
            return style.display !== 'none' && style.visibility !== 'hidden' && p.offsetHeight > 0;
          });
        topPopper = poppers[poppers.length - 1] || document;
      }
      const options = Array.from(topPopper.querySelectorAll('.el-select-dropdown__item'));
      const texts = options.map(o => o.textContent ? o.textContent.trim() : '');
      
      // 寻找系统设置组织架构中的专职主讲教师（如赵立鹏、张老师等）
      const zhaolp = options.find(o => o.textContent && o.textContent.includes('赵立鹏'));
      const zhangls = options.find(o => o.textContent && o.textContent.includes('张老师'));
      
      // 在当前弹窗的 Popper 内点击选中赵立鹏
      if (zhaolp) {
        zhaolp.click();
      } else if (zhangls) {
        zhangls.click();
      }

      return {
        count: options.length,
        hasZhaolp: !!zhaolp,
        hasZhangls: !!zhangls,
        firstFew: texts.slice(0, 8)
      };
    });

    console.log('  主讲老师下拉框检索结果:', teacherOptions);
    if (!teacherOptions.hasZhaolp && !teacherOptions.hasZhangls) {
      throw new Error('❌ 缺陷 1 未修复：主讲老师下拉框中未包含系统组织架构中的【少儿编程专职主讲教师】（赵立鹏 / 张老师）！');
    }
    console.log('  ✅ 缺陷 1 彻底修复：主讲老师已成功与系统组织架构在职专职主讲教师实现贯通联动！');
    await new Promise(r => setTimeout(r, 600));

    // =========================================================================
    // 步骤 4：【核心缺陷 2 验证】固定教室旁边点击【+ 新增教室】创建并选用新教室
    // =========================================================================
    console.log('📍 步骤 4：【核心缺陷 2 验证】核验【+ 新增教室】按钮并点击呼出新建教室弹窗...');
    const hasAddRoomBtn = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog');
      const btns = Array.from(dialog.querySelectorAll('button'));
      const addRoomBtn = btns.find(b => b.textContent && b.textContent.includes('新增教室'));
      if (addRoomBtn) {
        addRoomBtn.click();
        return true;
      }
      return false;
    });

    if (!hasAddRoomBtn) {
      throw new Error('❌ 缺陷 2 未修复：未找到【+ 新增教室】快捷创建按钮！');
    }
    console.log('  ✅ 找到【+ 新增教室】按钮并成功唤起新建教室弹窗！');
    await new Promise(r => setTimeout(r, 600));

    // 在快捷新建教室弹窗中输入教室信息
    const testRoomName = '创新AI实战机房9号';
    console.log(`📍 步骤 5：录入新教室名称【${testRoomName}】并点击【确认创建并选用】...`);
    
    // 聚焦输入框并键入
    const roomInput = await page.$('.el-dialog input[placeholder*="创新AI机房"]');
    if (!roomInput) throw new Error('未找到新建教室弹窗中的教室名称输入框');
    await roomInput.click({ clickCount: 3 });
    await roomInput.type(testRoomName, { delay: 30 });
    await new Promise(r => setTimeout(r, 400));

    // 点击确认创建并选用按钮
    await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('.el-dialog'));
      const roomDialog = dialogs.find(d => d.textContent && d.textContent.includes('快速新建教学教室'));
      if (!roomDialog) throw new Error('未找到新建教室弹窗');
      const submitBtn = Array.from(roomDialog.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('确认创建并选用'));
      if (!submitBtn) throw new Error('未找到【确认创建并选用】按钮');
      submitBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 检查固定教室与容量是否已自动联动选中该新建教室
    const roomAudit = await page.evaluate((roomName) => {
      const allText = document.body.textContent || '';
      const dialog = document.querySelector('.el-dialog');
      const dialogText = dialog ? dialog.textContent : '';
      return {
        hasNewRoom: allText.includes(roomName) || dialogText.includes(roomName)
      };
    }, testRoomName);
    console.log('  固定教室选用与容量联动状态:', roomAudit);
    if (!roomAudit.hasNewRoom) {
      throw new Error(`❌ 新建教室后，固定教室输入框未能自动选用【${testRoomName}】！`);
    }
    console.log('  ✅ 缺陷 2 彻底修复：已成功快速新建教室并自动关联为班级固定教室！');

    // =========================================================================
    // 步骤 6：录入班级名称并提交创建班级
    // =========================================================================
    const testClassName = '2026算法集训高阶1班';
    const rowsBeforeStep6 = await page.evaluate(() => document.querySelectorAll('.el-table__row').length);
    console.log('  步骤 6 录入前表格行数:', rowsBeforeStep6);

    // 聚焦班级名称输入框并键入
    const classInput = await page.$('.el-dialog input[placeholder*="Scratch创意周末班"]');
    if (!classInput) throw new Error('未找到班级名称输入框！');
    await classInput.click({ clickCount: 3 });
    await classInput.type(testClassName, { delay: 30 });
    await new Promise(r => setTimeout(r, 600));

    // 截屏 2：新设班级表单中成功展示组织架构主讲老师与新建教室
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_class_form_teacher_and_new_room_selected.png') });

    // 点击弹窗标题以让输入框和下拉框失焦
    const titleEl = await page.$('.el-dialog__title');
    if (titleEl) await titleEl.click();
    await new Promise(r => setTimeout(r, 400));

    // 使用 evaluate 真实派发 click 事件
    const clickReport = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('.el-dialog'));
      const classDialog = dialogs.find(d => d.textContent && d.textContent.includes('新设教学班级'));
      if (!classDialog) return { success: false, reason: '未找到新设教学班级弹窗' };
      const btns = Array.from(classDialog.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent && b.textContent.includes('确认创建'));
      if (!submitBtn) return { success: false, reason: '未找到确认创建按钮', allBtns: btns.map(b => b.textContent) };
      submitBtn.click();
      return { success: true, text: submitBtn.textContent, disabled: submitBtn.disabled };
    });
    console.log('  点击确认创建按钮操作结果:', clickReport);
    await new Promise(r => setTimeout(r, 2000));

    // 检查是否有表单校验错误、弹窗状态以及表格内容
    const diagnoseInfo = await page.evaluate((className) => {
      const dialogs = Array.from(document.querySelectorAll('.el-dialog'));
      const errors = Array.from(document.querySelectorAll('.el-form-item__error')).map(e => e.textContent ? e.textContent.trim() : '');
      const rows = Array.from(document.querySelectorAll('.el-table__row'));
      const allText = document.body.textContent || '';
      return {
        dialogCount: dialogs.length,
        errors,
        rowCount: rows.length,
        hasClassNameInBody: allText.includes(className),
        firstRowText: rows[0] ? rows[0].textContent.trim() : ''
      };
    }, testClassName);
    console.log('  建班后页面诊断信息:', diagnoseInfo);

    if (!diagnoseInfo.hasClassNameInBody) {
      throw new Error(`创建班级后，页面未能找到刚刚新建的班级【${testClassName}】！`);
    }
    console.log('  ✅ 班级即时创建入库成功！');

    // =========================================================================
    // 步骤 7：【核心缺陷 3 验证】真实 F5 刷新页面后核验班级持久化
    // =========================================================================
    console.log('📍 步骤 7：【核心缺陷 3 验证】模拟真实浏览器刷新 (page.reload)，核验新增班级持久化留存...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const checkAfterReload = await page.evaluate((className) => {
      const rows = Array.from(document.querySelectorAll('.el-table__row'));
      const firstRow = rows[0] ? rows[0].textContent.trim() : '';
      const anyRow = rows.find(r => r.textContent && r.textContent.includes(className));
      return {
        inFirstRow: firstRow.includes(className),
        foundInAnyRow: !!anyRow,
        firstRowText: firstRow.substring(0, 150)
      };
    }, testClassName);

    console.log('  刷新后班级数据检测结果:', checkAfterReload);
    if (!checkAfterReload.foundInAnyRow) {
      throw new Error(`❌ 缺陷 3 复现：刷新页面后，新增的教学班级【${testClassName}】消失了！`);
    }
    console.log('  ✅ 缺陷 3 彻底修复：页面刷新后，新增教学班级完整持久化完好无损！');

    // 截屏 3：刷新页面后班级依然在首行
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_reloaded_persisted_new_class.png') });

    console.log('\n🎉 [PASS] 主讲老师关联组织架构、固定教室快捷新建、新增班级刷新持久化 3 大缺陷 100% 修复并验证通过！');
  } catch (err) {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
