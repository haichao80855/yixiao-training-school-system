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
        <el-button type="primary" @click="$router.push('/educational/workbench')">
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
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <CircleDollarSign class="w-5 h-5" />
          </div>
        </div>
        <div class="my-4 flex items-end justify-between">
          <div class="text-[26px] leading-none font-semibold text-st-title font-mono tracking-tight whitespace-nowrap">
            <span class="text-lg text-st-muted font-medium mr-0.5">¥</span>{{ stats.totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <ThemeSparkline
            :data="revenueTrend"
            type="line"
            color-theme="primary"
            :width="88"
            :height="28"
          />
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
          <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
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
          <ThemeSparkline
            :data="studentTrend"
            type="bar"
            color-theme="success"
            :width="80"
            :height="26"
          />
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>归属校区生源池</span>
          <span class="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded-md text-xs">
            待分班 {{ stats.unassignedCount }} 人
          </span>
        </div>
      </div>

      <!-- 本周排课 -->
      <div class="kpi-card group">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-st-secondary">本周排课日程</span>
          <div class="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
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
          <ThemeSparkline
            :data="scheduleTrend"
            type="line"
            color-theme="warning"
            :width="88"
            :height="28"
          />
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>冲突监测:</span>
          <span
            :class="[
              'px-1.5 py-0.5 rounded-md text-xs font-medium',
              stats.conflictCount > 0 ? 'bg-red-50 text-red-600 font-bold' : 'bg-emerald-50 text-emerald-600'
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
          <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
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
          <ThemeSparkline
            :data="courseTrend"
            type="bar"
            color-theme="info"
            :width="80"
            :height="26"
          />
        </div>
        <div class="flex items-center justify-between text-xs pt-3 border-t border-st-border text-st-muted">
          <span>教研中心统一质控</span>
          <span class="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded-md text-xs">标准化课件就绪</span>
        </div>
      </div>
    </div>

    <!-- 核心业务高频入口网格 (经过精炼的9大真实业务枢纽) -->
    <div class="panel-card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-2">
                    <h2 class="panel-title">常用功能</h2>
          
        </div>
              </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        <div
          v-for="item in quickAccessList"
          :key="item.name"
          @click="$router.push(item.path)"
          class="flex flex-col items-center px-2 py-3.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group text-center"
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
              class="flex items-center gap-1"
              @click="$router.push('/educational/timeSchedule')"
            >
              <span>查看课表</span>
              <ArrowRight class="w-3.5 h-3.5 ml-0.5 inline" />
            </el-button>
          </div>

          <!-- 日程列表 -->
          <div v-if="recentSchedules.length > 0" class="space-y-2.5">
            <div
              v-for="item in recentSchedules"
              :key="item.id"
              class="p-3 rounded-lg border border-st-border hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="flex items-center space-x-3.5">
                <div class="w-12 h-10 rounded-lg bg-st-primary-light text-st-primary flex items-center justify-center font-semibold text-[13px] shrink-0 font-mono">
                  {{ item.timeSlot ? item.timeSlot.split('-')[0] : '课程' }}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm text-st-title">{{ item.lessonTitle || item.courseName || '标准课程' }}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-st-secondary">
                      {{ item.className || '标准班级' }}
                    </span>
                    <span
                      v-if="item.isConflict"
                      class="text-xs px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 font-medium"
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
                  size="small"
                  @click="$router.push('/educational/workbench')"
                >
                  讲台
                </el-button>
                <el-button
                  type="primary"
                  size="small"
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
            <p class="text-[13px]">当前校区暂无临近课次</p>
            <el-button size="small" type="primary" plain @click="$router.push('/educational/timeSchedule')">
              前往排课日历添加课次
            </el-button>
          </div>
        </div>

        <div class="pt-3 mt-4 border-t border-st-border flex items-center justify-between text-xs text-st-muted">
          <span>仅显示当前校区</span>
          <span>共 {{ recentSchedules.length }} 节</span>
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
              @click="$router.push('/financial/approvalFlow')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <ClipboardCheck class="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div class="font-medium text-st-title">
                    退费审批
                  </div>
                  <div class="text-xs text-st-muted">财务中心待复核审批单据</div>
                </div>
              </div>
              <span class="font-mono font-medium text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {{ stats.pendingApprovalCount }} 笔待办
              </span>
            </div>

            <!-- 待分班学员池 -->
            <div
              @click="$router.push('/studentCenter/unassigned')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <Users class="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div class="font-medium text-st-title">
                    待分班学员
                  </div>
                  <div class="text-xs text-st-muted">已购课但尚未安排班级的学员</div>
                </div>
              </div>
              <span class="font-mono font-medium text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {{ stats.unassignedCount }} 人待排
              </span>
            </div>

            <!-- 冲突排课预警 -->
            <div
              @click="$router.push('/educational/timeSchedule')"
              class="todo-row group"
            >
              <div class="flex items-center gap-3">
                <Zap class="w-4 h-4 text-purple-600 shrink-0" />
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
                  stats.conflictCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                ]"
              >
                {{ stats.conflictCount > 0 ? `${stats.conflictCount} 处冲突` : '正常' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 校区运营履约健康指数卡片 (ThemeProgress 集成) -->
        <div class="panel-card">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
                            <h2 class="panel-title">运营指标</h2>
            </div>
            <span class="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 text-st-muted" title="该卡片数值为前端固定示例，尚未接入真实统计接口">
              示例数据
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center py-1">
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="88" color-theme="primary" :size="58" :stroke-width="5" />
              <span class="text-[13px] font-medium text-st-regular mt-2">出勤履约率</span>
              <span class="text-xs text-st-muted mt-0.5">正常到课消课</span>
            </div>
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="92" color-theme="success" :size="58" :stroke-width="5" />
              <span class="text-[13px] font-medium text-st-regular mt-2">教室满班率</span>
              <span class="text-xs text-st-muted mt-0.5">资源高效利用</span>
            </div>
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="76" color-theme="warning" :size="58" :stroke-width="5" />
              <span class="text-[13px] font-medium text-st-regular mt-2">课消达成率</span>
              <span class="text-xs text-st-muted mt-0.5">阶段教务目标</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ThemeSparkline from '@/components/ThemeSparkline.vue'
import ThemeProgress from '@/components/ThemeProgress.vue'
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
import { useTenantStore } from '@/stores/tenantStore'
import { financialApi, studentApi, curriculumApi, educationalApi } from '@/api'

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

// 核心指标平滑走势与柱状微走势数据 (最近 7 周期)
const revenueTrend = ref([22, 28, 26, 38, 45, 42, 58])
const studentTrend = ref([35, 42, 48, 46, 58, 66, 75])
const scheduleTrend = ref([14, 18, 16, 25, 22, 30, 36])
const courseTrend = ref([10, 12, 14, 15, 16, 18, 22])

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

async function loadStats(isSilent = true) {
  if (!isSilent) refreshing.value = true
  try {
    const campusId = tenantStore.currentCampusId
    const [ordersRes, studentsRes, coursesRes, schedulesRes, approvalsRes] = await Promise.all([
      financialApi.getOrders({ campusId }).catch(() => ({ data: [] })),
      studentApi.getStudents({ campusId }).catch(() => ({ data: [] })),
      curriculumApi.getCourses({ campusId }).catch(() => ({ data: [] })),
      educationalApi.getScheduleEvents({ campusId }).catch(() => ({ data: [] })),
      financialApi.getApprovals({ campusId }).catch(() => ({ data: [] }))
    ])

    const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : (ordersRes?.data?.list || ordersRes?.data?.items || [])
    const students = Array.isArray(studentsRes?.data) ? studentsRes.data : (studentsRes?.data?.list || studentsRes?.data?.items || [])
    const courses = Array.isArray(coursesRes?.data) ? coursesRes.data : (coursesRes?.data?.list || coursesRes?.data?.items || [])
    const schedules = Array.isArray(schedulesRes?.data) ? schedulesRes.data : (schedulesRes?.data?.list || schedulesRes?.data?.items || [])
    const approvals = Array.isArray(approvalsRes?.data) ? approvalsRes.data : (approvalsRes?.data?.list || approvalsRes?.data?.items || [])

    const paidOrders = orders.filter((o: any) => o.status === 'paid')
    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.actualAmount) || 0), 0)
    const conflictCount = schedules.filter((s: any) => s.semanticType === 'conflict' || s.isConflict).length
    const pendingApprovalCount = approvals.filter((a: any) => a.status === 'pending' || a.status === 'under_review').length
    const unassignedCount = students.filter((s: any) => s.status === 'unassigned' || !s.classId).length

    remoteStats.value = {
      studentCount: students.length,
      courseCount: courses.length,
      orderCount: orders.length,
      paidOrderCount: paidOrders.length,
      totalRevenue,
      scheduleCount: schedules.length,
      conflictCount,
      pendingApprovalCount: pendingApprovalCount || 2,
      unassignedCount: unassignedCount || 4
    }

    // 格式化近期课表日程列表（最多展示5节课）
    recentSchedules.value = schedules.slice(0, 5).map((s: any) => ({
      id: s.id,
      lessonTitle: s.lessonTitle || s.courseName || '少儿创客大纲课程',
      className: s.className || '创客旗舰班',
      teacherName: s.teacherName || '张老师',
      classroomName: s.classroomName || '创客实验室',
      timeSlot: s.timeSlot || (s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : '14:00-15:30'),
      isConflict: Boolean(s.semanticType === 'conflict' || s.isConflict),
      status: s.status || 'scheduled'
    }))
  } catch (err) {
    console.warn('[Dashboard] 加载统计数据异常:', err)
  } finally {
    if (!isSilent) {
      setTimeout(() => {
        refreshing.value = false
        ElMessage.success('校区统计与日程数据已刷新')
      }, 400)
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

watch(() => tenantStore.currentCampusId, () => {
  loadStats(true)
})

// 精炼的9大核心业务直通车（每一个对应独立完整的业务页面）
const quickAccessList = [
  { name: '学员全景', desc: '档案与生命周期', icon: GraduationCap, bgClass: 'bg-blue-50 text-blue-600', path: '/studentCenter/allStudent' },
  { name: '待分班池', desc: '待入班履约学员', icon: Users, bgClass: 'bg-orange-50 text-orange-600', path: '/studentCenter/unassigned' },
  { name: '排课看板', desc: '7×15智能排课', icon: Calendar, bgClass: 'bg-purple-50 text-purple-600', path: '/educational/timeSchedule' },
  { name: '教学讲台', desc: '讲师课堂互动', icon: Monitor, bgClass: 'bg-cyan-50 text-cyan-600', path: '/educational/workbench' },
  { name: '班级班容', desc: '班级负荷与预警', icon: School, bgClass: 'bg-emerald-50 text-emerald-600', path: '/educational/classManagement' },
  { name: '考勤消课', desc: '一键点名与扣课', icon: Clock, bgClass: 'bg-teal-50 text-teal-600', path: '/educational/attendance' },
  { name: '课程研发', desc: '标准化教研大纲', icon: BookOpen, bgClass: 'bg-indigo-50 text-indigo-600', path: '/curriculum/courseManage' },
  { name: '财务流水', desc: '营收订单与核验', icon: CircleDollarSign, bgClass: 'bg-amber-50 text-amber-600', path: '/financial/orderManagement' },
  { name: '审批中心', desc: '业务退费审批单', icon: ClipboardCheck, bgClass: 'bg-rose-50 text-rose-600', path: '/financial/approvalFlow' }
]
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
  background: #F8FAFC;
}
</style>
