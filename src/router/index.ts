import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layout/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '控制台看板', icon: 'monitor', affix: true }
      },
      // 1. 教研中心 (Curriculum)
      {
        path: 'curriculum',
        redirect: '/curriculum/courseManage'
      },
      {
        path: 'curriculum/courseManage',
        name: 'CourseManage',
        component: () => import('@/views/curriculum/courseManage.vue'),
        meta: { title: '课程研发管理', module: '教研中心' }
      },
      {
        path: 'curriculum/subject',
        name: 'CurriculumSubject',
        component: () => import('@/views/curriculum/subject.vue'),
        meta: { title: '科目体系设置', module: '教研中心' }
      },
      {
        path: 'curriculum/lessonPlan',
        name: 'CurriculumLessonPlan',
        component: () => import('@/views/curriculum/lessonPlan.vue'),
        meta: { title: '课次进度大纲', module: '教研中心' }
      },
      {
        path: 'curriculum/platformCourse',
        name: 'CurriculumPlatformCourse',
        component: () => import('@/views/curriculum/platformCourse.vue'),
        meta: { title: '资源平台课程库', module: '教研中心' }
      },
      // 2. 学员中心 (StudentCenter)
      {
        path: 'studentCenter',
        redirect: '/studentCenter/allStudent'
      },
      {
        path: 'studentCenter/allStudent',
        name: 'AllStudent',
        component: () => import('@/views/studentCenter/allStudent.vue'),
        meta: { title: '全部学员全景', module: '学员中心' }
      },
      {
        path: 'studentCenter/unassigned',
        name: 'UnassignedStudent',
        component: () => import('@/views/studentCenter/unassigned.vue'),
        meta: { title: '待分班学员池', module: '学员中心' }
      },
      {
        path: 'studentCenter/serviceFee',
        name: 'StudentServiceFee',
        component: () => import('@/views/studentCenter/serviceFee.vue'),
        meta: { title: '服务费代报考', module: '学员中心' }
      },
      // 3. 教务中心 (Educational)
      {
        path: 'educational',
        redirect: '/educational/workbench'
      },
      {
        path: 'educational/workbench',
        name: 'EducationalWorkbench',
        component: () => import('@/views/educational/workbench.vue'),
        meta: { title: '教学服务 - 讲台', module: '教务中心' }
      },
      {
        path: 'educational/timeSchedule',
        name: 'TimeSchedule',
        component: () => import('@/views/educational/timeSchedule.vue'),
        meta: { title: '7×15 排课时间看板', module: '教务中心' }
      },
      {
        path: 'educational/classManagement',
        name: 'ClassManagement',
        component: () => import('@/views/educational/classManagement.vue'),
        meta: { title: '班级与班容管理', module: '教务中心' }
      },
      {
        path: 'educational/attendance',
        name: 'Attendance',
        component: () => import('@/views/educational/attendance.vue'),
        meta: { title: '授课点名消课', module: '教务中心' }
      },
      // 4. 财务中心 (Financial)
      {
        path: 'financial',
        redirect: '/financial/orderManagement'
      },
      {
        path: 'financial/orderManagement',
        name: 'OrderManagement',
        component: () => import('@/views/financial/orderManagement.vue'),
        meta: { title: '订单营收流水', module: '财务中心' }
      },
      {
        path: 'financial/chargingLedger',
        name: 'ChargingLedger',
        component: () => import('@/views/financial/chargingLedger.vue'),
        meta: { title: '收费流水账本', module: '财务中心' }
      },
      {
        path: 'financial/approvalFlow',
        name: 'ApprovalFlow',
        component: () => import('@/views/financial/approvalFlow.vue'),
        meta: { title: '业务审批工作台', module: '财务中心' }
      },
      // 5. 系统设置 (SystemSetting)
      {
        path: 'systemSetting',
        redirect: '/systemSetting/authoritiesInfo'
      },
      {
        path: 'systemSetting/authoritiesInfo',
        name: 'AuthoritiesInfo',
        component: () => import('@/views/systemSetting/authoritiesInfo.vue'),
        meta: { title: '组织架构与机构', module: '系统设置' }
      },
      {
        path: 'systemSetting/roleManagement',
        name: 'RoleManagement',
        component: () => import('@/views/systemSetting/roleManagement.vue'),
        meta: { title: '4级RBAC角色管理', module: '系统设置' }
      },
      {
        path: 'systemSetting/dictSetting',
        name: 'DictSetting',
        component: () => import('@/views/systemSetting/dictSetting.vue'),
        meta: { title: '业务参数字典', module: '系统设置' }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '用户登录与角色切换' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 })
})

import { useAuthStore } from '@/stores/authStore'

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      next(authStore.isTeacher ? '/educational/workbench' : '/dashboard')
    } else {
      next()
    }
  } else {
    if (!authStore.isAuthenticated) {
      next('/login')
    } else {
      next()
    }
  }
})

router.afterEach((to) => {
  const title = (to.meta?.title as string) || '拓视未来教育'
  document.title = `${title} - 拓视未来教育「一校教培系统」(002599)`
})

export default router
