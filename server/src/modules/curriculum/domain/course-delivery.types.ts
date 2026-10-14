/**
 * 跨校区课程交付中心领域契约与类型定义
 * Domain Types for CourseDeliveryEngine
 */

export interface AuthorizeDeliveryCommand {
  courseId: string;
  campusIds: string[];
}

export interface DeliveryAuthorizationReceipt {
  courseId: string;
  courseName: string;
  authorizedCampusIds: string[];
  totalAuthorized: number;
}

export interface CourseDeliveryAccessResult {
  isDeliverable: boolean;
  courseId: string;
  courseName: string;
  campusId: string;
  campusName: string;
  status: 'enabled' | 'disabled';
}

export interface CampusDeliveryCatalogItem {
  id: string;
  code: string;
  name: string;
  subject: string;
  grade: string;
  pricePerLesson: number;
  totalLessons: number;
  status: string;
  activeClassCount: number;
  enrolledStudentCount: number;
}

export interface CampusDeliveryCatalogSnapshot {
  campusId: string;
  campusName: string;
  totalCourses: number;
  catalog: CampusDeliveryCatalogItem[];
}
