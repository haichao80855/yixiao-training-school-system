import type { EvaluationTemplate, LessonEvaluation } from '@/types/educational';

export const EVALUATION_TEMPLATES: EvaluationTemplate[] = [
  {
    id: 'tmpl-common',
    name: '通用课评模板',
    category: '通用综合',
    defaultStudyContent: `<p><strong>编程小游戏投石车对抗坦克</strong></p><p>1. 如果那么、重复执行直到满足某个条件、广播与接收指令的应用</p><p>2. 运算逻辑随机数的应用</p><p>3. 角色的左右移动与坐标的变化</p><p>4. 使用不同的案件控制角色的移动和动作</p>`,
    defaultTeacherComment: '通过游戏的方式，吸引学生的学习兴趣，在整个编程过程中，循序渐进的对不同角色进行有序设计，同时了解到物体的抛物线运动轨迹，增加新的知识点。课堂专注度很高，能独立排查变量作用域问题！',
    tags: ['逻辑思维', '探究实践', '抗挫能力']
  },
  {
    id: 'tmpl-microbit',
    name: '单片机硬件科创课评模板',
    category: '智能硬件',
    defaultStudyContent: `<p><strong>单片机舵机控制与红外避障小车实训</strong></p><p>1. 掌握数字引脚与模拟引脚的区别与信号读取</p><p>2. 学习红外光电传感器检测障碍物原理与阈值校准</p><p>3. 编写双电机差速转向算法，实现迷宫自主导航避障</p>`,
    defaultTeacherComment: '孩子动手接线非常规范，能够根据示波器波形迅速找出接触不良引脚。在编写避障算法时，能够主动运用双分支条件嵌套解决原地打转问题，工程思维表现优异！',
    tags: ['硬件实操', '电路连接', '工程思维']
  },
  {
    id: 'tmpl-scratch',
    name: 'Scratch少儿图形化编程模板',
    category: '少儿编程',
    defaultStudyContent: `<p><strong>克隆体特效与物理重力引擎进阶</strong></p><p>1. 深入理解本体与克隆体的区别，掌握“当作为克隆体启动时”与“删除此克隆体”</p><p>2. 利用私有变量实现每个雪花/子弹独立的速度与透明度渐变</p><p>3. 碰撞检测与广播机制的综合联动</p>`,
    defaultTeacherComment: '本节课思维非常活跃，在完成基础冰雪飘落任务后，还主动为场景添加了风向阻力算法和粒子光晕效果，创造力与审美表现亮眼，继续保持！',
    tags: ['创意思维', '算法抽象', '审美表达']
  },
  {
    id: 'tmpl-python',
    name: 'Python高阶代码进阶模板',
    category: '代码进阶',
    defaultStudyContent: `<p><strong>列表推导式与二分查找算法实现</strong></p><p>1. 掌握单重与嵌套列表推导式的优雅语法，提升代码可读性与执行效率</p><p>2. 探究线性查找与二分查找的复杂度差异（O(n) vs O(log n)）</p><p>3. 自主实现并测试二分查找边界指针移动逻辑</p>`,
    defaultTeacherComment: '对于边界条件（left <= right）的把控非常敏锐，在现场盲写代码测试中一次性通过了全部单元测试用例，逻辑严密，表现出极强的算法潜力！',
    tags: ['代码工程', '时间复杂度', '严谨逻辑']
  }
];

export const EVALUATIONS_STORAGE_KEY = 'yixiao_lesson_evaluations';

export function getEvaluationTemplates(): EvaluationTemplate[] {
  return [...EVALUATION_TEMPLATES];
}

export function getStoredLessonEvaluation(lessonTimeId: string): LessonEvaluation | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(EVALUATIONS_STORAGE_KEY);
    if (!raw) return null;
    const list: LessonEvaluation[] = JSON.parse(raw);
    const item = list.find(e => e.lessonTimeId === lessonTimeId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  } catch {
    return null;
  }
}

export function saveStoredLessonEvaluation(payload: Partial<LessonEvaluation>, publish: boolean = false): LessonEvaluation {
  const lessonTimeId = payload.lessonTimeId || '';
  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  let list: LessonEvaluation[] = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(EVALUATIONS_STORAGE_KEY);
      if (raw) list = JSON.parse(raw);
    } catch {}
  }

  let existing = list.find(e => e.lessonTimeId === lessonTimeId);
  if (existing) {
    Object.assign(existing, payload, {
      status: publish ? 'published' : (payload.status || 'draft'),
      publishTime: publish ? nowStr : existing.publishTime,
      updatedAt: nowStr
    });
  } else {
    existing = {
      id: `eval-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      lessonTimeId,
      classId: payload.classId || '',
      className: payload.className || '',
      lessonTitle: payload.lessonTitle || '',
      templateId: payload.templateId || 'tmpl-common',
      templateName: payload.templateName || '通用课评模板',
      studyContent: payload.studyContent || '',
      rating: payload.rating || 5,
      voiceUrl: payload.voiceUrl || '',
      voiceDuration: payload.voiceDuration || 0,
      videoUrl: payload.videoUrl || '',
      photoList: payload.photoList || [],
      teacherComment: payload.teacherComment || '',
      aiPolished: !!payload.aiPolished,
      status: publish ? 'published' : 'draft',
      publishTime: publish ? nowStr : undefined,
      updatedAt: nowStr
    };
    list.push(existing);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(EVALUATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  return existing;
}

export const getLessonEvaluationByLessonId = getStoredLessonEvaluation;
export const saveLessonEvaluation = saveStoredLessonEvaluation;
