// ==========================================
// 拓视未来教育「一校教培系统」教务排课与冲突引擎 Mock 数据库与业务服务
// 对应 PROJECT.md 与 MODULE_ANALYSIS_DESIGN.md
// ==========================================

import type {
  Classroom,
  Teacher,
  ClassItem,
  ScheduleEvent,
  AttendanceRecord,
  StudentAttendanceItem,
  CollisionResult,
  ConflictItem,
  LaneEvent,
  ScheduleSemanticType,
  LessonEvaluation,
  WorkbenchLessonCard,
  EvaluationTemplate
} from '@/types/educational'
import { MOCK_STUDENTS, saveAllStudentsToStorage } from './student'
import { MOCK_SYSTEM_USER_LIST, restoreSystemUsersFromStorage } from './system'

// -------------------------------------------------------------
// 1. 教室库 (5 大校区，包含大班教室、创客实验室、机房、VIP名师辅导室)
// -------------------------------------------------------------
export const CLASSROOMS_STORAGE_KEY = 'yixiao_mock_classrooms_v1'
export const MOCK_CLASSROOMS: Classroom[] = [
  // 总部校区
  { id: 'room-101', name: '乐博创客教室1', code: 'ROOM-HQ-01', campusId: 'campus-bj-hq', campusName: '总部校区', capacity: 16, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-102', name: '信息学竞赛机房A', code: 'ROOM-HQ-02', campusId: 'campus-bj-hq', campusName: '总部校区', capacity: 20, type: 'computer', typeName: '信息学编程机房', status: 'available' },
  { id: 'room-103', name: '机器人工程教室2', code: 'ROOM-HQ-03', campusId: 'campus-bj-hq', campusName: '总部校区', capacity: 12, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-104', name: 'VIP名师辅导室', code: 'ROOM-HQ-04', campusId: 'campus-bj-hq', campusName: '总部校区', capacity: 4, type: 'vip', typeName: 'VIP名师辅导室', status: 'available' },
  { id: 'room-105', name: '多媒体阶梯综合大教室', code: 'ROOM-HQ-05', campusId: 'campus-bj-hq', campusName: '总部校区', capacity: 36, type: 'regular', typeName: '多媒体大班教室', status: 'available' },

  // 远洋校区
  { id: 'room-201', name: '远洋创客工坊1', code: 'ROOM-YY-01', campusId: 'campus-bj-yy', campusName: '远洋校区', capacity: 16, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-202', name: 'Python编程机房B', code: 'ROOM-YY-02', campusId: 'campus-bj-yy', campusName: '远洋校区', capacity: 18, type: 'computer', typeName: '信息学编程机房', status: 'available' },
  { id: 'room-203', name: '远洋阶梯报告厅', code: 'ROOM-YY-03', campusId: 'campus-bj-yy', campusName: '远洋校区', capacity: 30, type: 'regular', typeName: '多媒体大班教室', status: 'available' },
  { id: 'room-204', name: '远洋VIP个辅室', code: 'ROOM-YY-04', campusId: 'campus-bj-yy', campusName: '远洋校区', capacity: 4, type: 'vip', typeName: 'VIP名师辅导室', status: 'available' },

  // 朝阳校区
  { id: 'room-301', name: '朝阳乐博创客室', code: 'ROOM-CY-01', campusId: 'campus-bj-cy', campusName: '朝阳校区', capacity: 14, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-302', name: '朝阳少儿算法机房', code: 'ROOM-CY-02', campusId: 'campus-bj-cy', campusName: '朝阳校区', capacity: 16, type: 'computer', typeName: '信息学编程机房', status: 'available' },
  { id: 'room-303', name: '朝阳综合大教室', code: 'ROOM-CY-03', campusId: 'campus-bj-cy', campusName: '朝阳校区', capacity: 25, type: 'regular', typeName: '多媒体大班教室', status: 'available' },

  // 海淀分校
  { id: 'room-401', name: '海淀奥赛集训机房', code: 'ROOM-HD-01', campusId: 'campus-bj-hd', campusName: '海淀分校', capacity: 24, type: 'computer', typeName: '信息学编程机房', status: 'available' },
  { id: 'room-402', name: '海淀机器人实训基地', code: 'ROOM-HD-02', campusId: 'campus-bj-hd', campusName: '海淀分校', capacity: 18, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-403', name: '海淀多功能答辩厅', code: 'ROOM-HD-03', campusId: 'campus-bj-hd', campusName: '海淀分校', capacity: 32, type: 'regular', typeName: '多媒体大班教室', status: 'available' },

  // 望京校区
  { id: 'room-501', name: '望京创客实操室', code: 'ROOM-WJ-01', campusId: 'campus-bj-wj', campusName: '望京校区', capacity: 15, type: 'maker', typeName: '乐博创客实验室', status: 'available' },
  { id: 'room-502', name: '望京图形化机房', code: 'ROOM-WJ-02', campusId: 'campus-bj-wj', campusName: '望京校区', capacity: 18, type: 'computer', typeName: '信息学编程机房', status: 'available' },
  { id: 'room-503', name: '望京VIP名师辅导室', code: 'ROOM-WJ-03', campusId: 'campus-bj-wj', campusName: '望京校区', capacity: 4, type: 'vip', typeName: 'VIP名师辅导室', status: 'available' }
]

export function saveClassroomsToStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CLASSROOMS_STORAGE_KEY, JSON.stringify(MOCK_CLASSROOMS))
  } catch (e) {
    console.warn('[Mock Classrooms] Failed to save classrooms to localStorage:', e)
  }
}

export function restoreClassroomsFromStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(CLASSROOMS_STORAGE_KEY)
    if (!raw) return
    const stored: Classroom[] = JSON.parse(raw)
    if (Array.isArray(stored) && stored.length > 0) {
      stored.forEach(item => {
        const idx = MOCK_CLASSROOMS.findIndex(c => c.id === item.id)
        if (idx >= 0) {
          MOCK_CLASSROOMS[idx] = { ...MOCK_CLASSROOMS[idx], ...item }
        } else {
          MOCK_CLASSROOMS.push(item)
        }
      })
    }
  } catch (e) {
    console.warn('[Mock Classrooms] Failed to restore classrooms from localStorage:', e)
  }
}

restoreClassroomsFromStorage()

export function addClassroom(item: Partial<Classroom>): Classroom {
  const newRoom: Classroom = {
    id: item.id || `room-${Date.now()}`,
    name: item.name || '新建教室',
    code: item.code || `ROOM-${Date.now().toString().slice(-4)}`,
    campusId: item.campusId || 'campus-bj-hq',
    campusName: item.campusName || '总部校区',
    capacity: item.capacity || 16,
    type: item.type || 'maker',
    typeName: item.typeName || (item.type === 'computer' ? '信息学编程机房' : item.type === 'vip' ? 'VIP名师辅导室' : item.type === 'regular' ? '多媒体大班教室' : '乐博创客实验室'),
    status: item.status || 'available'
  }
  MOCK_CLASSROOMS.unshift(newRoom)
  saveClassroomsToStorage()
  return newRoom
}


// -------------------------------------------------------------
// 2. 教师/教务人员库 (5 大校区)
// -------------------------------------------------------------
export const MOCK_TEACHERS: Teacher[] = [
  // 总部校区
  { id: 't-001', name: '张老师', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811112222', role: 'teacher', roleName: '高级编程讲师', subjects: ['Scratch', 'Python'], avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', maxWeeklyHours: 30, currentWeeklyHours: 18 },
  { id: 't-002', name: '李老师', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811113333', role: 'teacher', roleName: 'C++金牌金牌教练', subjects: ['C++', '信息学奥赛', '单片机'], avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', maxWeeklyHours: 32, currentWeeklyHours: 24 },
  { id: 't-003', name: '王老师', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811114444', role: 'teacher', roleName: '算法与人工智能讲师', subjects: ['Python', '数据科学', '单片机'], avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', maxWeeklyHours: 28, currentWeeklyHours: 16 },
  { id: 't-004', name: '刘老师', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811115555', role: 'teacher', roleName: '乐高机械启蒙主讲', subjects: ['KIRO大颗粒', '积木启蒙'], avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', maxWeeklyHours: 30, currentWeeklyHours: 20 },
  { id: 't-005', name: '赵老师', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811116666', role: 'teacher', roleName: 'EV3/单片机硬件导师', subjects: ['EV3机器人', '单片机实操'], avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', maxWeeklyHours: 30, currentWeeklyHours: 18 },
  { id: 't-006', name: '张学管', campusId: 'campus-bj-hq', campusName: '总部校区', phone: '13811117777', role: 'advisor', roleName: '资深教务班主任', subjects: ['综合教务'], avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100', maxWeeklyHours: 40, currentWeeklyHours: 35 },

  // 远洋校区
  { id: 't-101', name: '陈老师', campusId: 'campus-bj-yy', campusName: '远洋校区', phone: '13922221111', role: 'teacher', roleName: 'Python全栈讲师', subjects: ['Python', 'Web编程'], avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100', maxWeeklyHours: 30, currentWeeklyHours: 15 },
  { id: 't-102', name: '孙学管', campusId: 'campus-bj-yy', campusName: '远洋校区', phone: '13922223333', role: 'advisor', roleName: '远洋校区班主任', subjects: ['综合教务'], avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100', maxWeeklyHours: 40, currentWeeklyHours: 30 },

  // 朝阳校区
  { id: 't-201', name: '周老师', campusId: 'campus-bj-cy', campusName: '朝阳校区', phone: '13733331111', role: 'teacher', roleName: '创客积木教学组长', subjects: ['KIRO大颗粒', 'Scratch'], avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100', maxWeeklyHours: 32, currentWeeklyHours: 20 },
  { id: 't-202', name: '钱学管', campusId: 'campus-bj-cy', campusName: '朝阳校区', phone: '13733332222', role: 'advisor', roleName: '朝阳校区班主任', subjects: ['综合教务'], avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100', maxWeeklyHours: 40, currentWeeklyHours: 28 },

  // 海淀分校
  { id: 't-301', name: '黄老师', campusId: 'campus-bj-hd', campusName: '海淀分校', phone: '13644441111', role: 'teacher', roleName: '信奥金牌主讲', subjects: ['C++', '算法竞赛'], avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100', maxWeeklyHours: 30, currentWeeklyHours: 22 },

  // 望京校区
  { id: 't-401', name: '吴老师', campusId: 'campus-bj-wj', campusName: '望京校区', phone: '13555551111', role: 'teacher', roleName: '机器人工程主讲', subjects: ['EV3机器人', '电子单片机'], avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', maxWeeklyHours: 30, currentWeeklyHours: 16 }
]

// 默认提供纯净空集合供业务测试；可随时一键清空或一键恢复预设演示数据
// CLASSES_STORAGE_KEY declared at top
// SCHEDULES_STORAGE_KEY declared at top
export const ATTENDANCE_STORAGE_KEY = 'yixiao_mock_attendance_records_v1'
// EVALUATIONS_STORAGE_KEY declared at top

export const MOCK_CLASSES: ClassItem[] = []
export const MOCK_SCHEDULE_EVENTS: ScheduleEvent[] = []
export const MOCK_ATTENDANCE_RECORDS: AttendanceRecord[] = []
export const MOCK_LESSON_EVALUATIONS: LessonEvaluation[] = []

// -------------------------------------------------------------
// 3. 班级库 (20+ 真实班级覆盖 5 大校区与关联学员)
// -------------------------------------------------------------
export const PRESET_MOCK_CLASSES: ClassItem[] = [
  // 总部校区班级
  {
    id: 'class-scratch-101',
    code: 'CLS-HQ-SC-01',
    name: 'Scratch创意周末班 (周六 09:00)',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    teacherId: 't-001',
    teacherName: '张老师',
    assistantId: 't-006',
    assistantName: '张学管',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 16,
    currentStudentCount: 12,
    studentIds: ['std-001', 'std-006', 'std-007', 'std-008', 'std-009', 'std-010', 'std-011', 'std-012', 'std-013', 'std-014', 'std-015', 'std-016'],
    startDate: '2026-03-01',
    endDate: '2027-01-20',
    status: 'in_progress',
    scheduleDesc: '每周六 09:00-10:30',
    completedLessons: 18,
    totalLessons: 48,
    createdAt: '2026-02-15'
  },
  {
    id: 'class-scratch-102',
    code: 'CLS-HQ-SC-02',
    name: 'Scratch进阶周日班 (周日 10:30)',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    teacherId: 't-001',
    teacherName: '张老师',
    assistantId: 't-006',
    assistantName: '张学管',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 16,
    currentStudentCount: 15,
    studentIds: ['std-001', 'std-003', 'std-007', 'std-008'],
    startDate: '2026-03-01',
    endDate: '2027-01-20',
    status: 'in_progress',
    scheduleDesc: '每周日 10:30-12:00',
    completedLessons: 18,
    totalLessons: 48,
    createdAt: '2026-02-16'
  },
  {
    id: 'class-cpp-201',
    code: 'CLS-HQ-CPP-01',
    name: 'C++金牌1班-周六14:00',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    teacherId: 't-002',
    teacherName: '李老师',
    assistantId: 't-006',
    assistantName: '张学管',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    capacity: 15,
    currentStudentCount: 10,
    studentIds: ['std-002', 'std-005', 'std-017', 'std-018'],
    startDate: '2026-03-07',
    endDate: '2026-12-30',
    status: 'in_progress',
    scheduleDesc: '每周六 14:00-16:00',
    completedLessons: 16,
    totalLessons: 64,
    createdAt: '2026-02-20'
  },
  {
    id: 'class-mcu-202',
    code: 'CLS-HQ-MCU-01',
    name: '单片机2班-周六14:00 (冲突班)',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-002', // 同李老师产生时间冲突！
    teacherName: '李老师',
    assistantId: 't-006',
    assistantName: '张学管',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    capacity: 12,
    currentStudentCount: 10,
    studentIds: ['std-001', 'std-004'],
    startDate: '2026-03-07',
    endDate: '2026-12-30',
    status: 'in_progress',
    scheduleDesc: '每周六 14:00-16:00',
    completedLessons: 14,
    totalLessons: 48,
    createdAt: '2026-02-22'
  },
  {
    id: 'class-mcu-203',
    code: 'CLS-HQ-MCU-02',
    name: '2班-单片机周六2:30',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-104',
    classroomName: 'VIP名师辅导室',
    capacity: 4,
    currentStudentCount: 4,
    studentIds: ['std-003', 'std-008'],
    startDate: '2026-03-07',
    endDate: '2026-12-30',
    status: 'in_progress',
    scheduleDesc: '每周六 14:30-16:00',
    completedLessons: 12,
    totalLessons: 36,
    createdAt: '2026-02-23'
  },
  {
    id: 'class-kiro-204',
    code: 'CLS-HQ-KIRO-01',
    name: 'KIRO全年班周六上午',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 12,
    currentStudentCount: 8,
    studentIds: ['std-004', 'std-010'],
    startDate: '2026-03-07',
    endDate: '2027-01-15',
    status: 'in_progress',
    scheduleDesc: '每周六 09:30-11:00',
    completedLessons: 10,
    totalLessons: 32,
    createdAt: '2026-02-25'
  },
  {
    id: 'class-mcu-205',
    code: 'CLS-HQ-MCU-03',
    name: '单片机全年班 (小米科技园班)',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-105',
    classroomName: '多媒体阶梯综合大教室',
    capacity: 20,
    currentStudentCount: 18,
    studentIds: ['std-006', 'std-011', 'std-012'],
    startDate: '2026-03-07',
    endDate: '2027-01-15',
    status: 'in_progress',
    scheduleDesc: '每周六 09:30-11:30',
    completedLessons: 15,
    totalLessons: 48,
    createdAt: '2026-02-26'
  },
  {
    id: 'class-mcu-206',
    code: 'CLS-HQ-MCU-04',
    name: '1班-周六单片机4:30',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 16,
    currentStudentCount: 14,
    studentIds: ['std-007', 'std-013'],
    startDate: '2026-03-07',
    endDate: '2027-01-15',
    status: 'in_progress',
    scheduleDesc: '每周六 16:30-18:30',
    completedLessons: 12,
    totalLessons: 40,
    createdAt: '2026-02-27'
  },
  {
    id: 'class-kiro-207',
    code: 'CLS-HQ-KIRO-02',
    name: '周六 4:30KIRO启蒙探索',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    capacity: 12,
    currentStudentCount: 9,
    studentIds: ['std-004', 'std-014'],
    startDate: '2026-03-07',
    endDate: '2027-01-15',
    status: 'in_progress',
    scheduleDesc: '每周六 16:30-18:00',
    completedLessons: 12,
    totalLessons: 32,
    createdAt: '2026-02-28'
  },
  {
    id: 'class-mcu-208',
    code: 'CLS-HQ-MCU-05',
    name: '2班-单片机周日9:30',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 16,
    currentStudentCount: 12,
    studentIds: ['std-008', 'std-015'],
    startDate: '2026-03-08',
    endDate: '2027-01-16',
    status: 'in_progress',
    scheduleDesc: '每周日 09:30-11:30',
    completedLessons: 14,
    totalLessons: 48,
    createdAt: '2026-03-01'
  },
  {
    id: 'class-mcu-209',
    code: 'CLS-HQ-MCU-06',
    name: '单片机全年班(常规) -010班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    capacity: 20,
    currentStudentCount: 16,
    studentIds: ['std-002', 'std-016'],
    startDate: '2026-03-08',
    endDate: '2027-01-16',
    status: 'in_progress',
    scheduleDesc: '每周日 16:30-18:00',
    completedLessons: 14,
    totalLessons: 48,
    createdAt: '2026-03-02'
  },
  {
    id: 'class-python-210',
    code: 'CLS-HQ-PY-01',
    name: '我的专属辅导-Python1v1',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-104',
    classroomName: 'VIP名师辅导室',
    capacity: 2,
    currentStudentCount: 1,
    studentIds: ['std-002'],
    startDate: '2026-03-08',
    endDate: '2026-09-30',
    status: 'in_progress',
    scheduleDesc: '每周日 10:00-11:30',
    completedLessons: 20,
    totalLessons: 24,
    createdAt: '2026-03-03'
  },
  {
    id: 'class-recruiting-211',
    code: 'CLS-HQ-REC-01',
    name: '2026秋季新招-Scratch图形编程周六晨曦班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    capacity: 16,
    currentStudentCount: 6,
    studentIds: ['std-003', 'std-005'],
    startDate: '2026-10-10',
    endDate: '2027-06-30',
    status: 'recruiting',
    scheduleDesc: '每周六 08:00-09:30',
    completedLessons: 0,
    totalLessons: 48,
    createdAt: '2026-09-01'
  },
  {
    id: 'class-completed-212',
    code: 'CLS-HQ-CMP-01',
    name: '2026暑期信息学奥赛暑期集训营 (已结业)',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    capacity: 20,
    currentStudentCount: 20,
    studentIds: ['std-002', 'std-005', 'std-017'],
    startDate: '2026-07-01',
    endDate: '2026-08-30',
    status: 'completed',
    scheduleDesc: '每日 09:00-12:00',
    completedLessons: 40,
    totalLessons: 40,
    createdAt: '2026-06-15'
  },

  // 远洋校区班级
  {
    id: 'class-python-301',
    code: 'CLS-YY-PY-01',
    name: 'Python算法实战A班 (周六 16:00)',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    teacherId: 't-101',
    teacherName: '陈老师',
    assistantId: 't-102',
    assistantName: '孙学管',
    classroomId: 'room-202',
    classroomName: 'Python编程机房B',
    capacity: 12,
    currentStudentCount: 8,
    studentIds: ['std-003', 'std-008'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周六 16:00-17:30',
    completedLessons: 16,
    totalLessons: 36,
    createdAt: '2026-02-28'
  },
  {
    id: 'class-scratch-302',
    code: 'CLS-YY-SC-01',
    name: '远洋Scratch兴趣周日班',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    teacherId: 't-101',
    teacherName: '陈老师',
    classroomId: 'room-201',
    classroomName: '远洋创客工坊1',
    capacity: 16,
    currentStudentCount: 14,
    studentIds: ['std-001', 'std-003'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周日 14:00-15:30',
    completedLessons: 18,
    totalLessons: 48,
    createdAt: '2026-03-01'
  },

  // 朝阳校区班级
  {
    id: 'class-kiro-401',
    code: 'CLS-CY-KIRO-01',
    name: 'KIRO大颗粒机械启蒙1班 (周六 10:00)',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    teacherId: 't-201',
    teacherName: '周老师',
    assistantId: 't-202',
    assistantName: '钱学管',
    classroomId: 'room-301',
    classroomName: '朝阳乐博创客室',
    capacity: 10,
    currentStudentCount: 7,
    studentIds: ['std-004', 'std-010'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周六 10:00-11:30',
    completedLessons: 14,
    totalLessons: 32,
    createdAt: '2026-03-02'
  },
  {
    id: 'class-python-402',
    code: 'CLS-CY-PY-01',
    name: 'Python数据可视化B班 (周日 09:30)',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    teacherId: 't-201',
    teacherName: '周老师',
    classroomId: 'room-302',
    classroomName: '朝阳少儿算法机房',
    capacity: 12,
    currentStudentCount: 11,
    studentIds: ['std-003', 'std-009'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周日 09:30-11:00',
    completedLessons: 16,
    totalLessons: 36,
    createdAt: '2026-03-03'
  },

  // 海淀分校班级
  {
    id: 'class-cpp-501',
    code: 'CLS-HD-CPP-01',
    name: 'C++算法联赛1班 (周日 14:00)',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    teacherId: 't-301',
    teacherName: '黄老师',
    classroomId: 'room-401',
    classroomName: '海淀奥赛集训机房',
    capacity: 15,
    currentStudentCount: 14,
    studentIds: ['std-002', 'std-017', 'std-018'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周日 14:00-16:00',
    completedLessons: 18,
    totalLessons: 64,
    createdAt: '2026-03-04'
  },

  // 望京校区班级
  {
    id: 'class-ev3-601',
    code: 'CLS-WJ-EV3-01',
    name: 'EV3机器人工程实战1班 (周日 15:00)',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    teacherId: 't-401',
    teacherName: '吴老师',
    classroomId: 'room-501',
    classroomName: '望京创客实操室',
    capacity: 12,
    currentStudentCount: 9,
    studentIds: ['std-001', 'std-004', 'std-006'],
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'in_progress',
    scheduleDesc: '每周日 15:00-17:00',
    completedLessons: 15,
    totalLessons: 48,
    createdAt: '2026-03-05'
  }
]

// -------------------------------------------------------------
// 4. 排课日程库 (与设计稿 100% 对齐，覆盖 07:00-22:00，包含四色语义与冲突)
// -------------------------------------------------------------
export const PRESET_MOCK_SCHEDULE_EVENTS: ScheduleEvent[] = [
  // ----------------- 周一 2026-09-21 -----------------
  {
    id: 'evt-mon-001',
    classId: 'class-scratch-101',
    className: 'Scratch创意周末班 (补课班)',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-21',
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    semanticType: 'completed',
    classType: 'make_up',
    status: 'completed',
    lessonNumber: 19,
    lessonTitle: '第19讲：画笔模块与几何图形艺术',
    studentIds: ['std-001', 'std-006'],
    attendanceCount: 2,
    totalCount: 2
  },
  {
    id: 'evt-mon-002',
    classId: 'class-cpp-201',
    className: 'C++金牌1班-平时加练',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-21',
    startTime: '16:30',
    endTime: '18:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 17,
    lessonTitle: '第17讲：动态规划进阶与背包模型',
    studentIds: ['std-002', 'std-005'],
    attendanceCount: 0,
    totalCount: 2
  },

  // ----------------- 周二 2026-09-22 -----------------
  {
    id: 'evt-tue-001',
    classId: 'class-mcu-203',
    className: '单片机2班-周二加课',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-22',
    startTime: '14:00',
    endTime: '15:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 13,
    lessonTitle: '第13讲：蜂鸣器音阶与旋律演奏',
    studentIds: ['std-003', 'std-008'],
    attendanceCount: 0,
    totalCount: 2
  },

  // ----------------- 周三 2026-09-23 -----------------
  {
    id: 'evt-wed-001',
    classId: 'class-kiro-204',
    className: 'KIRO启蒙探索-公开试听课',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-23',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    semanticType: 'completed',
    classType: 'trial',
    status: 'completed',
    lessonNumber: 1,
    lessonTitle: '试听体验：旋转风车与齿轮传动',
    studentIds: ['std-004', 'std-010'],
    attendanceCount: 2,
    totalCount: 2
  },

  // ----------------- 周四 2026-09-24 -----------------
  {
    id: 'evt-thu-001',
    classId: 'class-python-210',
    className: '我的专属辅导-Python1v1',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-104',
    classroomName: 'VIP名师辅导室',
    date: '2026-09-24',
    startTime: '15:00',
    endTime: '16:30',
    durationMinutes: 90,
    semanticType: 'personal',
    isPersonal: true,
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 21,
    lessonTitle: '名师1v1：递归算法精析与回溯法实战',
    studentIds: ['std-002'],
    attendanceCount: 0,
    totalCount: 1
  },

  // ----------------- 周五 2026-09-25 -----------------
  {
    id: 'evt-fri-001',
    classId: 'class-scratch-101',
    className: 'Scratch创意周末班-周五辅导',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-25',
    startTime: '18:00',
    endTime: '19:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 19,
    lessonTitle: '课前预习讲练与答疑',
    studentIds: ['std-001', 'std-007'],
    attendanceCount: 0,
    totalCount: 2
  },

  // ----------------- 周六 2026-09-26 (截图高保真重现) -----------------
  // 08:00 时段
  {
    id: 'evt-sat-0800',
    classId: 'class-recruiting-211',
    className: '单片机周六8:00',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-26',
    startTime: '08:00',
    endTime: '09:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 1,
    lessonTitle: '第1讲：机器人机械传动与主控板认知',
    studentIds: ['std-003', 'std-005'],
    attendanceCount: 0,
    totalCount: 2
  },

  // 10:00 时段 (三列自适应并排)
  {
    id: 'evt-sat-1000-lane0',
    classId: 'class-mcu-205',
    className: '单片机全年班 (小米科技园班)',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-105',
    classroomName: '多媒体阶梯综合大教室',
    date: '2026-09-26',
    startTime: '09:30',
    endTime: '11:30',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 16,
    lessonTitle: '第16讲：多路红外循迹与障碍避让',
    studentIds: ['std-006', 'std-011', 'std-012'],
    attendanceCount: 0,
    totalCount: 3
  },
  {
    id: 'evt-sat-1000-lane1',
    classId: 'class-kiro-204',
    className: '周六 9:30KIRO启蒙探索',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-26',
    startTime: '09:30',
    endTime: '11:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 11,
    lessonTitle: '第11讲：机械天平与力的平衡原理',
    studentIds: ['std-004', 'std-010'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1000-lane2',
    classId: 'class-scratch-101',
    className: 'KIRO全年班周六上午',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-26',
    startTime: '09:30',
    endTime: '11:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 19,
    lessonTitle: '第19讲：克隆体的应用与雪花飘落进阶',
    studentIds: ['std-001', 'std-007', 'std-008'],
    attendanceCount: 0,
    totalCount: 3
  },

  // 14:00 时段 (四列并排，包含李老师同教师冲突 & 红色警示)
  {
    id: 'evt-sat-1400-c0',
    classId: 'class-cpp-201',
    className: '1班-单片机周六2:00',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002', // 李老师冲突！
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-26',
    startTime: '14:00',
    endTime: '16:00',
    durationMinutes: 120,
    hasConflict: true,
    conflictType: 'TEACHER_CONFLICT',
    conflictReason: '讲师 李老师 与课次 [单片机周六2:00(李)] 时间重叠冲突 (14:00-16:00)',
    semanticType: 'conflict',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 17,
    lessonTitle: '第17讲：最短路径 Dijkstra 堆优化',
    studentIds: ['std-002', 'std-005'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1400-c1',
    classId: 'class-mcu-202',
    className: '单片机周六2:00(李)',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002', // 李老师冲突！
    teacherName: '李老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-26',
    startTime: '14:00',
    endTime: '16:00',
    durationMinutes: 120,
    hasConflict: true,
    conflictType: 'TEACHER_CONFLICT',
    conflictReason: '讲师 李老师 与课次 [1班-单片机周六2:00] 时间重叠冲突 (14:00-16:00)',
    semanticType: 'conflict',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 15,
    lessonTitle: '第15讲：超声波测距传感器应用',
    studentIds: ['std-001', 'std-004'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1400-lane2',
    classId: 'class-mcu-203',
    className: '2班-单片机周六2:30',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-104',
    classroomName: 'VIP名师辅导室',
    date: '2026-09-26',
    startTime: '14:30',
    endTime: '16:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 13,
    lessonTitle: '第13讲：点阵LED屏动画绘制',
    studentIds: ['std-003', 'std-008'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1400-lane3',
    classId: 'class-kiro-204',
    className: 'KIRO全年班周六下午',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-26',
    startTime: '14:00',
    endTime: '15:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 12,
    lessonTitle: '第12讲：双足行走机械兽',
    studentIds: ['std-010', 'std-014'],
    attendanceCount: 0,
    totalCount: 2
  },

  // 17:00 时段 (四列并排)
  {
    id: 'evt-sat-1700-lane0',
    classId: 'class-mcu-206',
    className: '1班-周六单片机4:30',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-26',
    startTime: '16:30',
    endTime: '18:30',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 13,
    lessonTitle: '第13讲：电机调速与PWM控制',
    studentIds: ['std-007', 'std-013'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1700-lane1',
    classId: 'class-scratch-101',
    className: '2班-单片机周六4:30',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-26',
    startTime: '16:30',
    endTime: '18:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 20,
    lessonTitle: '第20讲：植物大战僵尸角色设计',
    studentIds: ['std-001', 'std-009'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1700-lane2',
    classId: 'class-cpp-201',
    className: '单片机周六4:30(李)',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-105',
    classroomName: '多媒体阶梯综合大教室',
    date: '2026-09-26',
    startTime: '16:30',
    endTime: '18:30',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 18,
    lessonTitle: '第18讲：线段树与区间修改真题训练',
    studentIds: ['std-002', 'std-018'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sat-1700-lane3',
    classId: 'class-kiro-207',
    className: '周六 4:30KIRO启蒙探索',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-26',
    startTime: '16:30',
    endTime: '18:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 13,
    lessonTitle: '第13讲：起重机与滑轮组原理',
    studentIds: ['std-004', 'std-014'],
    attendanceCount: 0,
    totalCount: 2
  },

  // ----------------- 周日 2026-09-27 (截图高保真重现) -----------------
  // 10:00 时段 (三列并排)
  {
    id: 'evt-sun-1000-lane0',
    classId: 'class-mcu-208',
    className: '2班-单片机周日9:30',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-005',
    teacherName: '赵老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-27',
    startTime: '09:30',
    endTime: '11:30',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 15,
    lessonTitle: '第15讲：光敏传感器与智能循光小车',
    studentIds: ['std-008', 'std-015'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sun-1000-lane1',
    classId: 'class-cpp-201',
    className: '单片机周日上午9:30',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-27',
    startTime: '09:30',
    endTime: '11:30',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 19,
    lessonTitle: '第19讲：树状数组与逆序对求解',
    studentIds: ['std-002', 'std-017'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sun-1000-lane2',
    classId: 'class-kiro-204',
    className: '周日 9:30KIRO启蒙探索',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-27',
    startTime: '09:30',
    endTime: '11:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 13,
    lessonTitle: '第13讲：弹性投石车实测',
    studentIds: ['std-004', 'std-010'],
    attendanceCount: 0,
    totalCount: 2
  },

  // 14:00 时段 (三列并排)
  {
    id: 'evt-sun-1400-lane0',
    classId: 'class-scratch-102',
    className: '2班-单片机周日2:00',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    teacherName: '张老师',
    classroomId: 'room-101',
    classroomName: '乐博创客教室1',
    date: '2026-09-27',
    startTime: '14:00',
    endTime: '15:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 19,
    lessonTitle: '第19讲：飞机大战敌机生成与弹幕',
    studentIds: ['std-001', 'std-003'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sun-1400-lane1',
    classId: 'class-mcu-205',
    className: '(小)周日下午2:30单片机全年班',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-003',
    teacherName: '王老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-27',
    startTime: '14:30',
    endTime: '16:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 16,
    lessonTitle: '第16讲：多路循线与自动转弯PID初探',
    studentIds: ['std-006', 'std-012'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sun-1400-lane2',
    classId: 'class-kiro-207',
    className: '周日 2:30KIRO启蒙探索',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-27',
    startTime: '14:30',
    endTime: '16:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 14,
    lessonTitle: '第14讲：机械手臂抓取结构',
    studentIds: ['std-004', 'std-014'],
    attendanceCount: 0,
    totalCount: 2
  },

  // 17:00 时段 (两列并排)
  {
    id: 'evt-sun-1700-lane0',
    classId: 'class-mcu-209',
    className: '单片机全年班(常规) -010班',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-002',
    teacherName: '李老师',
    classroomId: 'room-102',
    classroomName: '信息学竞赛机房A',
    date: '2026-09-27',
    startTime: '16:30',
    endTime: '18:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 15,
    lessonTitle: '第15讲：红外遥控解码与智能控制',
    studentIds: ['std-002', 'std-016'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-sun-1700-lane1',
    classId: 'class-kiro-207',
    className: '周日4:30KIRO启蒙探索',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-004',
    teacherName: '刘老师',
    classroomId: 'room-103',
    classroomName: '机器人工程教室2',
    date: '2026-09-27',
    startTime: '16:30',
    endTime: '18:00',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 15,
    lessonTitle: '第15讲：陀螺发射器与机械加速',
    studentIds: ['std-004', 'std-010'],
    attendanceCount: 0,
    totalCount: 2
  },

  // ----------------- 其他分校区排课样例 -----------------
  {
    id: 'evt-yy-001',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    teacherId: 't-101',
    teacherName: '陈老师',
    classroomId: 'room-202',
    classroomName: 'Python编程机房B',
    date: '2026-09-26',
    startTime: '16:00',
    endTime: '17:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 17,
    lessonTitle: '第17讲：Matplotlib 数据图表可视化',
    studentIds: ['std-003', 'std-008'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-cy-001',
    classId: 'class-kiro-401',
    className: 'KIRO大颗粒机械启蒙1班 (周六 10:00)',
    courseId: 'course-kiro-005',
    courseName: '202-中鸣积木KIRO启蒙探索课',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    teacherId: 't-201',
    teacherName: '周老师',
    classroomId: 'room-301',
    classroomName: '朝阳乐博创客室',
    date: '2026-09-26',
    startTime: '10:00',
    endTime: '11:30',
    durationMinutes: 90,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 15,
    lessonTitle: '第15讲：电动雨刷与四连杆机构',
    studentIds: ['std-004', 'std-010'],
    attendanceCount: 0,
    totalCount: 2
  },
  {
    id: 'evt-hd-001',
    classId: 'class-cpp-501',
    className: 'C++算法联赛1班 (周日 14:00)',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    teacherId: 't-301',
    teacherName: '黄老师',
    classroomId: 'room-401',
    classroomName: '海淀奥赛集训机房',
    date: '2026-09-27',
    startTime: '14:00',
    endTime: '16:00',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 19,
    lessonTitle: '第19讲：CSP-J 历年复赛真题冲刺',
    studentIds: ['std-002', 'std-017', 'std-018'],
    attendanceCount: 0,
    totalCount: 3
  },
  {
    id: 'evt-wj-001',
    classId: 'class-ev3-601',
    className: 'EV3机器人工程实战1班 (周日 15:00)',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    teacherId: 't-401',
    teacherName: '吴老师',
    classroomId: 'room-501',
    classroomName: '望京创客实操室',
    date: '2026-09-27',
    startTime: '15:00',
    endTime: '17:00',
    durationMinutes: 120,
    semanticType: 'regular',
    classType: 'formal',
    status: 'scheduled',
    lessonNumber: 16,
    lessonTitle: '第16讲：WRO 场地竞赛巡线任务攻关',
    studentIds: ['std-001', 'std-004', 'std-006'],
    attendanceCount: 0,
    totalCount: 3
  }
]

// -------------------------------------------------------------
// 5. 考勤点名课消记录库 (含已结课与反结课冲正机制)
// -------------------------------------------------------------
export const PRESET_MOCK_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: 'att-20260921-01',
    scheduleEventId: 'evt-mon-001',
    classId: 'class-scratch-101',
    className: 'Scratch创意周末班 (补课班)',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    date: '2026-09-21',
    startTime: '09:00',
    endTime: '10:30',
    lessonNumber: 19,
    lessonTitle: '第19讲：画笔模块与几何图形艺术',
    teacherId: 't-001',
    teacherName: '张老师',
    studentAttendances: [
      { studentId: 'std-001', studentName: '张小萌', studentNo: 'S948918', status: 'present', deductionLessons: 1, pricePerLesson: 280, actualDeductAmount: 280, remark: '准时出勤，掌握扎实' },
      { studentId: 'std-006', studentName: '陈思宇', studentNo: 'S334455', status: 'present', deductionLessons: 1, pricePerLesson: 280, actualDeductAmount: 280, remark: '表现积极' }
    ],
    totalStudents: 2,
    presentCount: 2,
    leaveCount: 0,
    absentCount: 0,
    lateCount: 0,
    deductedLessonsTotal: 2,
    isReversed: false,
    createdAt: '2026-09-21 10:35:00',
    operator: '张老师'
  },
  {
    id: 'att-20260920-01',
    scheduleEventId: 'evt-hist-001',
    classId: 'class-cpp-201',
    className: 'C++金牌1班-周六14:00',
    courseId: 'course-cpp-002',
    courseName: '001-信息学奥赛C++高阶培优班',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    date: '2026-09-20',
    startTime: '14:00',
    endTime: '16:00',
    lessonNumber: 16,
    lessonTitle: '第16讲：图论基础与邻接表存储',
    teacherId: 't-002',
    teacherName: '李老师',
    studentAttendances: [
      { studentId: 'std-002', studentName: '李浩轩', studentNo: 'S765585', status: 'present', deductionLessons: 1, pricePerLesson: 400, actualDeductAmount: 400, remark: '算法题解全部 AC' },
      { studentId: 'std-005', studentName: '周小可', studentNo: 'S112233', status: 'leave', deductionLessons: 0, pricePerLesson: 400, actualDeductAmount: 0, remark: '病假提前报备' }
    ],
    totalStudents: 2,
    presentCount: 1,
    leaveCount: 1,
    absentCount: 0,
    lateCount: 0,
    deductedLessonsTotal: 1,
    isReversed: false,
    createdAt: '2026-09-20 16:05:00',
    operator: '李老师'
  },
  {
    id: 'att-20260919-01',
    scheduleEventId: 'evt-hist-002',
    classId: 'class-python-301',
    className: 'Python算法实战A班 (周六 16:00)',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    date: '2026-09-19',
    startTime: '16:00',
    endTime: '17:30',
    lessonNumber: 15,
    lessonTitle: '第15讲：Pandas数据清洗与缺失值处理',
    teacherId: 't-101',
    teacherName: '陈老师',
    studentAttendances: [
      { studentId: 'std-003', studentName: '王紫涵', studentNo: 'S889920', status: 'present', deductionLessons: 1, pricePerLesson: 300, actualDeductAmount: 300, remark: '完成独立清洗项目' }
    ],
    totalStudents: 1,
    presentCount: 1,
    leaveCount: 0,
    absentCount: 0,
    lateCount: 0,
    deductedLessonsTotal: 1,
    isReversed: true, // 历史反结课记录测试
    reversedAt: '2026-09-19 18:30:00',
    reversedBy: '教务主管',
    reversalReason: '家长反映因暴雨迟到未参加，经核实后教务冲正退还课时',
    createdAt: '2026-09-19 17:35:00',
    operator: '陈老师'
  }
]

// -------------------------------------------------------------
// 6. 三维冲突检测与 Lane 排课算法引擎 (与 contract 100% 对齐)
// -------------------------------------------------------------

export class EducationalCollisionEngine {
  /**
   * 将 HH:mm 格式时间转换为从 00:00 起始的分钟数
   */
  static parseTimeToMinutes(hhmm: string): number {
    if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) {
      throw new Error(`Invalid time format: ${hhmm}, expected HH:mm`)
    }
    const [h, m] = hhmm.split(':').map(Number)
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new Error(`Invalid time value: ${hhmm}`)
    }
    return h * 60 + m
  }

  /**
   * 半闭半开区间重叠算法: max(sA, sB) < min(eA, eB)
   */
  static isOverlapping(startA: string | number, endA: string | number, startB: string | number, endB: string | number): boolean {
    const sA = typeof startA === 'string' ? this.parseTimeToMinutes(startA) : startA
    const eA = typeof endA === 'string' ? this.parseTimeToMinutes(endA) : endA
    const sB = typeof startB === 'string' ? this.parseTimeToMinutes(startB) : startB
    const eB = typeof endB === 'string' ? this.parseTimeToMinutes(endB) : endB

    if (eA <= sA || eB <= sB) {
      throw new Error('End time must be strictly after start time')
    }

    return Math.max(sA, sB) < Math.min(eA, eB)
  }

  /**
   * 07:00 ~ 22:00 排课时间窗口合法性与跨午夜校验
   */
  static validateScheduleTimeWindow(startTime: string, endTime: string): { valid: boolean; reason?: string; durationMinutes?: number } {
    const startMin = this.parseTimeToMinutes(startTime)
    const endMin = this.parseTimeToMinutes(endTime)

    if (endMin <= startMin) {
      return { valid: false, reason: 'End time must be strictly after start time' }
    }

    const DAY_START = 7 * 60 // 420 (07:00)
    const DAY_END = 22 * 60  // 1320 (22:00)

    if (startMin < DAY_START) {
      return { valid: false, reason: 'Schedule start time cannot be earlier than 07:00' }
    }
    if (endMin > DAY_END) {
      return { valid: false, reason: 'Schedule end time cannot exceed 22:00 (cross-midnight or overtime blocked)' }
    }

    return { valid: true, durationMinutes: endMin - startMin }
  }

  /**
   * 三维冲突检测核心算法 (讲师冲突、教室占用与容量超限冲突、学员并发冲突)
   */
  static detectCollision(
    targetEvent: Partial<ScheduleEvent> & { startTime: string; endTime: string; date: string },
    existingEvents: ScheduleEvent[] = MOCK_SCHEDULE_EVENTS,
    classrooms: Record<string, Classroom> | Classroom[] = MOCK_CLASSROOMS
  ): CollisionResult {
    const timeCheck = this.validateScheduleTimeWindow(targetEvent.startTime, targetEvent.endTime)
    if (!timeCheck.valid) {
      return {
        hasConflict: true,
        conflictType: 'TIME_WINDOW_VIOLATION',
        reason: timeCheck.reason,
        conflicts: [{ type: 'TIME_WINDOW_VIOLATION', reason: timeCheck.reason || '时间窗口非法' }]
      }
    }

    // 教室容量校验
    const classroomMap: Record<string, Classroom> = Array.isArray(classrooms)
      ? classrooms.reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
      : classrooms

    if (targetEvent.classroomId && classroomMap[targetEvent.classroomId]) {
      const maxCap = classroomMap[targetEvent.classroomId].capacity
      const studentCount = (targetEvent.studentIds || []).length
      if (maxCap && studentCount > maxCap) {
        const reason = `Classroom capacity is ${maxCap}, but ${studentCount} students assigned`
        return {
          hasConflict: true,
          conflictType: 'CLASSROOM_CAPACITY_EXCEEDED',
          reason,
          conflicts: [{ type: 'CLASSROOM_CAPACITY_EXCEEDED', classroomId: targetEvent.classroomId, reason }]
        }
      }
    }

    const conflicts: ConflictItem[] = []
    const tStart = this.parseTimeToMinutes(targetEvent.startTime)
    const tEnd = this.parseTimeToMinutes(targetEvent.endTime)

    for (const event of existingEvents) {
      if (targetEvent.excludeEventId && event.id === targetEvent.excludeEventId) {
        continue
      }
      if (targetEvent.id && event.id === targetEvent.id) {
        continue
      }
      if (targetEvent.date !== event.date) {
        continue
      }

      const eStart = this.parseTimeToMinutes(event.startTime)
      const eEnd = this.parseTimeToMinutes(event.endTime)

      if (!this.isOverlapping(tStart, tEnd, eStart, eEnd)) {
        continue
      }

      // 1. 讲师冲突
      if (targetEvent.teacherId && event.teacherId && targetEvent.teacherId === event.teacherId) {
        conflicts.push({
          type: 'TEACHER_CONFLICT',
          eventId: event.id,
          teacherId: targetEvent.teacherId,
          reason: `Teacher ${targetEvent.teacherId} is already booked for event ${event.id} from ${event.startTime} to ${event.endTime}`
        })
      }

      // 2. 教室占用冲突
      if (targetEvent.classroomId && event.classroomId && targetEvent.classroomId === event.classroomId) {
        conflicts.push({
          type: 'CLASSROOM_CONFLICT',
          eventId: event.id,
          classroomId: targetEvent.classroomId,
          reason: `Classroom ${targetEvent.classroomId} is occupied by event ${event.id} from ${event.startTime} to ${event.endTime}`
        })
      }

      // 3. 学员排课冲突
      if (Array.isArray(targetEvent.studentIds) && Array.isArray(event.studentIds)) {
        const overlappingStudents = targetEvent.studentIds.filter(id => event.studentIds.includes(id))
        if (overlappingStudents.length > 0) {
          conflicts.push({
            type: 'STUDENT_CONFLICT',
            eventId: event.id,
            studentIds: overlappingStudents,
            reason: `Students [${overlappingStudents.join(', ')}] already scheduled in event ${event.id}`
          })
        }
      }
    }

    const hasConflict = conflicts.length > 0
    return {
      hasConflict,
      conflicts,
      conflictType: conflicts[0]?.type,
      reason: hasConflict ? conflicts.map(c => c.reason).join('; ') : null,
      teacherConflict: conflicts.some(c => c.type === 'TEACHER_CONFLICT'),
      classroomConflict: conflicts.some(c => c.type === 'CLASSROOM_CONFLICT'),
      studentConflicts: conflicts
        .filter(c => c.type === 'STUDENT_CONFLICT')
        .flatMap(c => c.studentIds || []),
      conflictingEvents: existingEvents.filter(e => conflicts.some(c => c.eventId === e.id))
    }
  }

  /**
   * Lane 染色多列自适应并列排布算法 (最大 4 列)
   */
  static allocateLanes(eventsOnSameDay: ScheduleEvent[], maxLanes = 4): LaneEvent[] {
    if (!eventsOnSameDay || eventsOnSameDay.length === 0) return []

    // 按开始时间正序，结束时间倒序排列
    const sorted = [...eventsOnSameDay].map(e => ({
      ...e,
      startMin: this.parseTimeToMinutes(e.startTime),
      endMin: this.parseTimeToMinutes(e.endTime),
      laneIndex: 0
    })).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

    // 计算联通重叠组 (Overlap Clusters)
    const clusters: (typeof sorted)[] = []
    let currentCluster: typeof sorted = []
    let clusterEnd = -1

    for (const evt of sorted) {
      if (currentCluster.length === 0) {
        currentCluster.push(evt)
        clusterEnd = evt.endMin
      } else {
        if (evt.startMin < clusterEnd) {
          currentCluster.push(evt)
          clusterEnd = Math.max(clusterEnd, evt.endMin)
        } else {
          clusters.push(currentCluster)
          currentCluster = [evt]
          clusterEnd = evt.endMin
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster)
    }

    const result: LaneEvent[] = []

    // 对每个重叠群进行贪心染色 Lane 分配
    for (const cluster of clusters) {
      const laneEndTimes: number[] = []

      for (const evt of cluster) {
        let placedLane = -1
        for (let l = 0; l < laneEndTimes.length; l++) {
          if (laneEndTimes[l] <= evt.startMin) {
            placedLane = l
            laneEndTimes[l] = evt.endMin
            break
          }
        }
        if (placedLane === -1) {
          placedLane = laneEndTimes.length
          laneEndTimes.push(evt.endMin)
        }
        evt.laneIndex = placedLane
      }

      const totalLanes = Math.min(laneEndTimes.length, maxLanes)
      const laneWidthPercent = Number((100 / totalLanes).toFixed(2))

      for (const evt of cluster) {
        const lane = Math.min(evt.laneIndex, totalLanes - 1)
        const topPx = (evt.startMin - 420) // 07:00 起始，1小时60px => 1分钟1px
        const heightPx = (evt.endMin - evt.startMin)
        const leftPercent = Number((lane * laneWidthPercent).toFixed(2))

        result.push({
          id: evt.id,
          date: evt.date,
          startTime: evt.startTime,
          endTime: evt.endTime,
          laneIndex: lane,
          totalLanes,
          style: {
            top: `${topPx}px`,
            height: `${heightPx}px`,
            width: `${laneWidthPercent}%`,
            left: `${leftPercent}%`
          },
          event: evt
        })
      }
    }

    return result
  }

  /**
   * 四色语义 Chip 判定
   */
  static getSemanticChipStyle(event: Partial<ScheduleEvent> & { hasConflict?: boolean; status?: string; isFinished?: boolean; isPersonal?: boolean; type?: string; semanticType?: ScheduleSemanticType }) {
    if (event.hasConflict || event.semanticType === 'conflict') {
      return {
        type: 'conflict',
        badge: '冲突',
        background: '#FEF0F0',
        borderColor: '#F56C6C',
        color: '#F56C6C'
      }
    }
    if (event.status === 'completed' || event.isFinished || event.semanticType === 'completed') {
      return {
        type: 'completed',
        badge: '已上',
        background: '#F0F9EB',
        borderColor: '#67C23A',
        color: '#67C23A'
      }
    }
    if (event.isPersonal || event.type === 'personal' || event.semanticType === 'personal') {
      return {
        type: 'personal',
        badge: '个人',
        background: '#F9F0FF',
        borderColor: '#722ED1',
        color: '#722ED1'
      }
    }
    return {
      type: 'regular',
      badge: '正',
      background: '#ECF5FF',
      borderColor: '#409EFF',
      color: '#409EFF'
    }
  }
}

// -------------------------------------------------------------
// 7. 核心业务服务与操作函数 (CRUD, 点名消课, 反结课冲正, 批量排课)
// -------------------------------------------------------------

/**
 * 查询排课日程
 */
export function getScheduleEvents(params?: {
  campusId?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  teacherName?: string;
  classroomId?: string;
  courseId?: string;
  status?: string;
}): ScheduleEvent[] {
  restoreClassesFromStorage()
  restoreSchedulesFromStorage()
  purgeOrphanScheduleEvents()

  // 动态对齐排课日程关联班级的最新课程与班级信息（自动修正历史快照）
  const classMap = new Map(MOCK_CLASSES.map(c => [c.id, c]))
  let schedulesModified = false
  for (const e of MOCK_SCHEDULE_EVENTS) {
    if (e.classId && classMap.has(e.classId)) {
      const cls = classMap.get(e.classId)!
      if (cls.courseName && e.courseName !== cls.courseName) {
        e.courseName = cls.courseName
        schedulesModified = true
      }
      if (cls.courseId && e.courseId !== cls.courseId) {
        e.courseId = cls.courseId
        schedulesModified = true
      }
      if (cls.name && e.className !== cls.name) {
        e.className = cls.name
        schedulesModified = true
      }
    }
  }
  if (schedulesModified) {
    syncCustomSchedulesToStorage()
  }

  let list = MOCK_SCHEDULE_EVENTS.filter(e => {
    // 严密防线：若日程关联了班级，但该班级已不存在（已被删除），则不属于有效排课
    if (e.classId && e.classId !== 'class-custom' && !e.isPersonal) {
      return MOCK_CLASSES.some(c => c.id === e.classId)
    }
    return true
  })

  if (params?.campusId && params.campusId !== 'campus-bj-hq' && params.campusId !== 'HQ001') {
    list = list.filter(e => e.campusId === params.campusId)
  }
  if (params?.startDate && params?.endDate) {
    list = list.filter(e => e.date >= params.startDate! && e.date <= params.endDate!)
  }
  if (params?.teacherId) {
    const pTeacherId = params.teacherId.trim()
    const pTeacherName = params.teacherName?.trim()
    const allTeachers = getTeachers()
    const matchedTeacherObj = allTeachers.find(t => (pTeacherId && t.id === pTeacherId) || (pTeacherName && t.name === pTeacherName))
    list = list.filter(e => {
      const matchId = e.teacherId === pTeacherId || (matchedTeacherObj && e.teacherId === matchedTeacherObj.id)
      const matchName = pTeacherName && (e.teacherName === pTeacherName || (matchedTeacherObj && e.teacherName === matchedTeacherObj.name))
      return matchId || matchName
    })
  }
  if (params?.classroomId) {
    list = list.filter(e => e.classroomId === params.classroomId)
  }
  if (params?.courseId) {
    list = list.filter(e => e.courseId === params.courseId)
  }
  if (params?.status) {
    list = list.filter(e => e.status === params.status)
  }

  return list
}

/**
 * 添加排课课次 (包含三维防撞检测)
 */
export function addScheduleEvent(payload: Partial<ScheduleEvent>, forceIfConflict = false): {
  success: boolean;
  event?: ScheduleEvent;
  collision?: CollisionResult;
  message?: string;
} {
  if (!payload.date || !payload.startTime || !payload.endTime) {
    return { success: false, message: '上课日期与起止时间为必填项' }
  }

  const collision = EducationalCollisionEngine.detectCollision(
    payload as any,
    MOCK_SCHEDULE_EVENTS,
    MOCK_CLASSROOMS
  )

  if (collision.hasConflict && !forceIfConflict) {
    return {
      success: false,
      collision,
      message: `检测到排课冲突：${collision.reason}`
    }
  }

  const startMin = EducationalCollisionEngine.parseTimeToMinutes(payload.startTime)
  const endMin = EducationalCollisionEngine.parseTimeToMinutes(payload.endTime)
  const duration = endMin - startMin

  const semanticType: ScheduleSemanticType = collision.hasConflict
    ? 'conflict'
    : payload.isPersonal
    ? 'personal'
    : (payload.semanticType || 'regular')

  const newEvent: ScheduleEvent = {
    id: payload.id || `evt-${Date.now()}`,
    classId: payload.classId || 'class-custom',
    className: payload.className || '自定义排课班级',
    courseId: payload.courseId || 'course-custom',
    courseName: payload.courseName || '自定义课程',
    campusId: payload.campusId || 'campus-bj-hq',
    campusName: payload.campusName || '总部校区',
    teacherId: payload.teacherId || 't-001',
    teacherName: payload.teacherName || '张老师',
    assistantId: payload.assistantId,
    assistantName: payload.assistantName,
    classroomId: payload.classroomId || 'room-101',
    classroomName: payload.classroomName || '乐博创客教室1',
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    durationMinutes: duration,
    studentIds: payload.studentIds || [],
    hasConflict: collision.hasConflict,
    conflictType: collision.conflictType,
    conflictReason: collision.reason || undefined,
    semanticType,
    classType: payload.classType || 'formal',
    status: payload.status || 'scheduled',
    lessonNumber: payload.lessonNumber || 1,
    lessonTitle: payload.lessonTitle || `第${payload.lessonNumber || 1}讲`,
    attendanceCount: 0,
    totalCount: (payload.studentIds || []).length
  }

  MOCK_SCHEDULE_EVENTS.push(newEvent)
  syncCustomSchedulesToStorage()
  return { success: true, event: newEvent, collision }
}

/**
 * 修改排课课次
 */
export function updateScheduleEvent(id: string, patch: Partial<ScheduleEvent>): {
  success: boolean;
  event?: ScheduleEvent;
  collision?: CollisionResult;
  message?: string;
} {
  const index = MOCK_SCHEDULE_EVENTS.findIndex(e => e.id === id)
  if (index === -1) {
    return { success: false, message: '未找到对应排课课次' }
  }

  const existing = MOCK_SCHEDULE_EVENTS[index]
  const updated = { ...existing, ...patch }

  const collision = EducationalCollisionEngine.detectCollision(
    { ...updated, excludeEventId: id } as any,
    MOCK_SCHEDULE_EVENTS,
    MOCK_CLASSROOMS
  )

  updated.hasConflict = collision.hasConflict
  updated.conflictType = collision.conflictType
  updated.conflictReason = collision.reason || undefined
  if (collision.hasConflict) {
    updated.semanticType = 'conflict'
  }

  if (patch.startTime && patch.endTime) {
    const s = EducationalCollisionEngine.parseTimeToMinutes(patch.startTime)
    const e = EducationalCollisionEngine.parseTimeToMinutes(patch.endTime)
    updated.durationMinutes = e - s
  }

  MOCK_SCHEDULE_EVENTS[index] = updated
  syncCustomSchedulesToStorage()
  return { success: true, event: updated, collision }
}

/**
 * 删除/取消排课
 */
export function deleteScheduleEvent(id: string): boolean {
  const index = MOCK_SCHEDULE_EVENTS.findIndex(e => e.id === id)
  if (index >= 0) {
    MOCK_SCHEDULE_EVENTS.splice(index, 1)
    syncCustomSchedulesToStorage()
    return true
  }
  return false
}

/**
 * 讲台授课点名消课结算 (真实联动扣减学员课包与写入消课流水)
 */
export function submitRollCall(
  scheduleEventId: string,
  attendances: StudentAttendanceItem[],
  operator = '教务主管'
): {
  success: boolean;
  attendanceRecord?: AttendanceRecord;
  message: string;
} {
  const event = MOCK_SCHEDULE_EVENTS.find(e => e.id === scheduleEventId)
  if (!event) {
    return { success: false, message: '排课课次不存在' }
  }

  let presentCount = 0
  let leaveCount = 0
  let absentCount = 0
  let lateCount = 0
  let deductedLessonsTotal = 0

  // 1. 真实扣减学员在 MOCK_STUDENTS 中的课包
  for (const att of attendances) {
    if (att.status === 'present') presentCount++
    else if (att.status === 'leave') leaveCount++
    else if (att.status === 'absent') absentCount++
    else if (att.status === 'late') lateCount++

    deductedLessonsTotal += att.deductionLessons || 0

    const student = MOCK_STUDENTS.find(s => s.id === att.studentId)
    if (student && student.coursePackages && student.coursePackages.length > 0) {
      // 匹配当前课程或班级所属课包
      const pkg = student.coursePackages.find(p => p.courseId === event.courseId || p.classId === event.classId) || student.coursePackages[0]
      if (pkg) {
        att.remainingLessonsBefore = pkg.remainingLessons
        if (att.deductionLessons > 0) {
          pkg.remainingLessons = Math.max(0, pkg.remainingLessons - att.deductionLessons)
          pkg.consumedLessons = (pkg.consumedLessons || 0) + att.deductionLessons
          att.remainingLessonsAfter = pkg.remainingLessons
          att.pricePerLesson = pkg.pricePerLesson || 280
          att.actualDeductAmount = (att.pricePerLesson || 280) * att.deductionLessons

          // 写入学员上课记录
          if (!student.learningRecords) student.learningRecords = []
          student.learningRecords.unshift({
            id: `lr-${Date.now()}-${att.studentId}`,
            date: event.date,
            lessonName: `第${event.lessonNumber || 1}讲：${event.lessonTitle || event.courseName}`,
            courseName: event.courseName,
            teacher: event.teacherName,
            status: att.status === 'present' ? 'attended' : (att.status as any),
            score: att.status === 'present' ? 95 : 0,
            comment: att.remark || (att.status === 'present' ? '上课专注，实操任务达成优秀。' : '请假/缺席。'),
            homeworkRating: 'A'
          })
        }
      }
    }
  }

  // 2. 更新日程课次状态为 completed
  event.status = 'completed'
  event.semanticType = 'completed'
  event.attendanceCount = presentCount + lateCount

  // 3. 生成并持久化考勤课消明细
  const attendanceRecord: AttendanceRecord = {
    id: `att-${Date.now()}`,
    scheduleEventId: event.id,
    classId: event.classId || '',
    className: event.className,
    courseId: event.courseId,
    courseName: event.courseName,
    campusId: event.campusId,
    campusName: event.campusName,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    lessonNumber: event.lessonNumber || 1,
    lessonTitle: event.lessonTitle || event.className,
    teacherId: event.teacherId,
    teacherName: event.teacherName,
    studentAttendances: attendances,
    totalStudents: attendances.length,
    presentCount,
    leaveCount,
    absentCount,
    lateCount,
    deductedLessonsTotal,
    isReversed: false,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    operator
  }

  MOCK_ATTENDANCE_RECORDS.unshift(attendanceRecord)
  saveAllStudentsToStorage()
  syncCustomAttendanceToStorage()
  syncCustomSchedulesToStorage()

  return {
    success: true,
    attendanceRecord,
    message: `点名消课成功：应到 ${attendances.length} 人，实到 ${presentCount + lateCount} 人，共计消课 ${deductedLessonsTotal} 课时！`
  }
}

/**
 * 反结课冲正机制 (Revert Attendance Lesson)
 * 将已扣减的课时退还冲正回学员课包，记录变更为“已反结课”
 */
export function revertAttendance(
  attendanceRecordId: string,
  reversalReason = '客诉纠纷/误操作申请反结课冲正',
  operator = '教务主管'
): {
  success: boolean;
  message: string;
  record?: AttendanceRecord;
} {
  const record = MOCK_ATTENDANCE_RECORDS.find(r => r.id === attendanceRecordId)
  if (!record) {
    return { success: false, message: '未找到指定考勤记录' }
  }

  if (record.isReversed) {
    return { success: false, message: '该考勤记录已被反结课冲正，不可重复操作' }
  }

  // 1. 将扣减的课时原路退还学员课包
  for (const att of record.studentAttendances) {
    if (att.deductionLessons && att.deductionLessons > 0) {
      const student = MOCK_STUDENTS.find(s => s.id === att.studentId)
      if (student && student.coursePackages) {
        const pkg = student.coursePackages.find(p => p.courseId === record.courseId || p.classId === record.classId) || student.coursePackages[0]
        if (pkg) {
          pkg.remainingLessons += att.deductionLessons
          pkg.consumedLessons = Math.max(0, (pkg.consumedLessons || 0) - att.deductionLessons)
        }
      }
    }
  }

  // 2. 状态标记为已冲正
  record.isReversed = true
  record.reversedAt = new Date().toISOString().replace('T', ' ').substring(0, 19)
  record.reversedBy = operator
  record.reversalReason = reversalReason

  // 3. 将对应课次恢复为 scheduled 待上状态
  const event = MOCK_SCHEDULE_EVENTS.find(e => e.id === record.scheduleEventId)
  if (event) {
    event.status = 'scheduled'
    event.semanticType = event.hasConflict ? 'conflict' : 'regular'
    event.attendanceCount = 0
  }

  saveAllStudentsToStorage()
  syncCustomAttendanceToStorage()
  syncCustomSchedulesToStorage()

  return {
    success: true,
    message: `反结课冲正成功！已将 ${record.deductedLessonsTotal} 课时原路退还回学员课包账户。`,
    record
  }
}

/**
 * 获取考勤记录列表
 */
export function getAttendanceRecords(campusId?: string, classId?: string): AttendanceRecord[] {
  restoreAttendanceFromStorage()
  restoreClassesFromStorage()

  const classMap = new Map(MOCK_CLASSES.map(c => [c.id, c]))
  for (const att of MOCK_ATTENDANCE_RECORDS) {
    if (att.classId && classMap.has(att.classId)) {
      const cls = classMap.get(att.classId)!
      if (cls.courseName && att.courseName !== cls.courseName) {
        att.courseName = cls.courseName
      }
      if (cls.name && att.className !== cls.name) {
        att.className = cls.name
      }
    }
  }

  let list = [...MOCK_ATTENDANCE_RECORDS]
  if (campusId && campusId !== 'campus-bj-hq' && campusId !== 'HQ001') {
    list = list.filter(r => r.campusId === campusId)
  }
  if (classId) {
    list = list.filter(r => r.classId === classId)
  }
  return list
}

export const CLASSES_STORAGE_KEY = 'yixiao_mock_classes_v2'

export function syncCustomClassesToStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(MOCK_CLASSES))
    } catch (e) {
      console.warn('[Mock Classes] Failed to sync classes to localStorage:', e)
    }
  }
}

export function restoreClassesFromStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const isCleared = localStorage.getItem('yixiao_mock_data_cleared') === 'true'
      const migrated = localStorage.getItem('yixiao_mock_v5_cleared')
      if (!migrated) {
        localStorage.removeItem(CLASSES_STORAGE_KEY)
        return
      }
      if (isCleared) {
        const saved = localStorage.getItem(CLASSES_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            MOCK_CLASSES.length = 0
            MOCK_CLASSES.push(...parsed)
          }
        }
        return
      }
      const saved = localStorage.getItem(CLASSES_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          MOCK_CLASSES.length = 0
          MOCK_CLASSES.push(...parsed)
        }
      }
    } catch (e) {
      console.warn('[Mock Classes] Failed to restore classes from localStorage:', e)
    }
  }
}

// 初始化时自动恢复
restoreClassesFromStorage()

/**
 * 班级管理 CRUD
 */
export function getClasses(params?: {
  campusId?: string;
  search?: string;
  status?: string;
  teacherId?: string;
  teacherName?: string;
}) {
  restoreClassesFromStorage()
  let list = [...MOCK_CLASSES]
  if (params?.campusId && params.campusId !== 'campus-bj-hq' && params.campusId !== 'HQ001') {
    list = list.filter(c => c.campusId === params.campusId)
  }
  if (params?.status) {
    list = list.filter(c => c.status === params.status)
  }
  if (params?.teacherId) {
    const pTeacherId = params.teacherId.trim()
    const pTeacherName = params.teacherName?.trim()
    const allTeachers = getTeachers()
    const matchedTeacherObj = allTeachers.find(t => (pTeacherId && t.id === pTeacherId) || (pTeacherName && t.name === pTeacherName))
    list = list.filter(c => {
      const matchId = c.teacherId === pTeacherId || (matchedTeacherObj && c.teacherId === matchedTeacherObj.id)
      const matchName = pTeacherName && (c.teacherName === pTeacherName || (matchedTeacherObj && c.teacherName === matchedTeacherObj.name))
      return matchId || matchName
    })
  }
  if (params?.search) {
    const s = params.search.toLowerCase()
    list = list.filter(c => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s))
  }
  return list
}

export function getClassById(id: string): ClassItem | undefined {
  restoreClassesFromStorage()
  return MOCK_CLASSES.find(c => c.id === id)
}

// 供排课事件与考勤持久化 Key
export const SCHEDULES_STORAGE_KEY = 'yixiao_mock_schedules_custom'

export function syncCustomSchedulesToStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(MOCK_SCHEDULE_EVENTS))
    } catch (e) {
      console.warn('[Mock Schedules] Failed to sync schedules to localStorage:', e)
    }
  }
}

export function restoreSchedulesFromStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const isCleared = localStorage.getItem('yixiao_mock_data_cleared') === 'true'
      const migrated = localStorage.getItem('yixiao_mock_v5_cleared')
      if (!migrated) {
        localStorage.removeItem(SCHEDULES_STORAGE_KEY)
        return
      }
      const saved = localStorage.getItem(SCHEDULES_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          MOCK_SCHEDULE_EVENTS.length = 0
          MOCK_SCHEDULE_EVENTS.push(...parsed)
        }
      }
    } catch (e) {
      console.warn('[Mock Schedules] Failed to restore schedules from localStorage:', e)
    }
  }
}

export function syncCustomAttendanceToStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(MOCK_ATTENDANCE_RECORDS))
    } catch (e) {
      console.warn('[Mock Attendance] Failed to sync attendance to localStorage:', e)
    }
  }
}

export function restoreAttendanceFromStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const isCleared = localStorage.getItem('yixiao_mock_data_cleared') === 'true'
      const migrated = localStorage.getItem('yixiao_mock_v5_cleared')
      if (!migrated) {
        localStorage.removeItem(ATTENDANCE_STORAGE_KEY)
        return
      }
      const saved = localStorage.getItem(ATTENDANCE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          MOCK_ATTENDANCE_RECORDS.length = 0
          MOCK_ATTENDANCE_RECORDS.push(...parsed)
        }
      }
    } catch (e) {
      console.warn('[Mock Attendance] Failed to restore attendance from localStorage:', e)
    }
  }
}

export function purgeOrphanScheduleEvents() {
  restoreClassesFromStorage()
  const validClassIds = new Set(MOCK_CLASSES.map(c => c.id))

  // 1. 清理排课日程中的无主/已删除班级日程
  for (let i = MOCK_SCHEDULE_EVENTS.length - 1; i >= 0; i--) {
    const e = MOCK_SCHEDULE_EVENTS[i]
    if (e.classId && e.classId !== 'class-custom' && !e.isPersonal) {
      if (!validClassIds.has(e.classId)) {
        MOCK_SCHEDULE_EVENTS.splice(i, 1)
      }
    }
  }

  // 2. 清理考勤消课记录中的无主记录
  for (let i = MOCK_ATTENDANCE_RECORDS.length - 1; i >= 0; i--) {
    const a = MOCK_ATTENDANCE_RECORDS[i]
    if (a.classId && a.classId !== 'class-custom') {
      if (!validClassIds.has(a.classId)) {
        MOCK_ATTENDANCE_RECORDS.splice(i, 1)
      }
    }
  }

  // 3. 清理课评中的无主记录
  for (let i = MOCK_LESSON_EVALUATIONS.length - 1; i >= 0; i--) {
    const v = MOCK_LESSON_EVALUATIONS[i]
    if (v.classId && v.classId !== 'class-custom') {
      if (!validClassIds.has(v.classId)) {
        MOCK_LESSON_EVALUATIONS.splice(i, 1)
      }
    }
  }

  syncCustomSchedulesToStorage()
  syncCustomAttendanceToStorage()
  syncCustomEvaluationsToStorage()
}

// 排课与考勤持久化状态将在本模块所有预设与函数初始化完毕后在底部统一恢复

export interface AvailableClassOption {
  id: string
  name: string
  code?: string
  courseId: string
  courseName: string
  campusId: string
  campusName?: string
  teacherName: string
  capacity: number
  currentCount: number
  status?: string
}

export function getAvailableClasses(params?: { campusId?: string; courseId?: string }): AvailableClassOption[] {
  let list = MOCK_CLASSES
  if (params?.campusId && params.campusId !== 'all' && params.campusId !== 'campus-bj-hq' && params.campusId !== 'HQ001') {
    list = list.filter(c => c.campusId === params.campusId)
  }
  if (params?.courseId) {
    list = list.filter(c => c.courseId === params.courseId)
  }
  return list.map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    courseId: c.courseId,
    courseName: c.courseName,
    campusId: c.campusId,
    campusName: c.campusName,
    teacherName: c.teacherName,
    capacity: c.capacity,
    currentCount: c.studentIds?.length || c.currentStudentCount || 0,
    status: c.status
  }))
}

export function enrollStudentIntoClass(classId: string, studentId: string): boolean {
  const cls = MOCK_CLASSES.find(c => c.id === classId)
  if (!cls) return false
  if (!cls.studentIds) cls.studentIds = []
  if (!cls.studentIds.includes(studentId)) {
    cls.studentIds.push(studentId)
  }
  cls.currentStudentCount = cls.studentIds.length
  syncCustomClassesToStorage()
  return true
}

export function addClass(item: Partial<ClassItem>): ClassItem {
  const newClass: ClassItem = {
    id: item.id || `class-${Date.now()}`,
    code: item.code || `CLS-${Date.now().toString().slice(-6)}`,
    name: item.name || '新建班级',
    campusId: item.campusId || 'campus-bj-hq',
    campusName: item.campusName || '总部校区',
    courseId: item.courseId || 'course-scratch-001',
    courseName: item.courseName || '012-软编Scratch创意图形编程',
    teacherId: item.teacherId || 't-001',
    teacherName: item.teacherName || '张老师',
    assistantId: item.assistantId,
    assistantName: item.assistantName,
    classroomId: item.classroomId || 'room-101',
    classroomName: item.classroomName || '乐博创客教室1',
    capacity: item.capacity || 16,
    currentStudentCount: (item.studentIds || []).length,
    studentIds: item.studentIds || [],
    startDate: item.startDate || '2026-09-01',
    endDate: item.endDate || '2027-01-31',
    status: item.status || 'recruiting',
    scheduleDesc: item.scheduleDesc || '每周六 09:00-10:30',
    completedLessons: 0,
    totalLessons: item.totalLessons || 48,
    createdAt: new Date().toISOString().substring(0, 10)
  }
  MOCK_CLASSES.unshift(newClass)
  syncCustomClassesToStorage()
  return newClass
}

export function updateClass(id: string, patch: Partial<ClassItem>): ClassItem | undefined {
  const index = MOCK_CLASSES.findIndex(c => c.id === id)
  if (index >= 0) {
    const updated = { ...MOCK_CLASSES[index], ...patch, updatedAt: new Date().toISOString() }
    if (patch.studentIds) {
      updated.currentStudentCount = patch.studentIds.length
    }
    MOCK_CLASSES[index] = updated
    syncCustomClassesToStorage()

    // 级联同步更新该班级下所有排课日程中的关联字段
    let schedulesChanged = false
    for (const evt of MOCK_SCHEDULE_EVENTS) {
      if (evt.classId === id) {
        if (updated.name && evt.className !== updated.name) {
          evt.className = updated.name
          schedulesChanged = true
        }
        if (updated.courseId && evt.courseId !== updated.courseId) {
          evt.courseId = updated.courseId
          schedulesChanged = true
        }
        if (updated.courseName && evt.courseName !== updated.courseName) {
          evt.courseName = updated.courseName
          schedulesChanged = true
        }
        if (updated.teacherId && evt.teacherId !== updated.teacherId) {
          evt.teacherId = updated.teacherId
          evt.teacherName = updated.teacherName
          schedulesChanged = true
        }
        if (updated.classroomId && evt.classroomId !== updated.classroomId) {
          evt.classroomId = updated.classroomId
          evt.classroomName = updated.classroomName
          schedulesChanged = true
        }
      }
    }
    if (schedulesChanged) {
      syncCustomSchedulesToStorage()
    }

    // 级联同步更新已生成的考勤记录
    let attendanceChanged = false
    for (const att of MOCK_ATTENDANCE_RECORDS) {
      if (att.classId === id) {
        if (updated.name && att.className !== updated.name) {
          att.className = updated.name
          attendanceChanged = true
        }
        if (updated.courseId && att.courseId !== updated.courseId) {
          att.courseId = updated.courseId
          attendanceChanged = true
        }
        if (updated.courseName && att.courseName !== updated.courseName) {
          att.courseName = updated.courseName
          attendanceChanged = true
        }
      }
    }
    if (attendanceChanged) {
      syncCustomAttendanceToStorage()
    }

    return updated
  }
  return undefined
}

export function deleteClass(id: string): boolean {
  const index = MOCK_CLASSES.findIndex(c => c.id === id)
  if (index >= 0) {
    MOCK_CLASSES.splice(index, 1)

    // 级联彻底删除该班级对应的全部排课日程、考勤消课记录与课评
    for (let i = MOCK_SCHEDULE_EVENTS.length - 1; i >= 0; i--) {
      if (MOCK_SCHEDULE_EVENTS[i].classId === id) {
        MOCK_SCHEDULE_EVENTS.splice(i, 1)
      }
    }
    for (let i = MOCK_ATTENDANCE_RECORDS.length - 1; i >= 0; i--) {
      if (MOCK_ATTENDANCE_RECORDS[i].classId === id) {
        MOCK_ATTENDANCE_RECORDS.splice(i, 1)
      }
    }
    for (let i = MOCK_LESSON_EVALUATIONS.length - 1; i >= 0; i--) {
      if (MOCK_LESSON_EVALUATIONS[i].classId === id) {
        MOCK_LESSON_EVALUATIONS.splice(i, 1)
      }
    }

    syncCustomClassesToStorage()
    syncCustomSchedulesToStorage()
    syncCustomAttendanceToStorage()
    syncCustomEvaluationsToStorage()
    return true
  }
  return false
}



/**
 * 批量排课引擎 (设置循环周期与次数，如每周六 14:00-16:00 连续排 16 次)
 */
export function batchScheduleClass(
  classId: string,
  options: {
    startDate: string;
    startTime: string;
    endTime: string;
    repeatCount: number;
    dayOfWeek?: number; // 0 (Sun) - 6 (Sat)
    teacherId?: string;
    classroomId?: string;
    forceIfConflict?: boolean;
  }
): {
  success: boolean;
  createdEvents: ScheduleEvent[];
  conflicts: { date: string; reason: string }[];
  message: string;
} {
  const cls = getClassById(classId)
  if (!cls) {
    return { success: false, createdEvents: [], conflicts: [], message: '班级不存在' }
  }

  const teacher = MOCK_TEACHERS.find(t => t.id === (options.teacherId || cls.teacherId))
  const classroom = MOCK_CLASSROOMS.find(r => r.id === (options.classroomId || cls.classroomId))

  const createdEvents: ScheduleEvent[] = []
  const conflicts: { date: string; reason: string }[] = []

  // 安全解析本地年月日，杜绝 UTC 时区偏移导致日期倒退一天
  const [startY, startM, startD] = options.startDate.split('-').map(Number)
  const currentDate = new Date(startY, (startM || 1) - 1, startD || 1)

  const teacherId = options.teacherId || cls.teacherId
  const teacherName = teacher?.name || cls.teacherName
  const classroomId = options.classroomId || cls.classroomId
  const classroomName = classroom?.name || cls.classroomName

  for (let i = 0; i < options.repeatCount; i++) {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const eventId = `evt-batch-${cls.id}-${dateStr}-${options.startTime.replace(':', '')}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`

    const payload: Partial<ScheduleEvent> = {
      id: eventId,
      classId: cls.id,
      className: cls.name,
      courseId: cls.courseId,
      courseName: cls.courseName,
      campusId: cls.campusId,
      campusName: cls.campusName,
      teacherId,
      teacherName,
      classroomId,
      classroomName,
      date: dateStr,
      startTime: options.startTime,
      endTime: options.endTime,
      studentIds: cls.studentIds,
      lessonNumber: (cls.completedLessons || 0) + i + 1,
      lessonTitle: `第${(cls.completedLessons || 0) + i + 1}讲`
    }

    const collision = EducationalCollisionEngine.detectCollision(
      payload as any,
      MOCK_SCHEDULE_EVENTS,
      MOCK_CLASSROOMS
    )

    if (collision.hasConflict) {
      conflicts.push({ date: dateStr, reason: collision.reason || '时段冲突' })
    }

    const res = addScheduleEvent(payload, true)
    if (res.success && res.event) {
      createdEvents.push(res.event)
    }

    // 按周推进（加 7 天）
    currentDate.setDate(currentDate.getDate() + 7)
  }

  // 同步更新班级已排进度与展示信息
  if (createdEvents.length > 0) {
    cls.completedLessons = (cls.completedLessons || 0) + createdEvents.length
    cls.scheduleDesc = `每周固定时段 (${options.startTime}-${options.endTime})`
    syncCustomClassesToStorage()
    syncCustomSchedulesToStorage()
  }

  return {
    success: true,
    createdEvents,
    conflicts,
    message: `成功为班级 [${cls.name}] 批量排课 ${createdEvents.length} 次课！${conflicts.length > 0 ? `（其中 ${conflicts.length} 处已标注冲突预警）` : ''}`
  }
}

/**
 * 教室与讲师查询辅助函数
 */
export function getClassrooms(campusId?: string): Classroom[] {
  restoreClassroomsFromStorage()
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001') {
    return [...MOCK_CLASSROOMS]
  }
  return MOCK_CLASSROOMS.filter(c => c.campusId === campusId)
}

export function getTeachers(campusId?: string): Teacher[] {
  restoreSystemUsersFromStorage()

  // 1. 从系统设置组织架构员工库 MOCK_SYSTEM_USER_LIST 中提取【少儿编程专职主讲教师】
  const systemTeachers: Teacher[] = MOCK_SYSTEM_USER_LIST
    .filter(u => u.status === 'active' && (
      u.roleName === '少儿编程专职主讲教师' ||
      u.roleId === 'r4' ||
      (u.postName && (u.postName.includes('讲师') || u.postName.includes('教练') || u.postName.includes('教师')))
    ))
    .map(u => ({
      id: u.id,
      name: u.name,
      campusId: u.campusId,
      campusName: u.campusName,
      phone: u.phone,
      role: 'teacher' as const,
      roleName: u.postName || '少儿编程专职主讲教师',
      subjects: ['Scratch', 'Python', 'C++'],
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      maxWeeklyHours: 30,
      currentWeeklyHours: 18
    }))

  // 2. 从系统设置组织架构员工库中提取【教务学管主管】作为助教/班主任
  const systemAdvisors: Teacher[] = MOCK_SYSTEM_USER_LIST
    .filter(u => u.status === 'active' && (
      u.roleName === '教务学管主管' ||
      u.roleId === 'r3' ||
      (u.postName && (u.postName.includes('学管') || u.postName.includes('班主任') || u.postName.includes('咨询')))
    ))
    .map(u => ({
      id: u.id,
      name: u.name,
      campusId: u.campusId,
      campusName: u.campusName,
      phone: u.phone,
      role: 'advisor' as const,
      roleName: u.postName || '教务班主任',
      subjects: ['综合教务'],
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      maxWeeklyHours: 40,
      currentWeeklyHours: 25
    }))

  // 3. 兜底与 MOCK_TEACHERS 合并
  const combinedList = [...systemTeachers, ...systemAdvisors]
  MOCK_TEACHERS.forEach(t => {
    if (!combinedList.some(item => item.name === t.name || item.id === t.id)) {
      combinedList.push(t)
    }
  })

  // 4. 校区过滤
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001') {
    return combinedList
  }
  return combinedList.filter(t => t.campusId === campusId)
}

// ==========================================
// 讲台 (Workbench) 与 深度课评系统 Mock 服务
// ==========================================

export const MOCK_EVALUATION_TEMPLATES: EvaluationTemplate[] = [
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
]

export const EVALUATIONS_STORAGE_KEY = 'yixiao_mock_lesson_evaluations'

// 预设默认课评记录
export const PRESET_MOCK_LESSON_EVALUATIONS: LessonEvaluation[] = [
  {
    id: 'eval-sample-01',
    lessonTimeId: 'evt-20260912-sc-01',
    classId: 'CLS-HQ-SC-01',
    className: 'Scratch创意周末班 (周六 09:00)',
    lessonTitle: '单片机周六8:00-27',
    templateId: 'tmpl-common',
    templateName: '通用课评模板',
    studyContent: `<p><strong>编程小游戏投石车对抗坦克</strong></p><p>1. 如果那么、重复执行直到满足某个条件、广播与接收指令的应用</p><p>2. 运算逻辑随机数的应用</p><p>3. 角色的左右移动与坐标的变化</p><p>4. 使用不同的案件控制角色的移动和动作</p>`,
    rating: 5,
    voiceUrl: 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/audio/eval_sample.mp3',
    voiceDuration: 45,
    videoUrl: 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/video/classroom_sample.mp4',
    photoList: [
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1588072432836-e10032774350?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60'
    ],
    teacherComment: '通过游戏的方式，吸引学生的学习兴趣，在整个编程过程中，循序渐进的对不同角色进行有序设计，同时了解到物体的抛物线运动轨迹，增加新的知识点。',
    aiPolished: true,
    status: 'published',
    publishTime: '2026-09-12 11:30:00',
    updatedAt: '2026-09-12 11:30:00'
  }
]

export function restoreEvaluationsFromStorage() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const isCleared = localStorage.getItem('yixiao_mock_data_cleared') === 'true'
      const migrated = localStorage.getItem('yixiao_mock_v5_cleared')
      if (!migrated) {
        localStorage.removeItem(EVALUATIONS_STORAGE_KEY)
        return
      }
      const saved = localStorage.getItem(EVALUATIONS_STORAGE_KEY)
      if (saved) {
        const parsed: LessonEvaluation[] = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          MOCK_LESSON_EVALUATIONS.length = 0
          MOCK_LESSON_EVALUATIONS.push(...parsed)
        }
      } else if (!isCleared) {
        MOCK_LESSON_EVALUATIONS.length = 0
        MOCK_LESSON_EVALUATIONS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_LESSON_EVALUATIONS)))
      }
    } catch (e) {
      console.warn('[Mock Evaluations] Failed to restore from localStorage:', e)
    }
  }
}

export function clearEducationalMockData() {
  MOCK_CLASSES.length = 0
  MOCK_SCHEDULE_EVENTS.length = 0
  MOCK_ATTENDANCE_RECORDS.length = 0
  MOCK_LESSON_EVALUATIONS.length = 0
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(CLASSES_STORAGE_KEY)
    localStorage.removeItem(SCHEDULES_STORAGE_KEY)
    localStorage.removeItem(ATTENDANCE_STORAGE_KEY)
    localStorage.removeItem(EVALUATIONS_STORAGE_KEY)
  }
}

export function restoreEducationalMockData() {
  MOCK_CLASSES.length = 0
  MOCK_CLASSES.push(...JSON.parse(JSON.stringify(PRESET_MOCK_CLASSES)))
  MOCK_SCHEDULE_EVENTS.length = 0
  MOCK_SCHEDULE_EVENTS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_SCHEDULE_EVENTS)))
  MOCK_ATTENDANCE_RECORDS.length = 0
  MOCK_ATTENDANCE_RECORDS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_ATTENDANCE_RECORDS)))
  MOCK_LESSON_EVALUATIONS.length = 0
  MOCK_LESSON_EVALUATIONS.push(...JSON.parse(JSON.stringify(PRESET_MOCK_LESSON_EVALUATIONS)))
  syncCustomClassesToStorage()
  syncCustomSchedulesToStorage()
  syncCustomAttendanceToStorage()
  syncCustomEvaluationsToStorage()
}

// 统一根据运行环境恢复或清理
if (typeof window === 'undefined') {
  // Node 测试运行环境：默认恢复演示数据集保证自动化用例顺利通过
  restoreEducationalMockData()
} else {
  restoreClassesFromStorage()
  restoreSchedulesFromStorage()
  restoreAttendanceFromStorage()
  restoreEvaluationsFromStorage()
  purgeOrphanScheduleEvents()
}

export function syncCustomEvaluationsToStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(EVALUATIONS_STORAGE_KEY, JSON.stringify(MOCK_LESSON_EVALUATIONS))
    } catch (e) {
      console.warn('[Mock Evaluations] Failed to sync to localStorage:', e)
    }
  }
}

export function getEvaluationTemplates(): EvaluationTemplate[] {
  return [...MOCK_EVALUATION_TEMPLATES]
}

export function getLessonEvaluationByLessonId(lessonTimeId: string): LessonEvaluation | null {
  const item = MOCK_LESSON_EVALUATIONS.find(e => e.lessonTimeId === lessonTimeId)
  return item ? JSON.parse(JSON.stringify(item)) : null
}

export function saveLessonEvaluation(payload: Partial<LessonEvaluation>, publish: boolean = false): LessonEvaluation {
  const lessonTimeId = payload.lessonTimeId || ''
  let existing = MOCK_LESSON_EVALUATIONS.find(e => e.lessonTimeId === lessonTimeId)

  const now = new Date()
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  if (existing) {
    Object.assign(existing, payload, {
      status: publish ? 'published' : (payload.status || 'draft'),
      publishTime: publish ? nowStr : existing.publishTime,
      updatedAt: nowStr
    })
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
      studentEvaluations: payload.studentEvaluations || {},
      updatedAt: nowStr
    }
    MOCK_LESSON_EVALUATIONS.unshift(existing)
  }

  syncCustomEvaluationsToStorage()
  return JSON.parse(JSON.stringify(existing))
}

/**
 * 讲台当日排课卡片提取与指标聚合服务
 */
export function getWorkbenchLessons(params: {
  campusId?: string;
  date?: string;
  teacherId?: string;
  teacherName?: string;
  role?: string;
  status?: string;
  mode?: string;
  search?: string;
  classroomId?: string;
}): {
  cards: WorkbenchLessonCard[];
  stats: {
    lessonCount: number;
    uncompletedCount: number;
    totalStudentTimes: number;
    attendedTimes: number;
    absentTimes: number;
    unsignedTimes: number;
    signedRate: number;
  };
} {
  restoreClassesFromStorage()
  restoreSchedulesFromStorage()
  restoreAttendanceFromStorage()
  purgeOrphanScheduleEvents()

  const targetCampusId = params.campusId || 'campus-bj-hq'
  
  // 教学讲台严格按老师过滤（匹配 teacherId 或 teacherName 或系统员工/教师库）
  const filterByTeacher = !!(params.teacherId || params.teacherName)
  const pTeacherId = params.teacherId?.trim()
  const pTeacherName = params.teacherName?.trim()
  const allTeachers = getTeachers()
  const matchedTeacherObj = allTeachers.find(t => (pTeacherId && t.id === pTeacherId) || (pTeacherName && t.name === pTeacherName))

  let events = MOCK_SCHEDULE_EVENTS.filter(e => {
    // 过滤已被删除班级的残存排课
    if (e.classId && e.classId !== 'class-custom' && !e.isPersonal) {
      if (!MOCK_CLASSES.some(c => c.id === e.classId)) return false
    }
    if (targetCampusId && targetCampusId !== 'campus-bj-hq' && targetCampusId !== 'HQ001') {
      if (e.campusId !== targetCampusId) return false
    }
    if (params.date) {
      if (e.date !== params.date) return false
    }
    if (filterByTeacher) {
      const matchId = pTeacherId && (e.teacherId === pTeacherId || (matchedTeacherObj && e.teacherId === matchedTeacherObj.id))
      const matchName = pTeacherName && (e.teacherName === pTeacherName || (matchedTeacherObj && e.teacherName === matchedTeacherObj.name))
      if (!matchId && !matchName) return false
    }
    if (params.classroomId && e.classroomId !== params.classroomId) return false
    return true
  })

  // 如果精准单日匹配为空，且未限制特定老师（如全局演示排课），且当前校区存在有效班级，方可聚合临近排课日程兜底
  if (events.length === 0 && !params.date && !filterByTeacher && MOCK_CLASSES.length > 0) {
    events = MOCK_SCHEDULE_EVENTS.filter(e => {
      if (e.classId && e.classId !== 'class-custom' && !e.isPersonal) {
        if (!MOCK_CLASSES.some(c => c.id === e.classId)) return false
      }
      if (targetCampusId && targetCampusId !== 'campus-bj-hq' && targetCampusId !== 'HQ001') {
        if (e.campusId !== targetCampusId) return false
      }
      if (params.classroomId && e.classroomId !== params.classroomId) return false
      return e.date >= '2026-09-12' && e.date <= '2026-09-27'
    })
  }

  // 映射为讲台专用 WorkbenchLessonCard 格式
  const cards: WorkbenchLessonCard[] = events.map(evt => {
    const cls = getClassById(evt.classId || '')
    const studentCount = evt.studentIds?.length || cls?.studentIds?.length || cls?.currentStudentCount || cls?.capacity || evt.totalCount || 0
    
    // 查看是否有真实考勤消课记录
    const att = MOCK_ATTENDANCE_RECORDS.find(a => a.scheduleEventId === evt.id)
    const signedCount = att 
      ? (att.presentCount + att.lateCount) 
      : (evt.status === 'completed' ? (evt.attendanceCount ?? studentCount) : (evt.attendanceCount || 0))

    // 查看是否有课评记录
    const evaluation = MOCK_LESSON_EVALUATIONS.find(v => v.lessonTimeId === evt.id)
    const evalStatus: 'none' | 'draft' | 'published' = evaluation ? evaluation.status : 'none'

    return {
      ...evt,
      status: (evt.status as any) || 'scheduled',
      mode: 'offline',
      totalStudents: studentCount,
      signedCount,
      teachingAssistants: [cls?.assistantName || '冬海潮', '钱欣蕾'].filter(Boolean),
      evaluationStatus: evalStatus,
      playbackUrl: 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/playback/demo.mp4'
    }
  })

  // 进一步按状态和模式过滤
  let filtered = cards
  if (params.status) {
    if (params.status === 'scheduled') filtered = filtered.filter(c => c.status === 'scheduled')
    else if (params.status === 'in_progress') filtered = filtered.filter(c => c.status === 'in_progress')
    else if (params.status === 'completed') filtered = filtered.filter(c => c.status === 'completed')
  }
  if (params.mode) {
    filtered = filtered.filter(c => c.mode === params.mode)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(c => (c.className || '').toLowerCase().includes(q) || (c.lessonTitle || '').toLowerCase().includes(q) || (c.teacherName || '').toLowerCase().includes(q))
  }

  // 统计指标
  const lessonCount = filtered.length
  const uncompletedCount = filtered.filter(c => c.status !== 'completed').length
  const totalStudentTimes = filtered.reduce((s, c) => s + c.totalStudents, 0)
  const attendedTimes = filtered.reduce((s, c) => s + c.signedCount, 0)
  const unsignedTimes = Math.max(0, totalStudentTimes - attendedTimes)
  const absentTimes = filtered.filter(c => c.status === 'completed').reduce((s, c) => s + Math.max(0, c.totalStudents - c.signedCount), 0)
  const signedRate = totalStudentTimes > 0 ? Math.round((attendedTimes / totalStudentTimes) * 100) : 0

  return {
    cards: filtered,
    stats: {
      lessonCount,
      uncompletedCount,
      totalStudentTimes,
      attendedTimes,
      absentTimes,
      unsignedTimes,
      signedRate
    }
  }
}

/**
 * 上课与结课状态流转服务
 */
export function startLesson(lessonId: string): { success: boolean; message: string } {
  const evt = MOCK_SCHEDULE_EVENTS.find(e => e.id === lessonId)
  if (!evt) return { success: false, message: '未找到指定课次' }
  evt.status = 'in_progress'
  syncCustomSchedulesToStorage()
  return { success: true, message: `课次 [${evt.lessonTitle || evt.className}] 已成功开启上课状态！` }
}

export function finishLesson(lessonId: string): { success: boolean; message: string } {
  const evt = MOCK_SCHEDULE_EVENTS.find(e => e.id === lessonId)
  if (!evt) return { success: false, message: '未找到指定课次' }
  evt.status = 'completed'
  syncCustomSchedulesToStorage()
  return { success: true, message: `课次 [${evt.lessonTitle || evt.className}] 已成功结课并完成授课归档！` }
}

