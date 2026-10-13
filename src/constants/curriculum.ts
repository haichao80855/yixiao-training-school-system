import type { SubjectItem, LessonPlanItem } from '@/types/curriculum';

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

export const PRESET_SUBJECTS: SubjectItem[] = [
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

export const MOCK_SUBJECTS = PRESET_SUBJECTS;

export const PRESET_LESSON_PLANS: LessonPlanItem[] = [
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
