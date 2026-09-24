import type { StudentProfile, ScheduleEvent, OrderRecord } from '@/types'
import type { CourseItem, CourseStatus } from '@/types/curriculum'
import {
  MOCK_CURRICULUM_COURSES,
  MOCK_SUBJECTS,
  MOCK_LESSON_PLANS,
  COURSE_COVERS,
  COURSES_STORAGE_KEY,
  MOCK_COURSES,
  saveCoursesToStorage,
  restoreCoursesFromStorage,
  getCoursesByCampus,
  getAllCourses,
  saveCourse,
  deleteCourse,
  toggleCourseStatus
} from './curriculum'
import { MOCK_STUDENTS } from './student'

export {
  MOCK_CURRICULUM_COURSES,
  MOCK_SUBJECTS,
  MOCK_LESSON_PLANS,
  COURSE_COVERS,
  COURSES_STORAGE_KEY,
  MOCK_COURSES,
  saveCoursesToStorage,
  restoreCoursesFromStorage,
  getCoursesByCampus,
  getAllCourses,
  saveCourse,
  deleteCourse,
  toggleCourseStatus
}


// 2. 学员全景数据基石与操作服务
export * from './student'


// 3. 教务排课日程与业务服务
export * from './educational'
import { MOCK_SCHEDULE_EVENTS } from './educational'
export const MOCK_SCHEDULES: ScheduleEvent[] = MOCK_SCHEDULE_EVENTS

import {
  MOCK_ORDERS_DATA,
  FinanceAggregator,
  getOrdersByCampus,
  saveOrder,
  voidOrder,
  updateOrder,
  updateOrderVoucher,
  getApprovalRecords,
  processApprovalRecord,
  getLedgerRecords,
  MOCK_APPROVAL_RECORDS,
  MOCK_LEDGER_RECORDS,
  isCampusMatch,
  CAMPUS_CODE_MAP
} from './financial'

export {
  FinanceAggregator,
  getOrdersByCampus,
  saveOrder,
  voidOrder,
  updateOrder,
  updateOrderVoucher,
  getApprovalRecords,
  processApprovalRecord,
  getLedgerRecords,
  MOCK_APPROVAL_RECORDS,
  MOCK_LEDGER_RECORDS,
  MOCK_ORDERS_DATA,
  isCampusMatch,
  CAMPUS_CODE_MAP
}

// 4. 财务订单流水基石
export const MOCK_ORDERS: OrderRecord[] = MOCK_ORDERS_DATA

// 5. 组织机构、RBAC 权限树与业务字典基石
export * from './system'
import { MOCK_ORG_NODES } from './system'
export const MOCK_ORG_TREE = MOCK_ORG_NODES




export function getStudentsByCampus(campusId: string): StudentProfile[] {
  return MOCK_STUDENTS.filter(s => s.campusId === campusId)
}

export function getSchedulesByCampus(campusId: string): ScheduleEvent[] {
  return MOCK_SCHEDULES.filter(s => s.campusId === campusId)
}

export function getCampusStats(campusId: string) {
  const students = getStudentsByCampus(campusId)
  const courses = getCoursesByCampus(campusId)
  const orders = getOrdersByCampus(campusId)
  const schedules = getSchedulesByCampus(campusId)

  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.actualAmount, 0)
  const totalStudents = students.length
  const conflictCount = schedules.filter(s => s.semanticType === 'conflict').length

  return {
    studentCount: totalStudents,
    courseCount: courses.length,
    orderCount: orders.length,
    paidOrderCount: paidOrders.length,
    totalRevenue,
    scheduleCount: schedules.length,
    conflictCount
  }
}


import {
  clearStudentMockData,
  restoreStudentMockData,
  MOCK_UNASSIGNED_STUDENTS,
  MOCK_SERVICE_FEES,
  PRESET_MOCK_STUDENTS,
  PRESET_MOCK_UNASSIGNED_STUDENTS,
  PRESET_MOCK_SERVICE_FEES
} from './student'

import {
  clearEducationalMockData,
  restoreEducationalMockData,
  MOCK_CLASSES,
  MOCK_ATTENDANCE_RECORDS,
  MOCK_LESSON_EVALUATIONS,
  PRESET_MOCK_CLASSES,
  PRESET_MOCK_SCHEDULE_EVENTS,
  PRESET_MOCK_ATTENDANCE_RECORDS,
  PRESET_MOCK_LESSON_EVALUATIONS
} from './educational'

import {
  clearFinancialMockData,
  restoreFinancialMockData,
  PRESET_MOCK_ORDERS_DATA,
  PRESET_MOCK_APPROVAL_RECORDS,
  PRESET_MOCK_LEDGER_RECORDS
} from './financial'

import {
  clearCoursesMockData,
  restoreCoursesMockData
} from './curriculum'

export {
  clearStudentMockData,
  restoreStudentMockData,
  clearEducationalMockData,
  restoreEducationalMockData,
  clearFinancialMockData,
  restoreFinancialMockData,
  clearCoursesMockData,
  restoreCoursesMockData,
  PRESET_MOCK_STUDENTS,
  PRESET_MOCK_UNASSIGNED_STUDENTS,
  PRESET_MOCK_SERVICE_FEES,
  PRESET_MOCK_CLASSES,
  PRESET_MOCK_SCHEDULE_EVENTS,
  PRESET_MOCK_ATTENDANCE_RECORDS,
  PRESET_MOCK_LESSON_EVALUATIONS,
  PRESET_MOCK_ORDERS_DATA,
  PRESET_MOCK_APPROVAL_RECORDS,
  PRESET_MOCK_LEDGER_RECORDS
}

/**
 * 一键清空全系统业务 Mock 数据 (学员、待分班、班级、日程、订单、审批、考勤、课评、台账)
 * 供用户进行无干扰真实测试
 */
export function clearAllMockData(options: { includeCourses?: boolean } = {}) {
  clearStudentMockData()
  clearEducationalMockData()
  clearFinancialMockData()
  if (options.includeCourses) {
    clearCoursesMockData()
  }
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('yixiao_mock_data_cleared', 'true')
    localStorage.setItem('yixiao_mock_v5_cleared', '1')
  }
}

/**
 * 一键恢复初始预设 Mock 演示数据
 */
export function restoreAllMockData() {
  restoreStudentMockData()
  restoreEducationalMockData()
  restoreFinancialMockData()
  restoreCoursesMockData()
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('yixiao_mock_data_cleared', 'false')
    localStorage.setItem('yixiao_mock_v5_cleared', '1')
  }
}

/**
 * 实时获取全系统业务数据量指标
 */
export function getMockDataStats() {
  return {
    studentCount: MOCK_STUDENTS.length,
    unassignedCount: MOCK_UNASSIGNED_STUDENTS.length,
    serviceFeeCount: MOCK_SERVICE_FEES.length,
    classCount: MOCK_CLASSES.length,
    scheduleCount: MOCK_SCHEDULE_EVENTS.length,
    attendanceCount: MOCK_ATTENDANCE_RECORDS.length,
    evaluationCount: MOCK_LESSON_EVALUATIONS.length,
    orderCount: MOCK_ORDERS_DATA.length,
    approvalCount: MOCK_APPROVAL_RECORDS.length,
    ledgerCount: MOCK_LEDGER_RECORDS.length,
    courseCount: MOCK_COURSES.length
  }
}

// 首次浏览器访问自动清理旧缓存，确保业务测试纯净
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  if (!localStorage.getItem('yixiao_mock_v5_cleared')) {
    clearAllMockData()
  }
}
