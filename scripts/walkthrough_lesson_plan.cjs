const puppeteer = require("puppeteer-core");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function run() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: "new",
        defaultViewport: { width: 1440, height: 900 },
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    const networkRequests = [];
    const consoleLogs = [];

    page.on("request", req => {
        const url = req.url();
        if (!url.endsWith(".js") && !url.endsWith(".css") && !url.endsWith(".png") && !url.endsWith(".svg") && !url.endsWith(".woff2")) {
            networkRequests.push({ method: req.method(), url });
        }
    });

    page.on("console", msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    console.log("=== 1. 访问页面 ===");
    await page.goto("http://39.107.33.4/curriculum/lessonPlan", { waitUntil: "networkidle2" });

    // Helper to get all ElMessage texts currently visible
    async function getMessages() {
        return await page.$$eval(".el-message__content", els => els.map(e => e.innerText));
    }

    console.log("=== 2. 点击「一键打包下载课件」===");
    networkRequests.length = 0;
    const batchBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("一键打包下载课件"));
    });
    if (batchBtn) {
        await batchBtn.click();
        await sleep(600);
        console.log("Message after batch download:", await getMessages());
        console.log("Network requests triggered:", networkRequests);
    }
    await page.screenshot({ path: "/tmp/step2_batch_download.png" });

    console.log("=== 3. 点击「导出单元大纲」===");
    networkRequests.length = 0;
    const exportBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("导出单元大纲"));
    });
    if (exportBtn) {
        await exportBtn.click();
        await sleep(600);
        console.log("Message after export unit:", await getMessages());
        console.log("Network requests triggered:", networkRequests);
    }

    console.log("=== 4. 点击课次操作按钮：PPT课件、代码工程 ===");
    networkRequests.length = 0;
    const pptBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("PPT课件"));
    });
    if (pptBtn) {
        await pptBtn.click();
        await sleep(600);
        console.log("Message after PPT click:", await getMessages());
    }

    const codeBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("代码工程"));
    });
    if (codeBtn) {
        await codeBtn.click();
        await sleep(600);
        console.log("Message after Code click:", await getMessages());
    }
    console.log("Network requests for PPT/Code download:", networkRequests);

    console.log("=== 5. 点击「在线白板」===");
    const whiteboardBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("在线白板"));
    });
    if (whiteboardBtn) {
        await whiteboardBtn.click();
        await sleep(1000);
        const dialogTitle = await page.$eval(".courseware-player-dialog .el-dialog__title", el => el.innerText).catch(() => "None");
        const iframeSrc = await page.$eval(".courseware-player-dialog iframe", el => el.src).catch(() => "None");
        const lessonName = await page.$eval(".courseware-player-dialog span.text-sm", el => el.innerText).catch(() => "None");
        console.log("Whiteboard Dialog Title:", dialogTitle);
        console.log("Lesson Name in Dialog:", lessonName);
        console.log("Iframe src:", iframeSrc);
        await page.screenshot({ path: "/tmp/step5_whiteboard.png" });

        // Close dialog
        const closeBtn = await page.$(".courseware-player-dialog .el-dialog__headerbtn");
        if (closeBtn) await closeBtn.click();
        await sleep(500);
    }

    console.log("=== 6. 点击「+ 录入课时大纲」并保存发布 ===");
    networkRequests.length = 0;
    const addBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find(b => b.innerText.includes("录入课时大纲"));
    });
    if (addBtn) {
        await addBtn.click();
        await sleep(600);
        await page.screenshot({ path: "/tmp/step6_add_dialog.png" });

        // Change lesson name
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll(".el-dialog input"));
            const lessonInput = inputs.find(i => i.placeholder && i.placeholder.includes("变量与基本运算"));
            if (lessonInput) {
                lessonInput.value = "【自动化测试】第 99 讲：自定义测试实战课";
                lessonInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });

        // Click save button
        const saveBtn = await page.evaluateHandle(() => {
            const btns = Array.from(document.querySelectorAll(".el-dialog button"));
            return btns.find(b => b.innerText.includes("保存并发布"));
        });
        if (saveBtn) {
            await saveBtn.click();
            await sleep(800);
            console.log("Message after save:", await getMessages());
            console.log("Network requests during save:", networkRequests);
        }

        // Check if the lesson appeared in the upper tree
        const treeLessons = await page.$$eval(".divide-y .text-sm.font-bold", els => els.map(e => e.innerText));
        console.log("Lessons in upper tree after save:", treeLessons);
        const inTree = treeLessons.some(t => t.includes("自定义测试实战课"));
        console.log("Did new lesson appear in upper tree?", inTree);

        // Check if the lesson appeared in bottom table
        const tableLessons = await page.$$eval(".el-table__body tr", els => els.map(e => e.innerText.split("\t")[0]));
        console.log("First item in bottom table:", tableLessons[0]);
        await page.screenshot({ path: "/tmp/step6_after_save.png" });

        // Test persistence: F5 reload
        console.log("--- F5 刷新页面检查数据持久化 ---");
        await page.reload({ waitUntil: "networkidle2" });
        await sleep(600);
        const tableLessonsAfterReload = await page.$$eval(".el-table__body tr", els => els.map(e => e.innerText.split("\t")[0]));
        console.log("First item in bottom table after reload:", tableLessonsAfterReload[0]);
        const persisted = tableLessonsAfterReload.some(t => t && t.includes("自定义测试实战课"));
        console.log("Did new lesson persist after reload?", persisted);
    }

    console.log("=== 7. 测试顶部筛选栏与搜索联动 ===");
    // Filter by code type "Python"
    const pythonRadio = await page.evaluateHandle(() => {
        const labels = Array.from(document.querySelectorAll(".el-radio-button"));
        return labels.find(l => l.innerText.trim() === "Python");
    });
    if (pythonRadio) {
        await pythonRadio.click();
        await sleep(500);
        const upperTreeText = await page.$$eval(".divide-y .text-sm.font-bold", els => els.map(e => e.innerText));
        console.log("Upper tree lessons when 'Python' radio selected:", upperTreeText);
    }

    // Type keyword "海底世界" in search box
    await page.evaluate(() => {
        const input = document.querySelector("input[placeholder*='搜索课次名称']");
        if (input) {
            input.value = "海底世界";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
    await sleep(500);
    const upperUnitsAfterSearch = await page.$$eval(".divide-y .text-sm.font-bold", els => els.map(e => e.innerText));
    console.log("Upper tree lessons after searching '海底世界':", upperUnitsAfterSearch);
    await page.screenshot({ path: "/tmp/step7_search_mismatch.png" });

    console.log("=== 8. 测试底部表格下载操作与次数累加 ===");
    const initialDownloads = await page.$eval(".el-table__body tr:first-child .text-emerald-600", el => el.innerText).catch(() => "0");
    console.log("Initial download count for first row:", initialDownloads);
    const rowDownloadBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll(".el-table__body tr:first-child button"));
        return btns.find(b => b.innerText.includes("下载"));
    });
    if (rowDownloadBtn) {
        await rowDownloadBtn.click();
        await sleep(600);
        const afterDownloads = await page.$eval(".el-table__body tr:first-child .text-emerald-600", el => el.innerText).catch(() => "0");
        console.log("Download count after click:", afterDownloads);
        console.log("Did download count increment?", initialDownloads !== afterDownloads);
    }

    console.log("\n=== 控制台捕获的警告与错误 ===");
    consoleLogs.filter(l => l.type === "error" || l.type === "warning").forEach(l => console.log(`[${l.type}] ${l.text}`));

    await browser.close();
}

run().catch(console.error);
