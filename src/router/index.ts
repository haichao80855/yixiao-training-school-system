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
    path: '/teacher',
    component: () => import('@/layout/TeacherLayout.vue'),
    meta: { requiresPermission: 'educational:workbench' },
    children: [
      {
        path: '',
        name: 'TeacherHome',
        component: () => import('@/views/teacher/TeacherHome.vue'),
        meta: { title: '首页', teacherTab: 'home', teacherWide: true }
      },
      {
        path: 'schedule',
        name: 'TeacherSchedule',
        component: () => import('@/views/teacher/TeacherSchedule.vue'),
        meta: { title: '课表', teacherTab: 'schedule', teacherWide: true }
      },
      {
        path: 'evaluations',
        name: 'TeacherEvaluations',
        component: () => import('@/views/teacher/TeacherEvaluations.vue'),
        meta: { title: '课评', teacherTab: 'evaluations' }
      },
      {
        path: 'students',
        name: 'TeacherStudents',
        component: () => import('@/views/teacher/TeacherStudents.vue'),
        meta: { title: '学员', teacherTab: 'students' }
      },
      {
        path: 'classes',
        name: 'TeacherClasses',
        component: () => import('@/views/teacher/TeacherClasses.vue'),
        meta: { title: '学员', teacherTab: 'students' }
      },
      {
        path: 'warnings',
        name: 'TeacherWarnings',
        component: () => import('@/views/teacher/TeacherWarnings.vue'),
        meta: { title: '学员', teacherTab: 'students' }
      },
      {
        path: 'me',
        name: 'TeacherMe',
        component: () => import('@/views/teacher/TeacherMe.vue'),
        meta: { title: '我的', teacherTab: 'me' }
      },
      {
        path: 'lessons/:id',
        name: 'TeacherLesson',
        component: () => import('@/views/teacher/TeacherLesson.vue'),
        meta: { title: '课次详情', teacherWide: true }
      },
      {
        path: 'lessons/:id/evaluate/:studentId',
        name: 'TeacherEvaluate',
        component: () => import('@/views/teacher/TeacherEvaluate.vue'),
        meta: { title: '写课评' }
      },
      {
        path: 'lessons/:id/review/:studentId',
        name: 'TeacherReview',
        component: () => import('@/views/teacher/TeacherReview.vue'),
        meta: { title: '看学情' }
      },
      {
        path: 'classes/:id',
        name: 'TeacherClassDetail',
        component: () => import('@/views/teacher/TeacherClassDetail.vue'),
        meta: { title: '班级详情' }
      },
      {
        path: 'students/:id',
        name: 'TeacherStudentDetail',
        component: () => import('@/views/teacher/TeacherStudentDetail.vue'),
        meta: { title: '学员详情' }
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
    path: '/public/growth-report',
    name: 'PublicGrowthReport',
    component: () => import('@/views/public/ParentGrowthReportView.vue'),
    meta: { title: '学员成长档案与随堂学情报告' }
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
  // 登录页与公开学情报告落地页免登录放行
  if (to.path === '/login' || to.path.startsWith('/public/')) {
    if (to.path === '/login' && authStore.isAuthenticated) {
      next(authStore.homePath)
    } else {
      next()
    }
  } else {
    if (!authStore.isAuthenticated) {
      // 未登录一律回登录页，并记住原本要去的页面
      next({ path: '/login', query: { redirect: to.fullPath } })
    } else if (to.path === '/dashboard' && authStore.isTeacherOnly) {
      // 默认入口 (含 / 与未知路径) 对纯教师账号落到教师端
      next('/teacher')
    } else {
      const requiredPermission = to.matched.find((r) => r.meta.requiresPermission)?.meta.requiresPermission as string | undefined
      if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
        next('/dashboard')
      } else {
        next()
      }
    }
  }
})

// 发布新版本后，手机上开着的旧页面再加载路由分片会 404，表现为白屏：整页重载取新版本
const CHUNK_RELOAD_KEY = 'yixiao_chunk_reload_at'
router.onError((error, to) => {
  if (!/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(error?.message || '')) return
  if (navigator.onLine === false) return
  try {
    // 重载后仍失败时不再循环刷新
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  window.location.assign(to.fullPath)
})

router.afterEach((to, _from, failure) => {
  if (failure) return
  const title = (to.meta?.title as string) || '拓视未来教育'
  document.title = `${title} - 一校教培系统`
})

export default router
