/**
 * 教研中心核心契约与数据类型规范 (Curriculum Types)
 * 对应 PROJECT.md § Interface Contracts 2 & Milestone 2 业务规范
 */

export type CourseAttribute = 'regular' | 'extended' | 'activity' | 'trial' | 'training' | 'service_fee' | 'material';
export type CourseStatus = 'enabled' | 'disabled';

export interface LessonItem {
  id: string;
  title: string;
  name?: string; // 兼容展示别名
  duration: number; // 课时时长（分钟），如 45, 60, 90
  order: number; // 排序序号，1-based
  objective?: string; // 教学目标与重点
  pptUrl?: string; // PPT 课件下载地址
  codeTemplate?: string; // 代码工程/预设模板
  videoUrl?: string; // 录播或互动视频
  quizCount?: number; // 随堂互动练习数
  hasMedia?: boolean;
}

export interface CourseUnit {
  id: string;
  title: string;
  description?: string;
  order: number;
  lessons: LessonItem[];
}

export interface CourseItem {
  id: string;
  name: string;
  code: string;
  cover: string;
  pricePerLesson: number;
  totalLessons: number;
  subject: string;
  grade: string;
  attribute: CourseAttribute;
  status: CourseStatus;
  authorizedCampusIds: string[];
  type?: '常规' | '集训' | '考级' | '城市赛' | string; // 课程类型（常规课程、拓展集训、考级专训、城市挑赛）
  description?: string;
  standardDuration?: number; // 45 | 60 | 90 | 120
  maxCapacity?: number; // 满班人数
  year?: string; // 年份，如 '2025', '2026'
  period?: string; // 期段，如 '春季班', '秋季班', '暑期班', '寒假班'
  tags?: string[]; // 业务标签，如 ['授权', '扩科-实践-总部-软编']
  units?: CourseUnit[]; // 单元与课时编排
  createdAt?: string;
  updatedAt?: string;
}

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  targetAges: string;
  category: 'programming' | 'robotics' | 'science' | 'art';
  categoryName: string;
  courseCount: number;
  status: 'active' | 'archived';
  description?: string;
  syllabusVersion?: string;
  updatedAt?: string;
}

export interface LessonPlanItem {
  id: string;
  courseId: string;
  courseName: string;
  unitId: string;
  unitTitle: string;
  lessonId: string;
  lessonName: string;
  order: number;
  duration: number;
  targetAudience: string;
  pptVersion: string;
  codeType: 'Scratch' | 'Python' | 'C++' | 'Robotics' | 'Other';
  downloadCount: number;
  fileSize: string;
  updatedAt: string;
  status: 'published' | 'draft';
}

export interface CourseFilterQuery {
  grade?: string;
  attribute?: string;
  status?: string;
  subject?: string;
  year?: string;
  period?: string;
  keyword?: string;
  campusId?: string;
}
