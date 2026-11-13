<template>
  <div class="space-y-5 p-6 max-w-[1680px] mx-auto">
    <!-- 欢迎区 -->
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-1">
      <div>
        <h1 class="text-[22px] font-semibold text-st-title tracking-tight">
          {{ greetingText }}，{{ currentUserName }}
        </h1>
        <p class="mt-1.5 text-[13px] text-st-muted flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="px-2 py-0.5 rounded-md bg-st-primary-light text-st-primary font-medium text-xs">{{ currentUserRole }}</span>
          <span>当前校区 <span class="text-st-regular font-medium">{{ currentCampus.name }}</span></span>
          <span class="text-st-border-dark">·</span>
          <span>{{ currentCampus.code }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <el-button :loading="refreshing" @click="handleManualRefresh">
          <RefreshCw v-if="!refreshing" class="w-4 h-4 mr-1.5" />
          {{ refreshing ? '正在同步…' : '刷新数据' }}
        </el-button>
        <el-button v-if="canOpen('/educational/workbench')" type="primary" @click="$router.push('/educational/workbench')">
          <Monitor class="w-4 h-4 mr-1.5" />
          进入教学讲台
        </el-button>
      </div>
    </div>

    <!-- 4大核心业务 KPI 指标看板 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 营收总额 -->
      <div class="kpi-card group">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-st-secondary">实收营收流水 (本月)</span>
          <div class="w-9 h-9 rounded-lg bg-st-primary-light text-st-primary flex items-center justify-center">
            <CircleDollarSign class="w-5 h-5" />
          </div>
        </div>
        <div class="my-4 flex items-end justify-between">
          <div class="text-[26px] leading-none font-semibold text-st-title font-mono tracking-tight whitespace-nowrap">
            <span class="text-lg text-st-muted font-medium mr-0.5">¥</span>{{ stats.totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>已支付订单: <strong class="text-st-regular font-semibold font-mono">{{ stats.paidOrderCount }}</strong> 笔</span>
          <span class="text-st-muted">本月</span>
        </div>
      </div>

      <!-- 在读学员 -->
      <div class="kpi-card group">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-st-secondary">在籍在读学员总量</span>
          <div class="w-9 h-9 rounded-lg bg-st-success-light text-st-success flex items-center justify-center">
            <GraduationCap class="w-5 h-5" />
          </div>
        </div>
        <div class="my-4 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-[26px] leading-none font-semibold text-st-title font-mono tracking-tight">
              {{ stats.studentCount }}
            </div>
            <span class="text-xs text-st-muted font-medium">人</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>归属校区生源池</span>
          <span class="text-st-primary font-medium bg-st-primary-light px-1.5 py-0.5 rounded-md text-xs">
            待分班 {{ stats.unassignedCount }} 人
          </span>
        </div>
      </div>

      <!-- 本周排课 -->
      <div class="kpi-card group">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-st-secondary">本周排课日程</span>
          <div class="w-9 h-9 rounded-lg bg-st-purple-light text-st-purple flex items-center justify-center">
            <Calendar class="w-5 h-5" />
          </div>
        </div>
        <div class="my-4 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-[26px] leading-none font-semibold text-st-title font-mono tracking-tight">
              {{ stats.scheduleCount }}
            </div>
            <span class="text-xs text-st-muted font-medium">节课次</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>冲突监测:</span>
          <span
            :class="[
              'px-1.5 py-0.5 rounded-md text-xs font-medium',
              stats.conflictCount > 0 ? 'bg-st-danger-light text-st-danger font-bold' : 'bg-st-success-light text-st-success'
            ]"
          >
            {{ stats.conflictCount > 0 ? `检测到 ${stats.conflictCount} 处冲突` : '无排课冲突' }}
          </span>
        </div>
      </div>

      <!-- 授权课程体系 -->
      <div class="kpi-card group">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-st-secondary">已授权标准化课程体系</span>
          <div class="w-9 h-9 rounded-lg bg-st-warning-light text-st-warning flex items-center justify-center">
            <BookOpen class="w-5 h-5" />
          </div>
        </div>
        <div class="my-4 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-[26px] leading-none font-semibold text-st-title font-mono tracking-tight">
              {{ stats.courseCount }}
            </div>
            <span class="text-xs text-st-muted font-medium">门标准课</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>教研中心统一质控</span>
          <span class="text-st-warning font-medium bg-st-warning-light px-1.5 py-0.5 rounded-md text-xs">标准化课件就绪</span>
        </div>
      </div>
    </div>

    <!-- 教学经营指标：到课率、请假率、课评查看率、满班率 (需要考勤查看权限) -->
    <TeachingMetricsPanel v-if="authStore.hasPermission('educational:attendance')" />

    <!-- 核心业务高频入口网格 (经过精炼的9大真实业务枢纽) -->
    <div class="panel-card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
                    <h2 class="panel-title">常用功能</h2>
          
        </div>
              </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        <div
          v-for="item in visibleQuickAccess"
          :key="item.name"
          @click="$router.push(item.path)"
          class="flex flex-col items-center px-2 py-3.5 rounded-lg hover:bg-st-header transition-colors cursor-pointer group text-center"
        >
          <div :class="['w-10 h-10 rounded-lg flex items-center justify-center mb-2', item.bgClass]">
            <component :is="item.icon" class="w-5 h-5" />
          </div>
          <span class="text-[13px] font-medium text-st-regular group-hover:text-st-primary transition-colors">
            {{ item.name }}
          </span>
          <span class="text-xs text-st-muted mt-0.5 line-clamp-1">
            {{ item.desc }}
          </span>
        </div>
      </div>
    </div>

    <!-- 下半区：双栏排版（左侧：近期排课与消课日程；右侧：教务待办与运行预警） -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- 左侧：近期待授排课日程监控 (7×15 调度动态) -->
      <div class="lg:col-span-8 panel-card flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
                            <h2 class="panel-title">近期课次</h2>
              
            </div>
            <el-button
              link
              type="primary"
              size="small"
              v-if="canOpen('/educational/timeSchedule')"
              class="flex items-center gap-1"
              @click="$router.push('/educational/timeSchedule')"
            >
              <span>查看课表</span>
              <ArrowRight class="w-4 h-4 ml-0.5 inline" />
            </el-button>
          </div>

          <!-- 日程列表 -->
          <div v-if="recentSchedules.length > 0" class="space-y-2.5">
            <div
              v-for="item in recentSchedules"
              :key="item.id"
              class="p-3 rounded-lg border border-st-border hover:bg-st-header transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="flex items-center space-x-3.5">
                <div class="w-16 h-11 rounded-lg bg-st-primary-light text-st-primary flex flex-col items-center justify-center shrink-0 leading-tight">
                  <span class="text-xs font-medium">{{ item.dateLabel }}</span>
                  <span class="font-semibold text-[13px] font-mono">{{ item.timeSlot ? item.timeSlot.split('-')[0] : '--:--' }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm text-st-title">{{ item.lessonTitle || item.courseName || '标准课程' }}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-md bg-st-fill text-st-secondary">
                      {{ item.className || '标准班级' }}
                    </span>
                    <span
                      v-if="item.isConflict"
                      class="text-xs px-1.5 py-0.5 rounded-md bg-st-danger-light text-st-danger-deep font-medium"
                    >
                      时段冲突
                    </span>
                  </div>
                  <div class="text-xs text-st-muted mt-1 flex items-center gap-3 flex-wrap">
                    <span>授课讲师: <span class="text-st-secondary">{{ item.teacherName || '未指定' }}</span></span>
                    <span>教室: <span class="text-st-secondary">{{ item.classroomName || '默认教室' }}</span></span>
                    <span v-if="item.timeSlot">时段: {{ item.timeSlot }}</span>
                  </div>
                </div>
              </div>

              <!-- 操作区 -->
              <div class="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <el-button
                  v-if="canOpen('/educational/workbench')"
                  @click="$router.push('/educational/workbench')"
                >
                  讲台
                </el-button>
                <el-button
                  v-if="canOpen('/educational/attendance')"
                  type="primary"
                  @click="$router.push('/educational/attendance')"
                >
                  点名消课
                </el-button>
              </div>
            </div>
          </div>

          <!-- 空日程状态 -->
          <div v-else class="py-12 flex flex-col items-center justify-center text-center text-st-muted space-y-2">
            <CalendarDays class="w-9 h-9 text-st-placeholder mx-auto" />
            <p class="text-[13px]">未来两周暂无待上课次</p>
            <el-button v-if="canOpen('/educational/timeSchedule')" type="primary" plain @click="$router.push('/educational/timeSchedule')">
              前往排课日历添加课次
            </el-button>
          </div>
        </div>

        <div class="pt-3 mt-4 border-t border-st-border flex items-center justify-between text-xs text-st-muted">
          <span>当前校区 · 未来 14 天</span>
          <span>共 {{ upcomingCount }} 节待上{{ upcomingCount > recentSchedules.length ? `，显示最近 ${recentSchedules.length} 节` : '' }}</span>
        </div>
      </div>

      <!-- 右侧：教务待办事项与运行预警 -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 待办处理卡片 -->
        <div class="panel-card">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
                            <h2 class="panel-title">待办提醒</h2>
            </div>
          </div>

          <div class="space-y-1 text-[13px]">
            <!-- 待审批工单 -->
            <div
              v-if="canOpen('/financial/approvalFlow')"
              @click="$router.push('/financial/approvalFlow')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <ClipboardCheck class="w-4 h-4 text-st-primary shrink-0" />
                <div>
                  <div class="font-medium text-st-title">
                    退费审批
                  </div>
                  <div class="text-xs text-st-muted">财务中心待复核审批单据</div>
                </div>
              </div>
              <span class="font-mono font-medium text-xs text-st-primary bg-st-primary-light px-2 py-0.5 rounded-md">
                {{ stats.pendingApprovalCount }} 笔待办
              </span>
            </div>

            <!-- 待分班学员池 -->
            <div
              v-if="canOpen('/studentCenter/unassigned')"
              @click="$router.push('/studentCenter/unassigned')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <Users class="w-4 h-4 text-st-warning shrink-0" />
                <div>
                  <div class="font-medium text-st-title">
                    待分班学员
                  </div>
                  <div class="text-xs text-st-muted">已购课但尚未安排班级的学员</div>
                </div>
              </div>
              <span class="font-mono font-medium text-xs text-st-warning-deep bg-st-warning-light px-2 py-0.5 rounded-md">
                {{ stats.unassignedCount }} 人待排
              </span>
            </div>

            <!-- 冲突排课预警 -->
            <div
              v-if="canOpen('/educational/timeSchedule')"
              @click="$router.push('/educational/timeSchedule')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <Zap class="w-4 h-4 text-st-purple shrink-0" />
                <div>
                  <div class="font-medium text-st-title">
                    排课冲突
                  </div>
                  <div class="text-xs text-st-muted">教师或教室在此时段是否重叠</div>
                </div>
              </div>
              <span
                :class="[
                  'font-mono font-medium text-xs px-2 py-0.5 rounded-md',
                  stats.conflictCount > 0 ? 'bg-st-danger-light text-st-danger-deep' : 'bg-st-success-light text-st-success'
                ]"
              >
                {{ stats.conflictCount > 0 ? `${stats.conflictCount} 处冲突` : '正常' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  GraduationCap,
  Users,
  Calendar,
  Monitor,
  School,
  Clock,
  BookOpen,
  CircleDollarSign,
  ClipboardCheck,
  CalendarDays,
  Zap,
  ArrowRight,
  RefreshCw
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { canAccessRoute } from '@/router/access'
import { useTenantStore } from '@/stores/tenantStore'
import { financialApi, studentApi, curriculumApi, educationalApi } from '@/api'
import TeachingMetricsPanel from './components/TeachingMetricsPanel.vue'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const currentCampus = computed(() => tenantStore.currentCampus)
const currentUserName = computed(() => authStore.user?.realName || authStore.user?.account || '冬海潮')
const currentUserRole = computed(() => authStore.user?.roleName || '超级管理员')

// 动态时间问候语
const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '早上好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  return '晚上好'
})

const refreshing = ref(false)

const defaultStats = {
  studentCount: 0,
  courseCount: 0,
  orderCount: 0,
  paidOrderCount: 0,
  totalRevenue: 0,
  scheduleCount: 0,
  conflictCount: 0,
  pendingApprovalCount: 0,
  unassignedCount: 0
}

const remoteStats = ref({ ...defaultStats })
const recentSchedules = ref<any[]>([])
const upcomingCount = ref(0)

async function loadStats(isSilent = true) {
  if (!isSilent) refreshing.value = true
  let failed = false
  try {
    const campusId = tenantStore.currentCampusId
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const upcomingEnd = new Date(today)
    upcomingEnd.setDate(today.getDate() + 13)

    // 列表接口均为分页接口：计数一律取后端 total / summary，避免只数到第一页
    const [ordersRes, studentsRes, coursesRes, scheduleRes, approvalsRes, unassignedRes] = await Promise.all([
      financialApi.getOrders({ campusId, period: 'month', status: 'paid', pageSize: 1 }).catch(() => null),
      // 与学员中心「正常在读」筛选同口径（normal + in_class）
      studentApi.getStudents({ campusId, status: 'normal', pageSize: 1 }).catch(() => null),
      curriculumApi.getCourses({ campusId, status: 'enabled', pageSize: 1 }).catch(() => null),
      // 本周 (周一到周日) 和未来 14 天的排课重叠，合并成一次请求：从周一取到第 14 天
      educationalApi.getScheduleEvents({ campusId, startDate: fmt(monday), endDate: fmt(upcomingEnd > sunday ? upcomingEnd : sunday) }).catch(() => null),
      financialApi.getApprovals({ campusId, status: 'pending', pageSize: 1 }).catch(() => null),
      educationalApi.getUnassignedRoster({ campusId, page: 1, pageSize: 1 }).catch(() => null)
    ])

    const listOf = (res: any) => Array.isArray(res?.data) ? res.data : (res?.data?.list || res?.data?.items || [])
    const totalOf = (res: any) => Number(res?.data?.total ?? listOf(res).length) || 0

    const orderSummary = (ordersRes as any)?.data?.summary
    const allSchedules = listOf(scheduleRes)
    const weekSchedules = allSchedules.filter((s: any) => s.status !== 'cancelled' && s.date >= fmt(monday) && s.date <= fmt(sunday))
    const isConflict = (s: any) => s.semanticType === 'conflict' || Boolean(s.hasConflict || s.isConflict)
    const nowHm = `${pad(today.getHours())}:${pad(today.getMinutes())}`
    const upcoming = allSchedules
      .filter((s: any) => s.date >= fmt(today) && s.date <= fmt(upcomingEnd))
      .filter((s: any) => s.status !== 'cancelled' && s.status !== 'completed')
      .filter((s: any) => s.date > fmt(today) || (s.endTime || '23:59') >= nowHm)
    const unassignedData = (unassignedRes as any)?.data

    remoteStats.value = {
      studentCount: totalOf(studentsRes),
      courseCount: totalOf(coursesRes),
      orderCount: Number(orderSummary?.totalOrders ?? 0),
      paidOrderCount: Number(orderSummary?.totalPaidOrders ?? 0),
      totalRevenue: Number(orderSummary?.totalActualAmount ?? 0),
      scheduleCount: weekSchedules.length,
      conflictCount: weekSchedules.filter(isConflict).length,
      pendingApprovalCount: totalOf(approvalsRes),
      unassignedCount: Number(unassignedData?.summary?.totalStudents ?? unassignedData?.total ?? 0)
    }
    upcomingCount.value = upcoming.length

    // 近期课次：今天起 14 天内未结课课次，按日期时间升序取前 5 节
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    recentSchedules.value = upcoming.slice(0, 5).map((s: any) => {
      const d = new Date(`${s.date}T00:00:00`)
      return {
        id: s.id,
        lessonTitle: s.lessonTitle || s.courseName,
        className: s.className,
        teacherName: s.teacherName,
        classroomName: s.classroomName,
        dateLabel: s.date === fmt(today) ? '今天' : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${weekdays[d.getDay()]}`,
        timeSlot: s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : '',
        isConflict: isConflict(s),
        status: s.status || 'scheduled'
      }
    })
  } catch (err) {
    failed = true
    console.warn('[Dashboard] 加载统计数据异常:', err)
  } finally {
    // 手动刷新：成功、失败如实提示 (以前失败也提示「已刷新」，还人为多等 400ms)
    if (!isSilent) {
      refreshing.value = false
      if (failed) ElMessage.error('刷新失败，请稍后重试')
      else ElMessage.success('数据已刷新')
    }
  }
}

function handleManualRefresh() {
  loadStats(false)
}

const stats = computed(() => remoteStats.value)

onMounted(() => {
  loadStats(true)
})

// 切换校区时 MainLayout 会按校区重建整个页面并重新加载，不再在页面里重复监听校区

// 精炼的9大核心业务直通车（每一个对应独立完整的业务页面）
const quickAccessList = [
  { name: '学员全景', desc: '档案与生命周期', icon: GraduationCap, bgClass: 'bg-st-primary-light text-st-primary', path: '/studentCenter/allStudent' },
  { name: '待分班池', desc: '待入班履约学员', icon: Users, bgClass: 'bg-st-warning-light text-st-warning', path: '/studentCenter/unassigned' },
  { name: '排课看板', desc: '7×15智能排课', icon: Calendar, bgClass: 'bg-st-purple-light text-st-purple', path: '/educational/timeSchedule' },
  { name: '教学讲台', desc: '讲师课堂互动', icon: Monitor, bgClass: 'bg-cyan-50 text-cyan-600', path: '/educational/workbench' },
  { name: '班级班容', desc: '班级负荷与预警', icon: School, bgClass: 'bg-st-success-light text-st-success', path: '/educational/classManagement' },
  { name: '考勤消课', desc: '一键点名与扣课', icon: Clock, bgClass: 'bg-st-success-light text-st-success', path: '/educational/attendance' },
  { name: '课程研发', desc: '标准化教研大纲', icon: BookOpen, bgClass: 'bg-st-primary-light text-st-primary', path: '/curriculum/courseManage' },
  { name: '财务流水', desc: '营收订单与核验', icon: CircleDollarSign, bgClass: 'bg-st-warning-light text-st-warning', path: '/financial/orderManagement' },
  { name: '审批中心', desc: '业务退费审批单', icon: ClipboardCheck, bgClass: 'bg-st-danger-light text-st-danger', path: '/financial/approvalFlow' }
]

/** 当前账号能否打开这个页面 (页面权限写在路由 meta.requiresPermission 上) */
function canOpen(path: string): boolean {
  return canAccessRoute(router.resolve(path), authStore)
}

// 只显示当前账号有权限打开的入口
const visibleQuickAccess = computed(() => quickAccessList.filter((item) => canOpen(item.path)))
</script>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  background: var(--st-color-card);
  border: 1px solid var(--st-color-border);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-card);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.kpi-card:hover {
  border-color: var(--st-color-border-dark);
  box-shadow: var(--st-shadow-hover);
}
.panel-card {
  padding: 20px;
  background: var(--st-color-card);
  border: 1px solid var(--st-color-border);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-card);
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--st-color-title);
}
.todo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.todo-row:hover {
  background: var(--st-color-header);
}
</style>
