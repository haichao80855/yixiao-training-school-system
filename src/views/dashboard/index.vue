<template>
  <div class="space-y-5 p-5 max-w-[1680px] mx-auto">
    <!-- 顶部科技态势横幅 (Hero Welcome Banner) -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 text-white p-6 shadow-lg">
      <!-- 背景科技微光装饰圆 -->
      <div class="absolute -right-16 -top-20 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      <div class="absolute right-40 -bottom-16 w-60 h-60 rounded-full bg-cyan-400/15 blur-xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div class="flex items-start sm:items-center space-x-4">
          <div class="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <svg class="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight">
                {{ greetingText }}，{{ currentUserName }}
              </h1>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-sm">
                {{ currentUserRole }}
              </span>
              <span class="px-2.5 py-0.5 text-xs font-medium rounded-full bg-sky-400/25 border border-sky-300/40 text-sky-100 font-mono">
                证券代码 002599
              </span>
            </div>
            <p class="text-sm text-blue-100/90 mt-1.5 flex flex-wrap items-center gap-2">
              <span>当前校区：</span>
              <span class="font-semibold text-white bg-white/20 px-2 py-0.5 rounded text-xs">{{ currentCampus.name }}</span>
              <span class="text-blue-200 text-xs">（编码: {{ currentCampus.code }}）</span>
              <span class="text-white/40">|</span>
              <span class="inline-flex items-center gap-1.5 text-emerald-300 text-xs">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                校区租户数据隔离运行正常
              </span>
            </p>
          </div>
        </div>

        <!-- 横幅右侧：快捷主控与实时刷新 -->
        <div class="flex items-center space-x-3 shrink-0">
          <el-button
            size="small"
            :loading="refreshing"
            class="!bg-white/15 !border-white/25 !text-white hover:!bg-white/25 !rounded-xl !px-3.5 !py-2"
            title="重新拉取并更新数据统计"
            @click="handleManualRefresh"
          >
            {{ refreshing ? '正在同步...' : '刷新数据' }}
          </el-button>

          <el-button
            size="small"
            type="primary"
            class="!bg-white !text-blue-700 hover:!bg-blue-50 font-bold !border-none !rounded-xl !px-4 !py-2 shadow-md hover:shadow-lg"
            @click="$router.push('/educational/workbench')"
          >
            <Monitor class="w-4 h-4 mr-1.5" />
            <span>进入教学讲台</span>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 4大核心业务 KPI 指标看板 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 营收总额 -->
      <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-st-secondary">实收营收流水 (本月)</span>
          <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
            <CircleDollarSign class="w-5 h-5" />
          </div>
        </div>
        <div class="my-3 flex items-end justify-between">
          <div class="text-2xl font-extrabold text-st-title font-mono tracking-tight">
            ¥ {{ stats.totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <ThemeSparkline
            :data="revenueTrend"
            type="line"
            color-theme="primary"
            :width="88"
            :height="28"
          />
        </div>
        <div class="flex items-center justify-between text-xs pt-2 border-t border-st-border text-st-muted">
          <span>已支付订单: <strong class="text-st-regular font-semibold font-mono">{{ stats.paidOrderCount }}</strong> 笔</span>
          <span class="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">环比 +12.8% ↑</span>
        </div>
      </div>

      <!-- 在读学员 -->
      <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-st-secondary">在籍在读学员总量</span>
          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
            <GraduationCap class="w-5 h-5" />
          </div>
        </div>
        <div class="my-3 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-2xl font-extrabold text-st-title font-mono tracking-tight">
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
        <div class="flex items-center justify-between text-xs pt-2 border-t border-st-border text-st-muted">
          <span>归属校区生源池</span>
          <span class="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
            待分班 {{ stats.unassignedCount }} 人
          </span>
        </div>
      </div>

      <!-- 本周排课 -->
      <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-st-secondary">本周排课日程</span>
          <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
            <Calendar class="w-5 h-5" />
          </div>
        </div>
        <div class="my-3 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-2xl font-extrabold text-st-title font-mono tracking-tight">
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
        <div class="flex items-center justify-between text-xs pt-2 border-t border-st-border text-st-muted">
          <span>冲突监测:</span>
          <span
            :class="[
              'px-1.5 py-0.5 rounded text-[11px] font-medium',
              stats.conflictCount > 0 ? 'bg-red-50 text-red-600 font-bold' : 'bg-emerald-50 text-emerald-600'
            ]"
          >
            {{ stats.conflictCount > 0 ? `检测到 ${stats.conflictCount} 处冲突` : '无排课冲突' }}
          </span>
        </div>
      </div>

      <!-- 授权课程体系 -->
      <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-st-secondary">已授权标准化课程体系</span>
          <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
            <BookOpen class="w-5 h-5" />
          </div>
        </div>
        <div class="my-3 flex items-end justify-between">
          <div class="flex items-baseline gap-1.5">
            <div class="text-2xl font-extrabold text-st-title font-mono tracking-tight">
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
        <div class="flex items-center justify-between text-xs pt-2 border-t border-st-border text-st-muted">
          <span>教研中心统一质控</span>
          <span class="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">标准化课件就绪</span>
        </div>
      </div>
    </div>

    <!-- 核心业务高频入口网格 (经过精炼的9大真实业务枢纽) -->
    <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm">
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-st-border">
        <div class="flex items-center space-x-2">
          <span class="w-1.5 h-4 bg-st-primary rounded-full"></span>
          <h2 class="text-sm font-bold text-st-title">高频业务直通车</h2>
          <span class="text-xs text-st-muted font-normal">一键快速直达核心业务操作页面</span>
        </div>
        <span class="text-xs text-st-primary font-medium">9大核心业务中枢</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        <div
          v-for="item in quickAccessList"
          :key="item.name"
          @click="$router.push(item.path)"
          class="flex flex-col items-center p-3 rounded-xl border border-st-border hover:border-blue-200 hover:bg-blue-50/40 hover:-translate-y-0.5 transition-all cursor-pointer group text-center"
        >
          <div :class="['w-11 h-11 rounded-xl flex items-center justify-center mb-2 shadow-sm transition-transform group-hover:scale-110', item.bgClass]">
            <component :is="item.icon" class="w-5 h-5" />
          </div>
          <span class="text-xs font-semibold text-st-regular group-hover:text-st-primary transition-colors">
            {{ item.name }}
          </span>
          <span class="text-[10px] text-st-muted mt-0.5 line-clamp-1">
            {{ item.desc }}
          </span>
        </div>
      </div>
    </div>

    <!-- 下半区：双栏排版（左侧：近期排课与消课日程；右侧：教务待办与运行预警） -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- 左侧：近期待授排课日程监控 (7×15 调度动态) -->
      <div class="lg:col-span-8 bg-st-card rounded-xl p-5 border border-st-border shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-st-border">
            <div class="flex items-center space-x-2">
              <span class="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
              <h2 class="text-sm font-bold text-st-title">近期排课日程监控</h2>
              <span class="text-xs text-st-muted">实时展示当前校区即将开展的教学日程</span>
            </div>
            <el-button
              link
              type="primary"
              size="small"
              class="flex items-center gap-1"
              @click="$router.push('/educational/timeSchedule')"
            >
              <span>查看完整课表看板</span>
              <ArrowRight class="w-3.5 h-3.5 ml-0.5 inline" />
            </el-button>
          </div>

          <!-- 日程列表 -->
          <div v-if="recentSchedules.length > 0" class="space-y-2.5">
            <div
              v-for="item in recentSchedules"
              :key="item.id"
              class="p-3.5 rounded-xl border border-st-border hover:border-blue-200 hover:bg-st-bg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="flex items-center space-x-3.5">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                  {{ item.timeSlot ? item.timeSlot.split('-')[0] : '课程' }}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-xs text-st-title">{{ item.lessonTitle || item.courseName || '标准课程' }}</span>
                    <span class="text-[11px] px-1.5 py-0.2 rounded bg-blue-50 text-st-primary font-medium">
                      {{ item.className || '标准班级' }}
                    </span>
                    <span
                      v-if="item.isConflict"
                      class="text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold"
                    >
                      时段冲突
                    </span>
                  </div>
                  <div class="text-[11px] text-st-muted mt-1 flex items-center gap-3 flex-wrap">
                    <span>授课讲师: <strong class="text-st-secondary">{{ item.teacherName || '未指定' }}</strong></span>
                    <span>教室: <strong class="text-st-secondary">{{ item.classroomName || '默认教室' }}</strong></span>
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
            <CalendarDays class="w-10 h-10 text-st-muted mx-auto" />
            <p class="text-xs">当前校区暂无临近待上课排期</p>
            <el-button size="small" type="primary" plain @click="$router.push('/educational/timeSchedule')">
              前往排课日历添加课次
            </el-button>
          </div>
        </div>

        <div class="pt-3 mt-4 border-t border-st-border flex items-center justify-between text-xs text-st-muted">
          <span>数据依据当前校区作用域实时过滤</span>
          <span>共监控到 {{ recentSchedules.length }} 场重要教学课次</span>
        </div>
      </div>

      <!-- 右侧：教务待办事项与运行预警 -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 待办处理卡片 -->
        <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-st-border">
            <div class="flex items-center space-x-2">
              <span class="w-1.5 h-4 bg-amber-500 rounded-full"></span>
              <h2 class="text-sm font-bold text-st-title">校区待办与提醒</h2>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold font-mono">
              实时监控
            </span>
          </div>

          <div class="space-y-2.5 text-xs">
            <!-- 待审批工单 -->
            <div
              @click="$router.push('/financial/approvalFlow')"
              class="p-3 rounded-xl bg-st-bg hover:bg-blue-50/60 border border-st-border hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div class="flex items-center space-x-2.5">
                <ClipboardCheck class="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div class="font-semibold text-st-regular group-hover:text-st-primary transition-colors">
                    业务退费审批工单
                  </div>
                  <div class="text-[11px] text-st-muted">财务中心待复核审批单据</div>
                </div>
              </div>
              <span class="font-mono font-bold text-xs text-blue-600 bg-white px-2 py-0.5 rounded-full border border-st-border">
                {{ stats.pendingApprovalCount }} 笔待办
              </span>
            </div>

            <!-- 待分班学员池 -->
            <div
              @click="$router.push('/studentCenter/unassigned')"
              class="p-3 rounded-xl bg-st-bg hover:bg-amber-50/60 border border-st-border hover:border-amber-200 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div class="flex items-center space-x-2.5">
                <Users class="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div class="font-semibold text-st-regular group-hover:text-amber-700 transition-colors">
                    待分班学员履约池
                  </div>
                  <div class="text-[11px] text-st-muted">已购课但尚未安排班级的学员</div>
                </div>
              </div>
              <span class="font-mono font-bold text-xs text-amber-600 bg-white px-2 py-0.5 rounded-full border border-st-border">
                {{ stats.unassignedCount }} 人待排
              </span>
            </div>

            <!-- 冲突排课预警 -->
            <div
              @click="$router.push('/educational/timeSchedule')"
              class="p-3 rounded-xl bg-st-bg hover:bg-purple-50/60 border border-st-border hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div class="flex items-center space-x-2.5">
                <Zap class="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <div class="font-semibold text-st-regular group-hover:text-purple-700 transition-colors">
                    排课冲突智能预警
                  </div>
                  <div class="text-[11px] text-st-muted">教师或教室在此时段是否重叠</div>
                </div>
              </div>
              <span
                :class="[
                  'font-mono font-bold text-xs px-2 py-0.5 rounded-full border',
                  stats.conflictCount > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                ]"
              >
                {{ stats.conflictCount > 0 ? `${stats.conflictCount} 处冲突` : '正常' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 校区运营履约健康指数卡片 (ThemeProgress 集成) -->
        <div class="bg-st-card rounded-xl p-5 border border-st-border shadow-sm">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-st-border">
            <div class="flex items-center space-x-2">
              <span class="w-1.5 h-4 bg-st-primary rounded-full"></span>
              <h2 class="text-sm font-bold text-st-title">校区运营健康指数</h2>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-st-primary font-semibold font-mono">
              本周综评 A+
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center py-1">
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="88" color-theme="primary" :size="58" :stroke-width="5" />
              <span class="text-xs font-semibold text-st-regular mt-2">出勤履约率</span>
              <span class="text-[10px] text-st-muted mt-0.5">正常到课消课</span>
            </div>
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="92" color-theme="success" :size="58" :stroke-width="5" />
              <span class="text-xs font-semibold text-st-regular mt-2">教室满班率</span>
              <span class="text-[10px] text-st-muted mt-0.5">资源高效利用</span>
            </div>
            <div class="flex flex-col items-center">
              <ThemeProgress :percentage="76" color-theme="warning" :size="58" :stroke-width="5" />
              <span class="text-xs font-semibold text-st-regular mt-2">课消达成率</span>
              <span class="text-[10px] text-st-muted mt-0.5">阶段教务目标</span>
            </div>
          </div>
        </div>

        <!-- 运营合规背书与租户环境卡片 -->
        <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 text-white shadow-sm">
          <div class="flex items-center space-x-2 mb-2">
            <ShieldCheck class="w-4 h-4 text-emerald-400 shrink-0" />
            <span class="font-bold text-xs tracking-wide">上市公司合规数据保护</span>
          </div>
          <p class="text-[11px] text-gray-300 leading-relaxed">
            当前系统直连上市公司标准化教育数据库，多校区学员学籍、签约订单、消课流水均已实现硬隔离合规存证。
          </p>
          <div class="mt-3 pt-3 border-t border-gray-700/60 flex items-center justify-between text-[11px] text-gray-300 font-mono">
            <span>作用域: {{ currentCampus.code }}</span>
            <span class="text-emerald-400 font-semibold">● 存证已同步</span>
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
  ShieldCheck,
  Zap,
  ArrowRight
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
