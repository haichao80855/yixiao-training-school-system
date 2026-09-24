/**
 * 教研中心专属 Mock 数据中心 (Curriculum Mock Center)
 * 提供真实完备的课程、科目体系、单元课时与教案课件资源数据
 */
import type { CourseItem, SubjectItem, LessonPlanItem, CourseUnit, CourseStatus } from '@/types/curriculum';

// 16:9 高清矢量教研封面生成工具 (支持离线高清渲染，像素级还原原图质感)
export const COURSE_COVERS = {
  boutiqueScratch: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FFF0F3"/><stop offset="50%" stop-color="%23FFCCD5"/><stop offset="100%" stop-color="%23FFB3C1"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg1)"/><rect x="15" y="15" width="290" height="150" rx="8" fill="white" opacity="0.9"/><rect x="25" y="25" width="60" height="20" rx="4" fill="%23FFEAA7"/><text x="55" y="39" font-size="11" font-weight="bold" fill="%23D63031" text-anchor="middle">精品课程</text><text x="160" y="75" font-size="22" font-weight="900" fill="%232D3436" text-anchor="middle" font-family="sans-serif">精品课程</text><text x="160" y="98" font-size="11" fill="%23636E72" text-anchor="middle">在这里，让我们一起成长</text><rect x="125" y="115" width="70" height="22" rx="11" fill="%23FD79A8"/><text x="160" y="130" font-size="11" font-weight="bold" fill="white" text-anchor="middle">GO ▶</text><circle cx="50" cy="110" r="16" fill="%23FFEAA7"/><circle cx="44" cy="106" r="2.5" fill="%232D3436"/><circle cx="56" cy="106" r="2.5" fill="%232D3436"/><path d="M44 116 Q50 123 56 116" stroke="%232D3436" stroke-width="2" fill="none"/></svg>`,
  boutiquePython: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23E8F4FD"/><stop offset="50%" stop-color="%23C2E3FC"/><stop offset="100%" stop-color="%239DD0FB"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg2)"/><rect x="15" y="15" width="290" height="150" rx="8" fill="white" opacity="0.9"/><rect x="25" y="25" width="60" height="20" rx="4" fill="%23FFEAA7"/><text x="55" y="39" font-size="11" font-weight="bold" fill="%230984E3" text-anchor="middle">精品课程</text><text x="160" y="75" font-size="22" font-weight="900" fill="%232D3436" text-anchor="middle" font-family="sans-serif">精品课程</text><text x="160" y="98" font-size="11" fill="%23636E72" text-anchor="middle">在这里，让我们一起成长</text><rect x="125" y="115" width="70" height="22" rx="11" fill="%230984E3"/><text x="160" y="130" font-size="11" font-weight="bold" fill="white" text-anchor="middle">GO ▶</text><circle cx="50" cy="110" r="16" fill="%23FFEAA7"/><circle cx="44" cy="106" r="2.5" fill="%232D3436"/><circle cx="56" cy="106" r="2.5" fill="%232D3436"/><path d="M44 116 Q50 123 56 116" stroke="%232D3436" stroke-width="2" fill="none"/></svg>`,
  cityZhongming: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231E3C72"/><stop offset="50%" stop-color="%232A5298"/><stop offset="100%" stop-color="%234A90E2"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg3)"/><path d="M0 130 Q80 100 160 120 T320 110 L320 180 L0 180 Z" fill="%2315284F" opacity="0.7"/><polygon points="80,120 160,80 240,120 160,160" fill="%235dade2" opacity="0.3"/><text x="160" y="70" font-size="18" font-weight="900" fill="white" text-anchor="middle">2026-青挑·城市赛</text><text x="160" y="100" font-size="22" font-weight="900" fill="%23F39C12" text-anchor="middle">中鸣机器人</text><rect x="120" y="115" width="80" height="18" rx="9" fill="%233498DB" opacity="0.9"/><text x="160" y="128" font-size="10" font-weight="bold" fill="white" text-anchor="middle">城市挑战营</text></svg>`,
  cityKiro: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23134E5E"/><stop offset="100%" stop-color="%2371B280"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg4)"/><path d="M0 120 L160 60 L320 120 L320 180 L0 180 Z" fill="%230F3B47" opacity="0.5"/><text x="160" y="70" font-size="18" font-weight="900" fill="white" text-anchor="middle">2026-青挑·城市赛</text><text x="160" y="100" font-size="22" font-weight="900" fill="%2300FFA3" text-anchor="middle">KIRO 启蒙</text><rect x="110" y="115" width="100" height="18" rx="9" fill="%232ECC71" opacity="0.9"/><text x="160" y="128" font-size="10" font-weight="bold" fill="white" text-anchor="middle">学前大颗粒搭建</text></svg>`,
  cityMcu: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230F2027"/><stop offset="50%" stop-color="%23203A43"/><stop offset="100%" stop-color="%232C5364"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg5)"/><text x="160" y="70" font-size="18" font-weight="900" fill="white" text-anchor="middle">2026-青挑·城市赛</text><text x="160" y="100" font-size="22" font-weight="900" fill="%2300D2D3" text-anchor="middle">单片机智能硬件</text><rect x="115" y="115" width="90" height="18" rx="9" fill="%230ABDE3" opacity="0.9"/><text x="160" y="128" font-size="10" font-weight="bold" fill="white" text-anchor="middle">传感与传动控制</text></svg>`,
  teacherTraining: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2384FAB0"/><stop offset="100%" stop-color="%238FD3F4"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg6)"/><rect x="20" y="20" width="280" height="140" rx="10" fill="white" opacity="0.85"/><text x="160" y="75" font-size="22" font-weight="900" fill="%231E824C" text-anchor="middle">快乐学知识</text><text x="160" y="105" font-size="12" fill="%2327AE60" text-anchor="middle">用轻松的方式高效学知识 ★★★★★</text><rect x="100" y="120" width="120" height="22" rx="11" fill="%232ECC71"/><text x="160" y="135" font-size="11" font-weight="bold" fill="white" text-anchor="middle">讲师认证集训</text></svg>`,
  dreamCpp: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FEE140"/><stop offset="100%" stop-color="%23FA709A"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg7)"/><rect x="20" y="20" width="280" height="140" rx="8" fill="%23FFF5E6" stroke="%23D35400" stroke-width="2"/><text x="160" y="70" font-size="24" font-weight="900" fill="%23C0392B" text-anchor="middle">编程梦想家</text><rect x="80" y="85" width="160" height="32" rx="6" fill="%23E67E22"/><text x="160" y="107" font-size="18" font-weight="bold" fill="white" text-anchor="middle">C++ (零基础)</text><text x="160" y="138" font-size="11" fill="%237F8C8D" text-anchor="middle">算法培优 · 冲刺 NOIP</text></svg>`,
  dreamPython: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234FACFE"/><stop offset="100%" stop-color="%2300F2FE"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg8)"/><rect x="20" y="20" width="280" height="140" rx="8" fill="%23F0F8FF" stroke="%232980B9" stroke-width="2"/><text x="160" y="70" font-size="24" font-weight="900" fill="%231F3A93" text-anchor="middle">编程梦想家</text><rect x="80" y="85" width="160" height="32" rx="6" fill="%233498DB"/><text x="160" y="107" font-size="18" font-weight="bold" fill="white" text-anchor="middle">Python (零基础)</text><text x="160" y="138" font-size="11" fill="%237F8C8D" text-anchor="middle">趣味图形 · AI数据分析</text></svg>`,
  dreamScratch: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180"><defs><linearGradient id="bg9" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23F6D365"/><stop offset="100%" stop-color="%23FDA085"/></linearGradient></defs><rect width="320" height="180" fill="url(%23bg9)"/><rect x="20" y="20" width="280" height="140" rx="8" fill="%23FFFDF9" stroke="%23E67E22" stroke-width="2"/><text x="160" y="70" font-size="24" font-weight="900" fill="%23D35400" text-anchor="middle">编程梦想家</text><rect x="80" y="85" width="160" height="32" rx="6" fill="%23F39C12"/><text x="160" y="107" font-size="18" font-weight="bold" fill="white" text-anchor="middle">Scratch (零基础)</text><text x="160" y="138" font-size="11" fill="%237F8C8D" text-anchor="middle">积木探索 · 游戏创想</text></svg>`
};

// 预设单元与课时示例模板
const DEFAULT_SCRATCH_UNITS: CourseUnit[] = [
  {
    id: 'unit-scratch-01',
    title: '第一单元：初识 Scratch 与舞台角色设计',
    description: '熟悉积木编程界面、舞台坐标系与角色动画基础',
    order: 1,
    lessons: [
      {
        id: 'lesson-scratch-01',
        title: '第 01 课：大闹天宫：小猫快跑与背景切换',
        name: '大闹天宫：小猫快跑与背景切换',
        duration: 60,
        order: 1,
        objective: '掌握外观积木组与舞台切换逻辑，建立坐标与方向基本感知',
        pptUrl: 'https://cdn.shengtong.edu/ppt/scratch_01.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/scratch/l01_monkey_king.sb3',
        quizCount: 4,
        hasMedia: true
      },
      {
        id: 'lesson-scratch-02',
        title: '第 02 课：海底世界：循环结构与造型动画',
        name: '海底世界：循环结构与造型动画',
        duration: 60,
        order: 2,
        objective: '掌握【重复执行】循环与【下一个造型】，制作逼真游动水母与小丑鱼',
        pptUrl: 'https://cdn.shengtong.edu/ppt/scratch_02.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/scratch/l02_underwater.sb3',
        quizCount: 5,
        hasMedia: true
      }
    ]
  },
  {
    id: 'unit-scratch-02',
    title: '第二单元：条件分支与键盘交互游戏',
    description: '通过侦测与条件判断实现键盘摇杆交互',
    order: 2,
    lessons: [
      {
        id: 'lesson-scratch-03',
        title: '第 03 课：飞机大战：侦测碰撞与克隆体',
        name: '飞机大战：侦测碰撞与克隆体',
        duration: 90,
        order: 1,
        objective: '学习克隆子弹与敌机生成，掌握【碰到...】碰撞侦测条件判断',
        pptUrl: 'https://cdn.shengtong.edu/ppt/scratch_03.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/scratch/l03_air_combat.sb3',
        quizCount: 6,
        hasMedia: true
      },
      {
        id: 'lesson-scratch-04',
        title: '第 04 课：迷宫寻宝：变量计分与音效合成',
        name: '迷宫寻宝：变量计分与音效合成',
        duration: 90,
        order: 2,
        objective: '深入理解全局变量建立金币计数器，触发通关音效与倒计时判定',
        pptUrl: 'https://cdn.shengtong.edu/ppt/scratch_04.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/scratch/l04_maze.sb3',
        quizCount: 5,
        hasMedia: false
      }
    ]
  }
];

const DEFAULT_CPP_UNITS: CourseUnit[] = [
  {
    id: 'unit-cpp-01',
    title: '第一单元：C++ 基础语法与控制流',
    description: 'C++ 普及组核心控制语法与输入输出提速技巧',
    order: 1,
    lessons: [
      {
        id: 'lesson-cpp-01',
        title: '第 1 讲：开发环境搭建与基础变量类型',
        name: '开发环境搭建与基础变量类型',
        duration: 90,
        order: 1,
        objective: '掌握 cin/cout 格式化输入输出、int/long long 数据溢出防护',
        pptUrl: 'https://cdn.shengtong.edu/ppt/cpp_01.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/cpp/l01_vars.cpp',
        quizCount: 6,
        hasMedia: true
      },
      {
        id: 'lesson-cpp-02',
        title: '第 2 讲：if-else 条件分支结构深度剖析',
        name: 'if-else 条件分支结构深度剖析',
        duration: 90,
        order: 2,
        objective: '三目运算符、逻辑短路现象与嵌套分支真题实战',
        pptUrl: 'https://cdn.shengtong.edu/ppt/cpp_02.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/cpp/l02_branch.cpp',
        quizCount: 5,
        hasMedia: true
      },
      {
        id: 'lesson-cpp-03',
        title: '第 3 讲：for 与 while 循环及穷举法',
        name: 'for 与 while 循环及穷举法',
        duration: 90,
        order: 3,
        objective: '循环不变式、break/continue 控制跳转与质数素数判定算法',
        pptUrl: 'https://cdn.shengtong.edu/ppt/cpp_03.pdf',
        codeTemplate: 'https://cdn.shengtong.edu/cpp/l03_loops.cpp',
        quizCount: 8,
        hasMedia: true
      }
    ]
  }
];

// 核心课程 Mock 库 (12~18 项，与设计图像素级一致)
export const INITIAL_COVERS = COURSE_COVERS;

export const MOCK_CURRICULUM_COURSES: CourseItem[] = [
  // 1. C++ 编程集训课
  {
    id: 'course-cpp-002',
    name: 'C++编程集训课',
    code: '012-软编Scratch',
    cover: COURSE_COVERS.boutiqueScratch,
    pricePerLesson: 1000,
    totalLessons: 64,
    subject: '信息学竞赛',
    grade: '中学',
    attribute: 'extended',
    type: '集训',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd', 'campus-bj-yy'],
    description: '针对 CSP-J/S 与 NOIP 联赛冲刺集训，主攻动态规划与高级数据结构',
    standardDuration: 90,
    maxCapacity: 16,
    year: '2026',
    period: '秋季班',
    tags: ['授权', '扩科-实践-总部-软编'],
    units: DEFAULT_CPP_UNITS
  },
  // 2. Python 编程集训课
  {
    id: 'course-python-003',
    name: 'Python编程集训课',
    code: '012-软编Scratch',
    cover: COURSE_COVERS.boutiquePython,
    pricePerLesson: 300,
    totalLessons: 48,
    subject: '软件编程',
    grade: '小学高',
    attribute: 'extended',
    type: '集训',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy'],
    description: 'Python趣味编程与算法实战，涵盖海龟画图、函数递归与数据可视化',
    standardDuration: 90,
    maxCapacity: 16,
    year: '2026',
    period: '秋季班',
    tags: ['授权', '扩科-实践-总部-软编'],
    units: DEFAULT_SCRATCH_UNITS
  },
  // 3. Scratch 编程集训课
  {
    id: 'course-scratch-001',
    name: 'Scratch编程集训课',
    code: '012-软编Scratch',
    cover: COURSE_COVERS.boutiqueScratch,
    pricePerLesson: 300,
    totalLessons: 48,
    subject: '软件编程',
    grade: '小学低',
    attribute: 'extended',
    type: '集训',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'],
    description: '针对小学 1-3 年级建立图形化积木编程思维，创作趣味互动小游戏',
    standardDuration: 60,
    maxCapacity: 12,
    year: '2026',
    period: '秋季班',
    tags: ['授权', '扩科-实践-总部-软编'],
    units: DEFAULT_SCRATCH_UNITS
  },
  // 4. 2026-青挑-城市赛-中鸣
  {
    id: 'course-city-zm-004',
    name: '2026-青挑-城市赛-中鸣',
    code: '202-中鸣威奇',
    cover: COURSE_COVERS.cityZhongming,
    pricePerLesson: 330,
    totalLessons: 32,
    subject: '硬件机器人',
    grade: '初级课程',
    attribute: 'extended',
    type: '城市赛',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd', 'campus-bj-wj'],
    description: '全国青少年人工智能创新挑战赛官方指定集训课程，涵盖中鸣场地巡线与任务击破',
    standardDuration: 90,
    maxCapacity: 12,
    year: '2026',
    period: '春季班',
    tags: ['授权', '扩科-实践-总部-中鸣教具']
  },
  // 5. 2026-青挑-城市赛-KIRO
  {
    id: 'course-kiro-005',
    name: '2026-青挑-城市赛-KIRO',
    code: '013-积木KIRO',
    cover: COURSE_COVERS.cityKiro,
    pricePerLesson: 330,
    totalLessons: 32,
    subject: '科技启蒙',
    grade: '幼儿园',
    attribute: 'extended',
    type: '城市赛',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy'],
    description: 'KIRO 机械传动探索，适合学前儿童的大颗粒搭建与机械连杆机械臂实作',
    standardDuration: 45,
    maxCapacity: 10,
    year: '2026',
    period: '春季班',
    tags: ['授权', '扩科-实践-总部-乐博常规教具']
  },
  // 6. 2026-青挑-城市赛-单片机
  {
    id: 'course-mcu-006',
    name: '2026-青挑-城市赛-单片机',
    code: '007-单片机',
    cover: COURSE_COVERS.cityMcu,
    pricePerLesson: 330,
    totalLessons: 36,
    subject: '硬件机器人',
    grade: '中级课程',
    attribute: 'extended',
    type: '城市赛',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd'],
    description: 'Arduino 与单片机嵌入式 C 语言开发，传感器采样与电机闭环调速控制',
    standardDuration: 90,
    maxCapacity: 14,
    year: '2026',
    period: '春季班',
    tags: ['授权', '扩科-实践-总部-乐博常规教具']
  },
  // 7. 乐博加盟-阶段测评课
  {
    id: 'course-training-007',
    name: '乐博加盟-阶段测评课',
    code: '通用课程',
    cover: COURSE_COVERS.teacherTraining,
    pricePerLesson: 200,
    totalLessons: 16,
    subject: '教师培训',
    grade: '中级课程',
    attribute: 'training',
    type: '常规',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'],
    description: '全国乐博加盟校区师资教学标准化等级认证与阶段实战测评课',
    standardDuration: 60,
    maxCapacity: 20,
    year: '2025',
    period: '常规班',
    tags: ['授权', '教师培训']
  },
  // 8. 2025-青挑-智慧城市(积木KIRO)
  {
    id: 'course-smart-kiro-008',
    name: '2025-青挑-智慧城市(积木KIRO)',
    code: '013-积木KIRO',
    cover: COURSE_COVERS.cityKiro,
    pricePerLesson: 330,
    totalLessons: 30,
    subject: '硬件机器人',
    grade: '初级课程',
    attribute: 'extended',
    type: '城市赛',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy'],
    description: '智慧交通微缩模型搭建，风车、道闸与自动升降桥机械原理',
    standardDuration: 60,
    maxCapacity: 12,
    year: '2025',
    period: '暑期班',
    tags: ['授权', '扩科-实践-总部-乐博常规教具']
  },
  // 9. 2025-青挑-智慧城市(单片机)
  {
    id: 'course-smart-mcu-009',
    name: '2025-青挑-智慧城市(单片机)',
    code: '007-单片机',
    cover: COURSE_COVERS.cityMcu,
    pricePerLesson: 330,
    totalLessons: 30,
    subject: '硬件机器人',
    grade: '高级课程',
    attribute: 'extended',
    type: '城市赛',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-cy', 'campus-bj-wj'],
    description: '单片机多传感器融合感知：超声波测距避障与红外循迹底盘',
    standardDuration: 90,
    maxCapacity: 14,
    year: '2025',
    period: '暑期班',
    tags: ['授权', '扩科-实践-总部-乐博常规教具']
  },
  // 10. 2025-C++梦想家 (零基础)
  {
    id: 'course-dream-cpp-010',
    name: '2025-C++梦想家 (零基础)',
    code: '001-软编C++',
    cover: COURSE_COVERS.dreamCpp,
    pricePerLesson: 300,
    totalLessons: 40,
    subject: '软件编程',
    grade: '小学高',
    attribute: 'extended',
    type: '常规',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-hd', 'campus-bj-yy'],
    description: '专为小学 5-6 年级定制的 C++ 入门思维训练，从图形过渡到代码编程',
    standardDuration: 90,
    maxCapacity: 15,
    year: '2025',
    period: '秋季班',
    tags: ['授权', '小学高 · 扩科-实践-总部-软编']
  },
  // 11. 2025-Python梦想家 (零基础)
  {
    id: 'course-dream-py-011',
    name: '2025-Python梦想家 (零基础)',
    code: '011-软编Python',
    cover: COURSE_COVERS.dreamPython,
    pricePerLesson: 300,
    totalLessons: 40,
    subject: '软件编程',
    grade: '小学高',
    attribute: 'extended',
    type: '常规',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-wj'],
    description: 'Python 零门槛趣味实战，自动生成数字艺术图形，培养工程设计思维',
    standardDuration: 90,
    maxCapacity: 15,
    year: '2025',
    period: '秋季班',
    tags: ['授权', '小学高 · 扩科-实践-总部-软编']
  },
  // 12. 2025-Scratch梦想家 (零基础)
  {
    id: 'course-dream-sc-012',
    name: '2025-Scratch梦想家 (零基础)',
    code: '012-软编Scratch',
    cover: COURSE_COVERS.dreamScratch,
    pricePerLesson: 300,
    totalLessons: 40,
    subject: '软件编程',
    grade: '小学低',
    attribute: 'extended',
    type: '常规',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'],
    description: '零基础趣味动画与故事创作，掌握事件响应与逻辑判断',
    standardDuration: 60,
    maxCapacity: 12,
    year: '2025',
    period: '秋季班',
    tags: ['授权', '小学低 · 扩科-实践-总部-软编']
  },
  // 13. 机器人EV3工程 (保留原始项目测试用例)
  {
    id: 'course-robot-004',
    name: '013-乐高EV3/单片机机器人工程',
    code: '013-LEGO-ROBOT',
    cover: COURSE_COVERS.cityZhongming,
    pricePerLesson: 380,
    totalLessons: 36,
    subject: '硬件机器人',
    grade: '小学低',
    attribute: 'activity',
    type: '常规',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-wj'],
    description: '机械结构传动与传感器软硬件联动',
    standardDuration: 90,
    maxCapacity: 12,
    year: '2025',
    period: '暑期班',
    tags: ['授权', '活动课程']
  },
  // 14. 盛通全国教师资格认证培训 (保留原始 disabled 状态)
  {
    id: 'course-training-006',
    name: '901-盛通全国教师资格认证培训',
    code: '901-TEACHER-CERT',
    cover: COURSE_COVERS.teacherTraining,
    pricePerLesson: 500,
    totalLessons: 20,
    subject: '教师培训',
    grade: '高级课程',
    attribute: 'training',
    type: '常规',
    status: 'disabled',
    authorizedCampusIds: ['campus-bj-hq'],
    description: '少儿编程标准化教学法与课堂交付实操',
    standardDuration: 120,
    maxCapacity: 25,
    year: '2025',
    period: '师训专班',
    tags: ['教师培训']
  },
  // 15. 全国青少年等级考试服务费
  {
    id: 'course-service-015',
    name: 'NCT全国青少年编程等级考试代考务服务费',
    code: 'NCT-EXAM-SVC',
    cover: COURSE_COVERS.boutiqueScratch,
    pricePerLesson: 150,
    totalLessons: 1,
    subject: '考级竞赛',
    grade: '全部',
    attribute: 'service_fee',
    type: '考级',
    status: 'enabled',
    authorizedCampusIds: ['campus-bj-hq', 'campus-bj-yy', 'campus-bj-cy', 'campus-bj-hd', 'campus-bj-wj'],
    description: '电子学会/NCT 考务报名代报与机房监考服务费',
    standardDuration: 60,
    maxCapacity: 100,
    year: '2026',
    period: '常规班',
    tags: ['服务费']
  }
];

// 科目体系 Mock 数据
export const MOCK_SUBJECTS: SubjectItem[] = [
  {
    id: 'subj-001',
    code: 'SUBJ-PROG-01',
    name: '少儿图形化编程 (Scratch)',
    targetAges: '小学 1-3 年级 (6-9岁)',
    category: 'programming',
    categoryName: '软件编程体系',
    courseCount: 12,
    status: 'active',
    syllabusVersion: 'v3.2',
    description: '通过积木拼搭培养计算思维，适合低幼学段编程启蒙',
    updatedAt: '2026-09-01'
  },
  {
    id: 'subj-002',
    code: 'SUBJ-PROG-02',
    name: 'Python 人工智能趣味编程',
    targetAges: '小学 4-6 年级 (9-12岁)',
    category: 'programming',
    categoryName: '软件编程体系',
    courseCount: 8,
    status: 'active',
    syllabusVersion: 'v2.8',
    description: '从几何 Turtle 绘图到基础数据结构与机器学习趣味模型',
    updatedAt: '2026-08-15'
  },
  {
    id: 'subj-003',
    code: 'SUBJ-PROG-03',
    name: 'C++ 信息学奥赛 (CSP-J/S & NOIP)',
    targetAges: '初中 / 高中 (12-18岁)',
    category: 'programming',
    categoryName: '信息学竞赛体系',
    courseCount: 16,
    status: 'active',
    syllabusVersion: 'v4.1',
    description: '白名单教育部官方竞赛培训，主攻普及组与提高组算法真题',
    updatedAt: '2026-09-10'
  },
  {
    id: 'subj-004',
    code: 'SUBJ-ROBOT-01',
    name: '中鸣/乐高机器人单片机创客工程',
    targetAges: '幼儿园至初中 (4-14岁)',
    category: 'robotics',
    categoryName: '硬件创客体系',
    courseCount: 14,
    status: 'active',
    syllabusVersion: 'v3.0',
    description: '机械传动、齿轮组、传感器信号采集与硬件实操闭环',
    updatedAt: '2026-07-20'
  },
  {
    id: 'subj-005',
    code: 'SUBJ-SCI-01',
    name: '未来科学探索与创客实践',
    targetAges: '小学全学段 (7-12岁)',
    category: 'science',
    categoryName: '科学探索体系',
    courseCount: 6,
    status: 'active',
    syllabusVersion: 'v1.5',
    description: '跨学科 STEAM 科学实验探究，包含声光电热力学实验',
    updatedAt: '2026-05-18'
  },
  {
    id: 'subj-006',
    code: 'SUBJ-ART-01',
    name: '数智艺术与 3D 创意建模',
    targetAges: '小学 3-6 年级 (8-12岁)',
    category: 'art',
    categoryName: '数字艺术体系',
    courseCount: 5,
    status: 'active',
    syllabusVersion: 'v2.0',
    description: ' Blender/3D One 三维造型、空间设计与数码版画创作',
    updatedAt: '2026-06-12'
  }
];

// 教案课件资源 Mock 数据
export const MOCK_LESSON_PLANS: LessonPlanItem[] = [
  {
    id: 'plan-001',
    courseId: 'course-scratch-001',
    courseName: 'Scratch编程集训课',
    unitId: 'unit-scratch-01',
    unitTitle: '第一单元：初识 Scratch 与舞台角色设计',
    lessonId: 'lesson-scratch-01',
    lessonName: '大闹天宫：小猫快跑与背景切换',
    order: 1,
    duration: 60,
    targetAudience: '小学 1-2 年级',
    pptVersion: 'v2.4',
    codeType: 'Scratch',
    downloadCount: 182,
    fileSize: '14.2 MB',
    updatedAt: '2026-09-02',
    status: 'published'
  },
  {
    id: 'plan-002',
    courseId: 'course-scratch-001',
    courseName: 'Scratch编程集训课',
    unitId: 'unit-scratch-01',
    unitTitle: '第一单元：初识 Scratch 与舞台角色设计',
    lessonId: 'lesson-scratch-02',
    lessonName: '海底世界：循环结构与造型动画',
    order: 2,
    duration: 60,
    targetAudience: '小学 1-2 年级',
    pptVersion: 'v2.3',
    codeType: 'Scratch',
    downloadCount: 145,
    fileSize: '18.6 MB',
    updatedAt: '2026-09-05',
    status: 'published'
  },
  {
    id: 'plan-003',
    courseId: 'course-scratch-001',
    courseName: 'Scratch编程集训课',
    unitId: 'unit-scratch-02',
    unitTitle: '第二单元：条件分支与键盘交互游戏',
    lessonId: 'lesson-scratch-03',
    lessonName: '飞机大战：侦测碰撞与克隆体',
    order: 3,
    duration: 90,
    targetAudience: '小学 2-3 年级',
    pptVersion: 'v3.1',
    codeType: 'Scratch',
    downloadCount: 220,
    fileSize: '25.1 MB',
    updatedAt: '2026-09-12',
    status: 'published'
  },
  {
    id: 'plan-004',
    courseId: 'course-cpp-002',
    courseName: 'C++编程集训课',
    unitId: 'unit-cpp-01',
    unitTitle: '第一单元：C++ 基础语法与控制流',
    lessonId: 'lesson-cpp-01',
    lessonName: '开发环境搭建与基础变量类型',
    order: 1,
    duration: 90,
    targetAudience: '初中 / 高中',
    pptVersion: 'v4.0',
    codeType: 'C++',
    downloadCount: 310,
    fileSize: '8.7 MB',
    updatedAt: '2026-09-08',
    status: 'published'
  },
  {
    id: 'plan-005',
    courseId: 'course-cpp-002',
    courseName: 'C++编程集训课',
    unitId: 'unit-cpp-01',
    unitTitle: '第一单元：C++ 基础语法与控制流',
    lessonId: 'lesson-cpp-02',
    lessonName: 'if-else 条件分支结构深度剖析',
    order: 2,
    duration: 90,
    targetAudience: '初中 / 高中',
    pptVersion: 'v4.2',
    codeType: 'C++',
    downloadCount: 289,
    fileSize: '11.3 MB',
    updatedAt: '2026-09-15',
    status: 'published'
  }
];

// ==========================================
// 统一课程数据池 (Single Source of Truth) 与 LocalStorage 持久化
// ==========================================
export const COURSES_STORAGE_KEY = 'yixiao_curriculum_courses_v1';

export const MOCK_COURSES: CourseItem[] = [...MOCK_CURRICULUM_COURSES];

export function clearCoursesMockData(): void {
  MOCK_COURSES.length = 0;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(COURSES_STORAGE_KEY);
  }
}

export function restoreCoursesMockData(): void {
  MOCK_COURSES.length = 0;
  MOCK_COURSES.push(...JSON.parse(JSON.stringify(MOCK_CURRICULUM_COURSES)));
  saveCoursesToStorage();
}



export function saveCoursesToStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(MOCK_COURSES));
  } catch (e) {
    console.error('Failed to save courses to localStorage:', e);
  }
}

export function restoreCoursesFromStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY);
    if (!raw) return;
    const stored: CourseItem[] = JSON.parse(raw);
    if (Array.isArray(stored) && stored.length > 0) {
      stored.forEach(item => {
        const idx = MOCK_COURSES.findIndex(c => c.id === item.id);
        if (idx >= 0) {
          MOCK_COURSES[idx] = { ...MOCK_COURSES[idx], ...item };
        } else {
          MOCK_COURSES.push(item);
        }
      });
    }
  } catch (e) {
    console.error('Failed to restore courses from localStorage:', e);
  }
}

// 自动初始化一次恢复
restoreCoursesFromStorage();

export function getCoursesByCampus(campusId?: string): CourseItem[] {
  // 总部校区返回全量课程，非总部校区按 authorizedCampusIds.includes(campusId) 精确过滤
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001' || campusId === 'CAMPUS_HQ') {
    return [...MOCK_COURSES];
  }
  return MOCK_COURSES.filter(c => c.authorizedCampusIds && c.authorizedCampusIds.includes(campusId));
}

export function getAllCourses(): CourseItem[] {
  return [...MOCK_COURSES];
}

export function saveCourse(course: CourseItem): CourseItem {
  const index = MOCK_COURSES.findIndex(c => c.id === course.id);
  let saved: CourseItem;
  if (index >= 0) {
    MOCK_COURSES[index] = { ...course, updatedAt: new Date().toISOString() };
    saved = MOCK_COURSES[index];
  } else {
    const newCourse: CourseItem = {
      ...course,
      id: course.id || `course-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    MOCK_COURSES.unshift(newCourse);
    saved = newCourse;
  }
  saveCoursesToStorage();
  return saved;
}

export function deleteCourse(courseId: string): boolean {
  const index = MOCK_COURSES.findIndex(c => c.id === courseId);
  if (index >= 0) {
    MOCK_COURSES.splice(index, 1);
    saveCoursesToStorage();
    return true;
  }
  return false;
}

export function toggleCourseStatus(courseId: string, status?: CourseStatus): CourseItem | undefined {
  const course = MOCK_COURSES.find(c => c.id === courseId);
  if (course) {
    course.status = status || (course.status === 'enabled' ? 'disabled' : 'enabled');
    course.updatedAt = new Date().toISOString();
    saveCoursesToStorage();
  }
  return course;
}

