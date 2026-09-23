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
