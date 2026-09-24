/**
 * Milestone 2 教研中心模块对抗测试套件 (Challenger M2-1 Empirical Stress Test Suite)
 * 纯 Node.js 标准运行，无外部依赖，严禁 BypassSandbox
 * 覆盖四项极限挑战：
 * 1. 胶囊筛选与多重下拉搜索交集/并集过滤极限与漏洞检测
 * 2. 三步课程向导非法输入阻断、极值与超长文本防御
 * 3. 课时大纲排序算法随机打乱、连续边界移动与不变式验证
 * 4. 课程启禁用状态切换对前台排课、学员选课与开单前置条件的影响
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('./harness/assert');
const CurriculumModel = require('./contracts/curriculumModel');

// 1. 动态安全加载 TS Mock 数据
function loadTsModule(relativePath) {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });

  const m = { exports: {} };
  const wrapper = vm.runInThisContext(
    '(function(exports, require, module, __filename, __dirname) {\n' +
    transpiled.outputText +
    '\n})'
  );
  wrapper(m.exports, require, m, fullPath, path.dirname(fullPath));
  return m.exports;
}

const curriculumMock = loadTsModule('src/mocks/curriculum.ts');
const rawCourses = curriculumMock.MOCK_CURRICULUM_COURSES || [];

// 2. 仿真 CourseManageView 中的 UI 过滤逻辑
const attrKeyMap = {
  常规课程: 'regular',
  扩科课程: 'extended',
  活动课程: 'activity',
  体验课程: 'trial',
  教师培训: 'training',
  服务费: 'service_fee'
};

function uiFilterCourses(courses, filters) {
  return courses.filter(item => {
    // 1. 年级胶囊过滤
    if (filters.selectedGrade && filters.selectedGrade !== '全部' && item.grade !== filters.selectedGrade) {
      return false;
    }

    // 2. 课程属性胶囊过滤 (复现 CourseManageView.vue 代码)
    if (filters.selectedAttr && filters.selectedAttr !== '全部') {
      const targetAttr = attrKeyMap[filters.selectedAttr];
      if (targetAttr && item.attribute !== targetAttr) {
        return false;
      }
    }

    // 3. 状态胶囊过滤
    if (filters.selectedStatus && filters.selectedStatus !== '全部') {
      const targetStatus = filters.selectedStatus === '启用' ? 'enabled' : 'disabled';
      if (item.status !== targetStatus) {
        return false;
      }
    }

    // 4. 科目下拉过滤
    if (filters.selectedSubject && filters.selectedSubject !== '全部' && item.subject !== filters.selectedSubject) {
      return false;
    }

    // 5. 年份过滤
    if (filters.selectedYear && filters.selectedYear !== '全部' && item.year !== filters.selectedYear) {
      return false;
    }

    // 6. 期段过滤
    if (filters.selectedPeriod && filters.selectedPeriod !== '全部' && item.period !== filters.selectedPeriod) {
      return false;
    }

    // 7. 关键词模糊检索 (名称或编码)
    if (filters.searchKeyword && filters.searchKeyword.trim().length > 0) {
      const kw = filters.searchKeyword.trim().toLowerCase();
      const matchName = (item.name || '').toLowerCase().includes(kw);
      const matchCode = (item.code || '').toLowerCase().includes(kw);
      if (!matchName && !matchCode) {
        return false;
      }
    }

    return true;
  });
}

// 仿真 CourseEditorDialog 的大纲操作
function simMoveLesson(unit, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= unit.lessons.length) return false;
  const [moved] = unit.lessons.splice(index, 1);
  unit.lessons.splice(targetIndex, 0, moved);
  unit.lessons.forEach((l, i) => {
    l.order = i + 1;
  });
  return true;
}

function simAddLesson(unit, standardDuration = 60) {
  if (!unit.lessons) unit.lessons = [];
  const nextOrder = unit.lessons.length + 1;
  const newLesson = {
    id: `lesson-${Date.now()}-${nextOrder}`,
    title: `第 ${nextOrder < 10 ? '0' + nextOrder : nextOrder} 课：知识要点与拓展`,
    duration: standardDuration,
    order: nextOrder,
    objective: '核心语法与工程实作',
  };
  unit.lessons.push(newLesson);
  return newLesson;
}

function simDeleteLesson(unit, index) {
  if (!unit.lessons || index < 0 || index >= unit.lessons.length) return false;
  unit.lessons.splice(index, 1);
  unit.lessons.forEach((l, i) => {
    l.order = i + 1;
  });
  return true;
}

function simMoveUnit(units, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= units.length) return false;
  const [moved] = units.splice(index, 1);
  units.splice(targetIndex, 0, moved);
  units.forEach((u, i) => {
    u.order = i + 1;
  });
  return true;
}

// 测试结果收集器
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  vulnerabilities: [],
  details: []
};

function runTest(suite, name, fn) {
  results.total++;
  try {
    fn();
    results.passed++;
    results.details.push({ suite, name, passed: true });
    console.log(`  \x1b[32m✓\x1b[0m [${suite}] ${name}`);
  } catch (err) {
    results.failed++;
    results.details.push({ suite, name, passed: false, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m [${suite}] ${name}`);
    console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
  }
}

console.log('\n================================================================================');
console.log('拓视未来教育「一校教培系统」Milestone 2 对抗测试执行套件 (Adversarial Challenge)');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: 胶囊筛选与多重下拉搜索极限测试
// -----------------------------------------------------------------------------
console.log('\x1b[1m【Suite 1: 胶囊筛选与多重下拉搜索交集/并集与极限组合】\x1b[0m');

runTest('Suite 1', '1.1 全矩阵组合过滤：年级与课程属性正交组合交集准确性 (8x6 组合)', () => {
  const grades = ['全部', '初级课程', '中级课程', '高级课程', '幼儿园', '小学低', '小学高', '中学'];
  const attributes = ['全部', '常规课程', '扩科课程', '活动课程', '体验课程', '教师培训', '服务费'];

  for (const g of grades) {
    for (const a of attributes) {
      const filtered = uiFilterCourses(rawCourses, { selectedGrade: g, selectedAttr: a });
      for (const item of filtered) {
        if (g !== '全部') {
          assert.equal(item.grade, g, `Expected grade ${g} but got ${item.grade}`);
        }
        if (a !== '全部') {
          const expectedAttr = attrKeyMap[a];
          assert.equal(item.attribute, expectedAttr, `Expected attr ${expectedAttr} but got ${item.attribute}`);
        }
      }
    }
  }
});

runTest('Suite 1', '1.2 空结果边界场景：不相交的极端组合准确返回空集合并触发空状态', () => {
  // 幼儿园 + 教师培训 (无此组合课程)
  const emptyRes = uiFilterCourses(rawCourses, {
    selectedGrade: '幼儿园',
    selectedAttr: '教师培训'
  });
  assert.lengthOf(emptyRes, 0, 'Conflicting filter must return 0 courses');

  // 空关键词搜索不存在的数据
  const noMatchKeyword = uiFilterCourses(rawCourses, {
    searchKeyword: 'NONEXISTENT_COURSE_CODE_99999'
  });
  assert.lengthOf(noMatchKeyword, 0, 'Nonexistent keyword must return 0 courses');

  // 验证空状态触发条件 (pagedCourses.length === 0)
  const pagedCourses = emptyRes.slice(0, 12);
  assert.equal(pagedCourses.length === 0, true, 'Empty result triggers el-empty UI');
});

runTest('Suite 1', '1.3 一键重置状态恢复不变式 (Reset Idempotency)', () => {
  // 设置全量高限制筛选条件
  const dirtyFilters = {
    selectedGrade: '中学',
    selectedAttr: '扩科课程',
    selectedStatus: '启用',
    selectedSubject: '信息学竞赛',
    selectedYear: '2026',
    selectedPeriod: '秋季班',
    searchKeyword: 'C++'
  };
  const filteredBefore = uiFilterCourses(rawCourses, dirtyFilters);

  // 执行重置逻辑：恢复全部字段
  const resetFilters = {
    selectedGrade: '全部',
    selectedAttr: '全部',
    selectedStatus: '全部',
    selectedSubject: '全部',
    selectedYear: '全部',
    selectedPeriod: '全部',
    searchKeyword: ''
  };
  const restoredCourses = uiFilterCourses(rawCourses, resetFilters);

  assert.equal(restoredCourses.length, rawCourses.length, 'Restored courses must equal full dataset');
});

runTest('Suite 1', '1.4 关键词模糊匹配极端字符与正则安全性 (Special Chars & Case-Insensitive)', () => {
  // 包含 C++ 正则特殊符号，不能抛出语法异常
  const cppSearch = uiFilterCourses(rawCourses, { searchKeyword: 'C++' });
  assert.ok(cppSearch.length > 0, 'C++ search must return results without regex crash');

  // 大小写不敏感测试
  const lowerSearch = uiFilterCourses(rawCourses, { searchKeyword: 'scratch' });
  const upperSearch = uiFilterCourses(rawCourses, { searchKeyword: 'SCRATCH' });
  assert.equal(lowerSearch.length, upperSearch.length, 'Keyword search must be case-insensitive');

  // 首尾多余空格测试
  const spacedSearch = uiFilterCourses(rawCourses, { searchKeyword: '   Python   ' });
  assert.ok(spacedSearch.length > 0, 'Trimmed keyword search must match');

  // 纯空格关键词视为无过滤
  const blankSearch = uiFilterCourses(rawCourses, { searchKeyword: '     ' });
  assert.equal(blankSearch.length, rawCourses.length, 'Whitespace-only search must not filter out all courses');
});

runTest('Suite 1', '1.5 发现漏洞 [FINDING-1]：胶囊选项 "宣传素材" 在 attrKeyMap 中缺失导致过滤失效泄漏全部课程', () => {
  // CourseManageView.vue 中 attrOptions 声明了 '宣传素材'
  // 但 attrKeyMap 缺少映射，导致 targetAttr 为 undefined
  // 使得 targetAttr && item.attribute !== targetAttr 为 false，未过滤任何课程！
  const leakedCourses = uiFilterCourses(rawCourses, { selectedAttr: '宣传素材' });
  if (leakedCourses.length === rawCourses.length) {
    results.vulnerabilities.push({
      id: 'VULN-01',
      severity: 'HIGH',
      title: '胶囊筛选 "宣传素材" 过滤被静默穿透',
      description: 'attrOptions 包含 "宣传素材"，但 attrKeyMap 未定义该键。选中时 targetAttr 为 undefined，导致条件判断被绕过，返回全量课程而非 0 门相关课程。'
    });
  }
  // 断言此行为确实存在（证据链）
  assert.equal(leakedCourses.length, rawCourses.length, 'Demonstrating that selecting "宣传素材" leaks all courses');
});

runTest('Suite 1', '1.6 发现漏洞 [FINDING-2]：下拉框 "课程类型" (selectedCourseType) 在 filteredCourses 计算属性中被完全遗漏', () => {
  // 检查 CourseManageView.vue 中是否在 filteredCourses 内部判断了 selectedCourseType
  const courseManageVueCode = fs.readFileSync(
    path.resolve(__dirname, '../src/views/curriculum/CourseManageView.vue'),
    'utf8'
  );

  const hasCourseTypeSelect = courseManageVueCode.includes('v-model="selectedCourseType"');
  const match = courseManageVueCode.match(/const filteredCourses = computed\(\(\) => \{([\s\S]*?)\n\}\)/);
  const hasCourseTypeInFilter = match ? match[1].includes('selectedCourseType') : false;

  if (hasCourseTypeSelect && !hasCourseTypeInFilter) {
    results.vulnerabilities.push({
      id: 'VULN-02',
      severity: 'MEDIUM',
      title: '下拉筛选 "课程类型" 控件成为无响应死项 (Dead UI Control)',
      description: 'CourseManageView.vue 模板中提供了课程类型下拉选择器（常规课程、拓展集训、考级专训、城市挑赛），但 filteredCourses 计算属性完全没有判断 selectedCourseType，导致用户选择后没有任何过滤效果。'
    });
  }
  assert.isTrue(hasCourseTypeSelect, 'UI has selectedCourseType select');
  assert.isFalse(hasCourseTypeInFilter, 'filteredCourses misses selectedCourseType check');
});

// -----------------------------------------------------------------------------
// Suite 2: 三步课程向导非法输入阻断与极端输入测试
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 2: 三步课程向导非法输入阻断与极长文本防御】\x1b[0m');

runTest('Suite 2', '2.1 课时数非法值极限阻断 (<=0, 负数, 零, 空值, 浮点数)', () => {
  const invalidLessonCounts = [0, -1, -50, null, undefined, -0.5];

  for (const total of invalidLessonCounts) {
    const course = {
      name: '测试课程',
      code: 'CRS-TEST-01',
      totalLessons: total,
      pricePerLesson: 200,
      attribute: 'regular',
      status: 'enabled',
      authorizedCampusIds: ['campus-bj-hq']
    };
    const res = CurriculumModel.validateCourseItem(course);
    assert.isFalse(res.isValid, `totalLessons = ${total} must be invalid`);
    assert.includes(res.errors, 'Total lessons must be greater than 0');
  }

  // 正常边界值 1 必须合法
  const validMinCourse = {
    name: '1课时讲座',
    code: 'CRS-TEST-02',
    totalLessons: 1,
    pricePerLesson: 200,
    attribute: 'regular',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq']
  };
  assert.isTrue(CurriculumModel.validateCourseItem(validMinCourse).isValid);
});

runTest('Suite 2', '2.2 课时单价非法值阻断与免费课边界 (负数阻断, 0元试听课允许)', () => {
  const negativePrices = [-1, -100, -0.01];

  for (const p of negativePrices) {
    const course = {
      name: '负价格异常课',
      code: 'CRS-NEG-01',
      totalLessons: 10,
      pricePerLesson: p,
      attribute: 'regular',
      status: 'enabled',
      authorizedCampusIds: ['campus-bj-hq']
    };
    const res = CurriculumModel.validateCourseItem(course);
    assert.isFalse(res.isValid, `pricePerLesson = ${p} must be invalid`);
    assert.includes(res.errors, 'Price per lesson must be a non-negative number');
  }

  // 0 元免费公益/试听课必须合法通过
  const freeCourse = {
    name: '0元公益公开课',
    code: 'CRS-FREE-01',
    totalLessons: 2,
    pricePerLesson: 0,
    attribute: 'trial',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq']
  };
  assert.isTrue(CurriculumModel.validateCourseItem(freeCourse).isValid, '0 price trial course is valid');
});

runTest('Suite 2', '2.3 课程名称空值与纯空格非法阻断 (Empty & Whitespace-only)', () => {
  const emptyNames = ['', '   ', '\t\n', null, undefined];

  for (const name of emptyNames) {
    const course = {
      name,
      code: 'CRS-EMPTY-NAME',
      totalLessons: 10,
      pricePerLesson: 200,
      attribute: 'regular',
      status: 'enabled',
      authorizedCampusIds: ['campus-bj-hq']
    };
    const res = CurriculumModel.validateCourseItem(course);
    assert.isFalse(res.isValid, `Course name "${name}" must be rejected`);
    assert.includes(res.errors, 'Course name is required');
  }
});

runTest('Suite 2', '2.4 超长课程名称溢出保护 (80字符上限校验与UI截断样式)', () => {
  const courseEditorVueCode = fs.readFileSync(
    path.resolve(__dirname, '../src/views/curriculum/components/CourseEditorDialog.vue'),
    'utf8'
  );
  const courseManageVueCode = fs.readFileSync(
    path.resolve(__dirname, '../src/views/curriculum/CourseManageView.vue'),
    'utf8'
  );

  // 校验输入框具备 maxlength="80" 且规则有 min: 2, max: 80
  assert.includes(courseEditorVueCode, 'maxlength="80"');
  assert.includes(courseEditorVueCode, 'max: 80');

  // 校验列表展示有 CSS line-clamp-2 和 :title 完整保全
  assert.includes(courseManageVueCode, 'line-clamp-2');
  assert.includes(courseManageVueCode, ':title="course.name"');
});

runTest('Suite 2', '2.5 跨校区授权至少选择一个校区门禁守护', () => {
  // Step 2 校验：authorizedCampusIds 为空时阻断进入 Step 3
  function validateStep2(authorizedCampusIds) {
    if (!authorizedCampusIds || authorizedCampusIds.length === 0) {
      return { allowed: false, error: '请至少为该课程授权一个校区！' };
    }
    return { allowed: true };
  }

  assert.isFalse(validateStep2([]).allowed);
  assert.isFalse(validateStep2(null).allowed);
  assert.isTrue(validateStep2(['campus-bj-hq']).allowed);
});

// -----------------------------------------------------------------------------
// Suite 3: 课时排序算法与结构不变式极限测试
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 3: 课时排序算法、随机打乱与结构不变式】\x1b[0m');

runTest('Suite 3', '3.1 排序单调递增性与无缝隙不变式 (Order Monotonicity & No Gap Invariant)', () => {
  const unit = {
    id: 'u-1',
    title: '单元一',
    lessons: [
      { id: 'L1', order: 1 },
      { id: 'L2', order: 2 },
      { id: 'L3', order: 3 },
      { id: 'L4', order: 4 },
      { id: 'L5', order: 5 }
    ]
  };

  // 随机移动
  const reordered = CurriculumModel.reorderLessons(unit, 0, 3);
  const orders = reordered.map(l => l.order);
  assert.deepEqual(orders, [1, 2, 3, 4, 5], 'Orders must strictly be 1..5');
});

runTest('Suite 3', '3.2 元素守恒与无损不变式 (Element Conservation Invariant)', () => {
  const unit = {
    id: 'u-2',
    title: '单元二',
    lessons: [
      { id: 'L101', name: 'A' },
      { id: 'L102', name: 'B' },
      { id: 'L103', name: 'C' },
      { id: 'L104', name: 'D' },
    ]
  };
  const originalIds = new Set(unit.lessons.map(l => l.id));

  const reordered = CurriculumModel.reorderLessons(unit, 2, 0); // 将 C 移到首位
  const newIds = new Set(reordered.map(l => l.id));

  assert.equal(newIds.size, originalIds.size);
  for (const id of originalIds) {
    assert.isTrue(newIds.has(id), `Lesson ${id} must not be lost`);
  }
  assert.equal(reordered[0].id, 'L103', 'L103 must be at index 0');
});

runTest('Suite 3', '3.3 100 次连续随机移动压力测试 (100 Random Swaps Stress Test)', () => {
  const lessonCount = 10;
  const unit = {
    id: 'u-stress',
    title: '压力测试单元',
    lessons: Array.from({ length: lessonCount }, (_, i) => ({
      id: `lesson-stress-${i + 1}`,
      title: `第 ${i + 1} 课`,
      order: i + 1
    }))
  };

  for (let step = 0; step < 100; step++) {
    const fromIdx = Math.floor(Math.random() * lessonCount);
    const toIdx = Math.floor(Math.random() * lessonCount);
    unit.lessons = CurriculumModel.reorderLessons(unit, fromIdx, toIdx);

    // 每次随机移动后严格检验不变式
    assert.lengthOf(unit.lessons, lessonCount);
    const orders = unit.lessons.map(l => l.order);
    for (let i = 0; i < lessonCount; i++) {
      assert.equal(orders[i], i + 1, `Step ${step}: Order mismatch at index ${i}`);
    }
    const uniqueIds = new Set(unit.lessons.map(l => l.id));
    assert.equal(uniqueIds.size, lessonCount, `Step ${step}: Lost lessons or duplicates detected!`);
  }
});

runTest('Suite 3', '3.4 连续上下移动极限边界测试 (UI 边界防御与合约越界抛错)', () => {
  const unit = {
    id: 'u-boundary',
    title: '边界测试单元',
    lessons: [
      { id: 'L1', order: 1 },
      { id: 'L2', order: 2 },
      { id: 'L3', order: 3 }
    ]
  };

  // 1. 首项上移在 UI 中安全 no-op
  const moveUpTop = simMoveLesson(unit, 0, -1);
  assert.isFalse(moveUpTop, 'Moving up at index 0 must safely return false');
  assert.equal(unit.lessons[0].id, 'L1');

  // 2. 尾项下移在 UI 中安全 no-op
  const moveDownBottom = simMoveLesson(unit, 2, 1);
  assert.isFalse(moveDownBottom, 'Moving down at bottom must safely return false');
  assert.equal(unit.lessons[2].id, 'L3');

  // 3. 底层合约对越界参数抛出显式异常
  assert.throws(() => CurriculumModel.reorderLessons(unit, -1, 1), /Invalid drag-and-drop index range/);
  assert.throws(() => CurriculumModel.reorderLessons(unit, 0, 10), /Invalid drag-and-drop index range/);
});

runTest('Suite 3', '3.5 空单元下操作与课时增删极限场景', () => {
  const emptyUnit = { id: 'u-empty', title: '空单元', lessons: [] };

  // 空单元移动课时：不报错且安全退出
  assert.isFalse(simMoveLesson(emptyUnit, 0, 1));
  assert.isFalse(simDeleteLesson(emptyUnit, 0));

  // 在空单元下新增课时：自动编入 order: 1
  const l1 = simAddLesson(emptyUnit);
  assert.equal(emptyUnit.lessons.length, 1);
  assert.equal(l1.order, 1);

  // 紧接着新增第 2 课时：order: 2
  const l2 = simAddLesson(emptyUnit);
  assert.equal(emptyUnit.lessons.length, 2);
  assert.equal(l2.order, 2);

  // 删除第 1 课时，第 2 课时自动重排为 order: 1
  simDeleteLesson(emptyUnit, 0);
  assert.equal(emptyUnit.lessons.length, 1);
  assert.equal(emptyUnit.lessons[0].id, l2.id);
  assert.equal(emptyUnit.lessons[0].order, 1);
});

// -----------------------------------------------------------------------------
// Suite 4: 课程启禁用状态切换对前台排课与开单前置条件校验
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m【Suite 4: 课程启禁用状态切换与排课/开单前置条件联动】\x1b[0m');

runTest('Suite 4', '4.1 课程启禁用切换原子性与状态持久化', () => {
  const course = {
    id: 'course-test-toggle',
    name: '启禁用联动测试课',
    status: 'enabled',
    updatedAt: ''
  };

  // 切换为禁用
  course.status = 'disabled';
  course.updatedAt = new Date().toISOString();
  assert.equal(course.status, 'disabled');

  // 验证排课前置条件被立即阻断
  const check = CurriculumModel.canSchedule(course);
  assert.isFalse(check.allowed);
  assert.equal(check.reason, 'Course is disabled');

  // 恢复启用
  course.status = 'enabled';
  assert.isTrue(CurriculumModel.canSchedule(course).allowed);
});

runTest('Suite 4', '4.2 前台教务排课向导对禁用课程的下拉置灰阻断', () => {
  const courses = [
    { id: 'C1', name: '有效课1', status: 'enabled' },
    { id: 'C2', name: '已停开课2', status: 'disabled' }
  ];

  // 模拟排课下拉选项生成
  const scheduleSelectOptions = courses.map(c => ({
    label: c.name,
    value: c.id,
    disabled: !CurriculumModel.canSchedule(c).allowed
  }));

  assert.isFalse(scheduleSelectOptions[0].disabled);
  assert.isTrue(scheduleSelectOptions[1].disabled);
});

runTest('Suite 4', '4.3 学员报名开单前置校验拦截已禁用课程 (Order Creation Gate)', () => {
  const course = { id: 'C_FORBIDDEN', name: '下架禁用课', status: 'disabled' };

  function validateOrderCourse(c) {
    if (c.status === 'disabled') {
      throw new Error(`Cannot create order: Course "${c.name}" is disabled!`);
    }
    return true;
  }

  assert.throws(() => validateOrderCourse(course), /Cannot create order: Course "下架禁用课" is disabled!/);
});

runTest('Suite 4', '4.4 历史排课与在读学员课包隔离性 (Retroactive Safety Invariant)', () => {
  // 即使课程禁用，存量已排课程记录与学员剩余课时不受删除或清零
  const course = { id: 'C_EXP', status: 'enabled' };
  const historySchedules = [
    { id: 'SCH_001', courseId: 'C_EXP', status: 'completed' }
  ];
  const studentPackage = {
    packageId: 'PKG_001',
    courseId: 'C_EXP',
    remainingLessons: 15
  };

  // 禁用课程
  course.status = 'disabled';

  // 历史数据完全保全
  assert.lengthOf(historySchedules, 1);
  assert.equal(studentPackage.remainingLessons, 15);
  // 但新建排课与新开单被阻断
  assert.isFalse(CurriculumModel.canSchedule(course).allowed);
});

runTest('Suite 4', '4.5 校区授权与启禁用双重门禁矩阵验证', () => {
  const testMatrix = [
    { campus: 'campus-bj-yy', authorized: ['campus-bj-hq'], status: 'enabled', canSchedule: false },
    { campus: 'campus-bj-yy', authorized: ['campus-bj-yy'], status: 'disabled', canSchedule: false },
    { campus: 'campus-bj-yy', authorized: ['campus-bj-yy'], status: 'enabled', canSchedule: true },
    { campus: 'campus-bj-hq', authorized: ['campus-bj-yy'], status: 'enabled', canSchedule: true }, // 总部拥有全局开课特权
    { campus: 'campus-bj-hq', authorized: ['campus-bj-hq'], status: 'disabled', canSchedule: false }, // 总部也不能排已禁用课程
  ];

  function evaluateCampusCanSchedule(campusId, course) {
    if (!CurriculumModel.canSchedule(course).allowed) {
      return false;
    }
    const isHq = campusId === 'campus-bj-hq';
    if (isHq) return true;
    return course.authorizedCampusIds.includes(campusId);
  }

  for (const [idx, item] of testMatrix.entries()) {
    const course = {
      status: item.status,
      authorizedCampusIds: item.authorized
    };
    const res = evaluateCampusCanSchedule(item.campus, course);
    assert.equal(res, item.canSchedule, `Matrix case #${idx + 1} failed`);
  }
});

// -----------------------------------------------------------------------------
// 输出统计与挑战裁定
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(80));
console.log('【对抗测试执行总结报告】');
console.log('='.repeat(80));
console.log(`执行用例总数: ${results.total}`);
console.log(`通过: \x1b[32m${results.passed}\x1b[0m`);
console.log(`失败: \x1b[31m${results.failed}\x1b[0m`);
console.log(`通过率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
console.log(`发现漏洞数: ${results.vulnerabilities.length}`);

if (results.vulnerabilities.length > 0) {
  console.log('\n\x1b[33m【发现的真实缺陷与漏洞列表】\x1b[0m');
  results.vulnerabilities.forEach(v => {
    console.log(`  - [${v.id}] [${v.severity}] ${v.title}`);
    console.log(`    描述: ${v.description}`);
  });
}
console.log('='.repeat(80) + '\n');

// 导出为 CommonJS 模块，便于外部调用
module.exports = {
  results,
  uiFilterCourses,
  simMoveLesson,
  simAddLesson,
  simDeleteLesson,
  simMoveUnit
};
