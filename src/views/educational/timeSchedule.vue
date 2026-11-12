<template>
  <div class="p-5 space-y-3.5 bg-st-header min-h-screen">

    <!-- 顶部子 Tab 切换条 (对标截图: 上课日历 / 课表汇总 / 时间课表 / 教室课表 / 讲师课表 / 班级课表 / 冲突记录) -->
    <div class="bg-white rounded-lg border border-st-border px-5 py-2.5 shadow-sm flex items-center justify-between">
      <div class="flex items-center space-x-6 text-sm font-medium">
        <el-button
          v-for="tab in subTabs"
          :key="tab.key"
          link
          :class="[
            'pb-1.5 pt-1 relative transition-colors !text-sm',
            currentSubTab === tab.key
              ? '!text-st-primary font-bold after:content-[\'\'] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-st-primary'
              : '!text-st-regular hover:!text-st-primary'
          ]"
          @click="handleSubTabChange(tab.key)"
        >
          {{ tab.name }}
          <span v-if="tab.key === 'conflictRecord' && campusConflictCount > 0" class="ml-1 px-1.5 py-0.2 rounded-full bg-st-danger text-white text-xs">
            {{ campusConflictCount }}
          </span>
        </el-button>
      </div>

      <div class="text-xs text-st-muted flex items-center gap-2">
        <el-tag
          size="small"
          :type="isDataScopeSelf ? 'warning' : 'primary'"
          effect="plain"
          class="font-medium font-mono"
        >
          {{ isDataScopeSelf ? '仅本人数据 (已锁定只看本人课表)' : (authStore.user?.dataScope === 'all' ? '全部校区数据透视' : '本校数据透视') }}
        </el-tag>
        <span>当前校区：</span>
        <el-tag size="small" type="primary">{{ currentCampus.name }}</el-tag>
      </div>
    </div>

    <!-- 筛选搜索栏 (HighDensityGrid 集成) -->
    <HighDensityGrid :cols="8">
      <!-- 讲师 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">主讲讲师</label>
        <el-select
          v-model="filterTeacher"
          :placeholder="isDataScopeSelf ? `仅本人 (${currentTeacherName})` : '全部讲师'"
          :disabled="isDataScopeSelf"
          clearable
          class="w-full"
        >
          <el-option v-if="!isDataScopeSelf" label="全部讲师" value="" />
          <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </div>

      <!-- 教务/班主任 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">教务班主任</label>
        <el-select v-model="filterAdvisor" placeholder="全部教务" clearable class="w-full">
          <el-option v-for="a in advisors" :key="a.id" :label="a.name" :value="a.id" />
        </el-select>
      </div>

      <!-- 全部课程 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">报读课程</label>
        <el-select v-model="filterCourse" placeholder="全部课程" clearable class="w-full">
          <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </div>

      <!-- 教室 -->
      <div class="sm:col-span-2">
        <label class="block text-xs text-st-secondary mb-1">物理教室</label>
        <el-select v-model="filterClassroom" placeholder="全部教室" clearable class="w-full">
          <el-option v-for="r in classrooms" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
      </div>

      <template #footer>
        <div class="space-x-2">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
        </div>
        <div class="flex items-center space-x-2">
          <el-button type="danger" plain @click="openConflictCenter">
            <template #icon><Zap class="w-4 h-4" /></template>
            冲突检测中心 ({{ campusConflictCount }})
          </el-button>
          <el-button @click="handleExport">
            导出课表
          </el-button>
          <el-button type="primary" @click="openQuickSchedule()">
            + 快速排课
          </el-button>
        </div>
      </template>
    </HighDensityGrid>

    <!-- 冲突预警提示横条（当有冲突课次时展现） -->
    <div
      v-if="campusConflictCount > 0"
      class="bg-st-danger-light border border-st-danger-border rounded-lg p-3 text-xs text-st-danger-deep flex items-center justify-between shadow-sm animate-pulse"
    >
      <div class="flex items-center space-x-2">
        <AlertTriangle class="w-4 h-4 text-st-danger shrink-0" />
        <span>
          三维碰撞检测引擎在当前校区 [<b>{{ currentCampus.name }}</b>] 发现
          <b class="text-st-danger text-sm font-extrabold mx-0.5">{{ campusConflictCount }}</b> 处日程重叠冲突（讲师/物理教室时段碰撞），排课卡片已自动红框警示！
        </span>
      </div>
      <el-button type="danger" plain @click="openConflictCenter">
        立即查看冲突详情
      </el-button>
    </div>

    <!-- 周次控制器与四色图例栏 -->
    <div class="bg-white rounded-lg px-5 py-3 shadow-sm border border-st-border flex flex-col md:flex-row md:items-center justify-between gap-3">
      <!-- 周次切换控件 -->
      <div class="flex items-center space-x-2.5">
        <el-button circle :icon="ArrowLeft" title="上一周" aria-label="上一周" @click="prevWeek" />
        <span class="font-bold text-st-title text-sm min-w-[210px] text-center tracking-wide">
          {{ currentWeekDisplay }}
        </span>
        <el-button circle :icon="ArrowRight" title="下一周" aria-label="下一周" @click="nextWeek" />
        <el-button plain @click="resetToCurrentWeek">
          返回本周
        </el-button>
      </div>

      <!-- 四色语义图例 (对标截图: 绿色已上日程 / 红色冲突日程 / 紫色我的日程 / 蓝色其他日程) -->
      <div class="flex items-center space-x-5 text-xs text-st-secondary">
        <div class="flex items-center space-x-1.5">
          <span class="w-3 h-3 rounded-full bg-st-success inline-block"></span>
          <span>已上日程</span>
        </div>
        <div class="flex items-center space-x-1.5">
          <span class="w-3 h-3 rounded-full bg-st-danger inline-block animate-ping"></span>
          <span class="text-st-danger font-medium">冲突日程</span>
        </div>
        <div class="flex items-center space-x-1.5">
          <span class="w-3 h-3 rounded-full bg-st-purple inline-block"></span>
          <span class="text-st-purple">我的日程</span>
        </div>
        <div class="flex items-center space-x-1.5">
          <span class="w-3 h-3 rounded-full bg-st-primary inline-block"></span>
          <span>其他日程</span>
        </div>
      </div>
    </div>

    <!-- 视图模式 1: 7x15 动态时间排课网格 (默认主视图) -->
    <div v-if="currentSubTab === 'timeClassSchedule' || currentSubTab === 'attendClassCalendar'" v-loading="listLoading" class="bg-white rounded-lg shadow-sm border border-st-border overflow-hidden">
      <div v-if="listError" class="flex items-center justify-between gap-3 px-4 py-2.5 bg-st-danger-light text-st-danger-deep text-sm border-b border-st-danger-border" role="alert">
        <span>课表加载失败：{{ listError }}</span>
        <el-button size="small" @click="loadSchedules">重新加载</el-button>
      </div>
      <div class="overflow-x-auto w-full min-w-0">
        <div class="min-w-[840px]">
          <!-- 星期表头 (7 天) -->
          <div class="grid grid-cols-[80px_repeat(7,1fr)] bg-st-header border-b border-st-border text-xs font-semibold text-st-title text-center select-none sticky top-0 z-20">
            <div class="py-2.5 border-r border-st-border bg-st-fill text-st-muted flex items-center justify-center">
              时间 / 星期
            </div>
        <div
          v-for="day in currentWeekDays"
          :key="day.date"
          :class="[
            'py-2.5 border-r border-st-border last:border-r-0 transition-colors',
            day.isToday ? 'bg-st-primary-light/70 text-st-primary' : 'bg-st-header'
          ]"
        >
          <div class="flex items-center justify-center gap-1">
            <span>{{ day.label }}</span>
            <span v-if="day.isToday" class="px-1.5 py-0.2 rounded bg-st-primary text-white text-xs font-bold">今天</span>
          </div>
        </div>
      </div>

      <!-- 7x15 动态时间网格画布 (07:00 至 22:00，共 15 小时 = 900px 高度) -->
      <div class="relative max-h-[750px] overflow-y-auto overflow-x-hidden">
        <!-- 背景时间刻度网格 (每小时 60px，内含 30 分钟虚线分割) -->
        <div class="relative w-full">
          <div
            v-for="hour in hours"
            :key="hour"
            class="grid grid-cols-[80px_repeat(7,1fr)] h-[60px] border-b border-st-border relative"
          >
            <!-- 左侧时间刻度标签 -->
            <div class="border-r border-st-border bg-st-header text-xs font-mono text-st-muted flex items-start justify-center pt-1 select-none">
              {{ String(hour).padStart(2, '0') }}:00
            </div>

            <!-- 7 个空列（带 30 分钟虚线分割与悬浮快速排课响应） -->
            <div
              v-for="day in currentWeekDays"
              :key="day.fullDate"
              class="border-r border-st-border last:border-r-0 relative group hover:bg-st-primary-light/20 transition-colors cursor-pointer"
              @click="handleGridCellClick(day.fullDate, hour)"
            >
              <!-- 30 分钟半小时虚线分割线 -->
              <div class="absolute top-[30px] left-0 right-0 border-t border-dashed border-st-border pointer-events-none"></div>

              <!-- 悬浮微小提示 -->
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span class="text-xs text-st-primary/80 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-st-primary-border">
                  + 点击排课
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 绝对定位层：Lane 自适应多列日程卡片渲染 (覆盖各天列) -->
        <div class="absolute inset-0 left-[80px] pointer-events-none grid grid-cols-7">
          <div
            v-for="day in currentWeekDays"
            :key="day.fullDate"
            class="relative h-[900px] border-r border-transparent last:border-r-0"
          >
            <!-- 当天如果是今天，绘制当前时刻红色横线指示器 -->
            <div
              v-if="day.isToday && currentMinuteLineTop >= 0 && currentMinuteLineTop <= 900"
              class="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              :style="{ top: `${currentMinuteLineTop}px` }"
            >
              <span class="w-2 h-2 rounded-full bg-st-danger -ml-1"></span>
              <div class="w-full border-t-2 border-st-danger shadow-sm"></div>
            </div>

            <!-- 渲染分配好的 Lane 日程卡片 -->
            <div
              v-for="laneEvt in getLaneEventsForDay(day.fullDate)"
              :key="laneEvt.id"
              class="absolute z-10 pointer-events-auto p-1 transition-all duration-200 hover:z-20"
              :style="laneEvt.style"
              @click.stop="handleCardClick(laneEvt.event)"
            >
              <div
                :class="[
                  'h-full w-full rounded p-1.5 text-xs flex flex-col justify-between overflow-hidden shadow-sm border cursor-pointer select-none transition-transform hover:scale-[1.02] hover:shadow-md',
                  getCardBackgroundClass(laneEvt.event)
                ]"
                :style="getCardInlineStyle(laneEvt.event)"
              >
                <!-- 头部：胶囊角标 + 班级名称 -->
                <div class="space-y-0.5">
                  <div class="flex items-center gap-1">
                    <span
                      class="text-xs px-1 py-0.2 rounded font-bold shrink-0 leading-none"
                      :style="getBadgeStyle(laneEvt.event)"
                    >
                      {{ getBadgeText(laneEvt.event) }}
                    </span>
                    <span class="font-bold truncate text-xs leading-tight" :title="laneEvt.event.className">
                      {{ laneEvt.event.className }}
                    </span>
                  </div>
                  <!-- 时段 -->
                  <div class="text-xs opacity-85 font-mono">
                    {{ laneEvt.event.startTime }} - {{ laneEvt.event.endTime }}
                  </div>
                </div>

                <!-- 底部：地点与讲师 -->
                <div class="text-xs space-y-0.5 pt-0.5 border-t border-black/5 opacity-90 truncate">
                  <div class="truncate flex items-center gap-1"><MapPin class="w-4 h-4 shrink-0" /> {{ laneEvt.event.classroomName }}</div>
                  <div class="truncate flex items-center gap-1"><User class="w-4 h-4 shrink-0" /> {{ laneEvt.event.teacherName }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>

    <!-- 视图模式 2: 教室课表 (按教室分列展示) -->
    <div v-else-if="currentSubTab === 'classroomCalendar'" class="bg-white rounded-lg p-5 shadow-sm border border-st-border space-y-4">
      <div class="flex items-center justify-between border-b pb-3">
        <h3 class="font-bold text-st-title text-sm">教室维度课表排期 ({{ classrooms.length }} 间物理教室)</h3>
        <span class="text-xs text-st-muted">当前查看周次：{{ currentWeekDisplay }}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="room in classrooms"
          :key="room.id"
          class="border border-st-border rounded-lg p-3 bg-st-header space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-st-title text-sm flex items-center gap-1.5"><MapPin class="w-4 h-4 text-st-primary" /> {{ room.name }}</span>
            <el-tag size="small">{{ room.typeName || '教室' }} ({{ room.capacity }}人)</el-tag>
          </div>
          <div class="space-y-1.5 max-h-56 overflow-y-auto">
            <div
              v-for="evt in getEventsByClassroom(room.id)"
              :key="evt.id"
              class="p-2 rounded bg-white border border-st-border text-xs space-y-1 hover:border-st-primary cursor-pointer"
              @click="handleCardClick(evt)"
            >
              <div class="flex justify-between font-semibold">
                <span class="truncate">{{ evt.className }}</span>
                <span :class="evt.hasConflict ? 'text-st-danger' : 'text-st-primary'">{{ evt.date }}</span>
              </div>
              <div class="text-xs text-st-muted flex justify-between">
                <span>{{ evt.startTime }}-{{ evt.endTime }}</span>
                <span class="flex items-center gap-1"><User class="w-4 h-4" /> {{ evt.teacherName }}</span>
              </div>
            </div>
            <div v-if="getEventsByClassroom(room.id).length === 0" class="text-center py-6 text-st-muted text-xs">
              本周暂无排课占用
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图模式 3: 讲师课表 (按讲师分列展示) -->
    <div v-else-if="currentSubTab === 'teacherCalendar'" class="bg-white rounded-lg p-5 shadow-sm border border-st-border space-y-4">
      <div class="flex items-center justify-between border-b pb-3">
        <h3 class="font-bold text-st-title text-sm">讲师维度工时与课表 ({{ teachers.length }} 位讲师)</h3>
        <span class="text-xs text-st-muted">当前查看周次：{{ currentWeekDisplay }}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="t in teachers"
          :key="t.id"
          class="border border-st-border rounded-lg p-3 bg-st-header space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-st-title text-sm flex items-center gap-1.5"><User class="w-4 h-4 text-st-primary" /> {{ t.name }}</span>
            <el-tag size="small" type="success">{{ t.roleName || '主讲讲师' }}</el-tag>
          </div>
          <div class="space-y-1.5 max-h-56 overflow-y-auto">
            <div
              v-for="evt in getEventsByTeacher(t.id)"
              :key="evt.id"
              class="p-2 rounded bg-white border border-st-border text-xs space-y-1 hover:border-st-primary cursor-pointer"
              @click="handleCardClick(evt)"
            >
              <div class="flex justify-between font-semibold">
                <span class="truncate">{{ evt.className }}</span>
                <span :class="evt.hasConflict ? 'text-st-danger' : 'text-st-success'">{{ evt.date }}</span>
              </div>
              <div class="text-xs text-st-muted flex justify-between">
                <span>{{ evt.startTime }}-{{ evt.endTime }}</span>
                <span class="inline-flex items-center gap-0.5"><MapPin class="w-4 h-4 text-st-warning" />{{ evt.classroomName }}</span>
              </div>
            </div>
            <div v-if="getEventsByTeacher(t.id).length === 0" class="text-center py-6 text-st-muted text-xs">
              本周暂无授课排班
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图模式 4: 课表汇总 / 冲突记录 (高密度表格) -->
    <div v-else class="bg-white rounded-lg p-5 shadow-sm border border-st-border space-y-4">
      <div class="flex items-center justify-between border-b pb-3">
        <h3 class="font-bold text-st-title text-sm">
          {{ currentSubTab === 'conflictRecord' ? '排课冲突集中监控记录' : '本周排课全量日程汇总' }}
        </h3>
        <el-tag :type="currentSubTab === 'conflictRecord' ? 'danger' : 'info'" size="small">
          共 {{ tableEvents.length }} 条记录
        </el-tag>
      </div>

      <el-table :data="tableEvents" v-loading="listLoading" stripe border size="small" style="width: 100%">
        <template #empty>
          <AppEmpty
            :type="listError ? 'error' : (filterTeacher || filterCourse || filterClassroom ? 'search' : 'data')"
              :description="listError || undefined"
              @retry="loadSchedules"
            action-text="重置筛选"
            @action="handleReset"
          />
        </template>
        <el-table-column prop="date" label="上课日期" width="110" />
        <el-table-column label="上课时段" width="130">
          <template #default="{ row }">
            <span class="font-mono">{{ row.startTime }} - {{ row.endTime }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="className" label="班级名称" min-width="160" />
        <el-table-column prop="courseName" label="所属课程" min-width="150" />
        <el-table-column prop="teacherName" label="授课老师" width="100" />
        <el-table-column prop="classroomName" label="上课教室" width="130" />
        <el-table-column label="状态/冲突" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.hasConflict" type="danger" size="small">
              {{ row.conflictType || '冲突日程' }}
            </el-tag>
            <el-tag v-else-if="row.status === 'completed'" type="success" size="small">
              已结课
            </el-tag>
            <el-tag v-else type="primary" size="small">待上课</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleCardClick(row as any)">详情</el-button>
            <el-button link type="primary" size="small" @click="openQuickSchedule(row as any)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row.id)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 快速排课弹窗 -->
    <QuickScheduleDialog
      ref="quickScheduleRef"
      :campus-id="tenantStore.currentCampusId"
      @success="handleRefresh"
    />

    <!-- 日程详情抽屉 -->
    <ScheduleDetailDrawer
      ref="detailDrawerRef"
      @refresh="handleRefresh"
      @edit="openQuickSchedule"
    />

    <!-- 冲突检测中心弹窗 -->
    <ConflictCenterDialog
      ref="conflictCenterRef"
      @resolve="openQuickSchedule"
    />
  </div>
</template>

<script setup lang="ts">
import { useLoadState } from '@/composables/useLoadState'
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MapPin, Zap, AlertTriangle, User, Lock, ChevronLeft as ArrowLeft, ChevronRight as ArrowRight } from 'lucide-vue-next'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { educationalApi } from '@/api'
import { EducationalCollisionEngine } from '@/utils/collisionEngine'
import { curriculumApi } from '@/api'
import type { ScheduleEvent, LaneEvent, Teacher, Classroom } from '@/types/educational'
import type { CourseItem } from '@/types/curriculum'
import HighDensityGrid from '@/components/HighDensityGrid.vue'
import { downloadCsv } from '@/utils/csvExport'
import { mondayOf, toDateKey } from '@/utils/dateKey'
import AppEmpty from '@/components/AppEmpty.vue'
import QuickScheduleDialog from './components/QuickScheduleDialog.vue'
import ScheduleDetailDrawer from './components/ScheduleDetailDrawer.vue'
import ConflictCenterDialog from './components/ConflictCenterDialog.vue'

// 列表加载状态：加载中显示遮罩，加载失败时空状态区显示原因和“重新加载”
const { loading: listLoading, loadError: listError, track: trackList, fail: failList } = useLoadState()

const tenantStore = useTenantStore()
const authStore = useAuthStore()
const currentCampus = computed(() => tenantStore.currentCampus)
const isDataScopeSelf = computed(() => authStore.isDataScopeSelf || authStore.user?.dataScope === 'self')
const currentTeacherId = computed(() => authStore.user?.teacherId || authStore.user?.id || '')
const currentTeacherName = computed(() => authStore.user?.realName || authStore.user?.account || '')

// 子 Tab 导航定义
const subTabs = [
  { key: 'attendClassCalendar', name: '上课日历' },
  { key: 'calendarCollect', name: '课表汇总' },
  { key: 'timeClassSchedule', name: '时间课表' },
  { key: 'classroomCalendar', name: '教室课表' },
  { key: 'teacherCalendar', name: '讲师课表' },
  { key: 'classCalendar', name: '班级课表' },
  { key: 'conflictRecord', name: '冲突记录' }
]
const currentSubTab = ref('timeClassSchedule')

// 筛选字段
const filterTeacher = ref('')
const filterAdvisor = ref('')
const filterCourse = ref('')
const filterClassroom = ref('')

// 周次状态管理：默认显示今天所在的一周 (周一为一周开始)
const currentWeekStart = ref(mondayOf(new Date()))

const currentWeekDays = computed(() => {
  const days = []
  const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const todayStr = toDateKey(new Date())

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart.value)
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const fullDate = `${y}-${m}-${day}`
    const label = `${m}/${day} ${weekNames[i]}`
    const isToday = fullDate === todayStr

    days.push({
      date: `${m}/${day}`,
      fullDate,
      label,
      week: weekNames[i],
      isToday
    })
  }
  return days
})

const currentWeekDisplay = computed(() => {
  const start = currentWeekDays.value[0]
  const end = currentWeekDays.value[6]
  const y = currentWeekStart.value.getFullYear()
  const m = currentWeekStart.value.getMonth() + 1
  return `${y}年${m}月 ( ${start.date} - ${end.date} )`
})

// 07:00 ~ 21:00 (15 个整点)
const hours = Array.from({ length: 15 }, (_, i) => i + 7)

// 当前时间指示线位置：距 07:00 的分钟数，每分钟 1px
const currentMinuteLineTop = computed(() => {
  const now = new Date()
  const currentHours = now.getHours()
  const currentMins = now.getMinutes()
  const totalMins = currentHours * 60 + currentMins
  // 07:00 是 420 分钟，每分钟 1px
  return totalMins - 420
})

// 基础资源
const teacherList = ref<Teacher[]>([])
const classroomList = ref<Classroom[]>([])
const courseList = ref<CourseItem[]>([])
let optionsRequest: Promise<void> | null = null

async function loadOptions() {
  try {
    const [teaRes, roomRes, crsRes] = await Promise.all([
      educationalApi.getTeachers(tenantStore.currentCampusId),
      educationalApi.getClassrooms(tenantStore.currentCampusId),
      curriculumApi.getCourses({
        campusId: tenantStore.currentCampusId && tenantStore.currentCampusId !== 'all' ? tenantStore.currentCampusId : undefined,
        pageSize: 200
      })
    ])
    teacherList.value = Array.isArray(teaRes?.data) ? teaRes.data : (teaRes?.data?.list || [])
    classroomList.value = Array.isArray(roomRes?.data) ? roomRes.data : (roomRes?.data?.list || [])
    courseList.value = Array.isArray(crsRes?.data) ? crsRes.data : (crsRes?.data?.list || crsRes?.data?.items || [])
  } catch (err: any) {
    ElMessage.error(err.message || '加载讲师与教室选项失败')
  }
}

const teachers = computed(() => teacherList.value.filter(t => Boolean(t && t.id && t.role === 'teacher')))
const advisors = computed(() => teacherList.value.filter(t => Boolean(t && t.id && t.role === 'advisor')))
const classrooms = computed(() => classroomList.value.filter(r => Boolean(r && r.id)))
const courses = computed(() => courseList.value.filter(c => Boolean(c && c.id)))

// 弹窗组件引用
const quickScheduleRef = ref<InstanceType<typeof QuickScheduleDialog>>()
const detailDrawerRef = ref<InstanceType<typeof ScheduleDetailDrawer>>()
const conflictCenterRef = ref<InstanceType<typeof ConflictCenterDialog>>()

// 响应式排课日程
const schedules = ref<ScheduleEvent[]>([])

function loadSchedules() {
  return trackList(loadSchedulesTask)
}

async function loadSchedulesTask() {
  const tId = isDataScopeSelf.value ? currentTeacherId.value : (filterTeacher.value || undefined)
  try {
    // 讲师 / 教室 / 课程选项只在进入页面时加载一次，并与排课并行请求 (切换校区时页面会整体重建)
    if (!optionsRequest) optionsRequest = loadOptions()
    const [res] = await Promise.all([
      educationalApi.getSchedules({
        campusId: tenantStore.currentCampusId,
        teacherId: tId,
        classroomId: filterClassroom.value || undefined
      }),
      optionsRequest
    ])
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
      schedules.value = list
      return
    }
  } catch (err: any) {
    failList(err, '获取排课日程失败')
    ElMessage.error(err.message || '获取排课日程失败')
  }

  schedules.value = []
}

watch(() => [authStore.user, isDataScopeSelf.value], () => {
  if (isDataScopeSelf.value) {
    filterTeacher.value = currentTeacherId.value
  } else {
    filterTeacher.value = ''
  }
  loadSchedules()
}, { immediate: true })

const campusConflictCount = computed(() => {
  return schedules.value.filter(s => s.hasConflict).length
})

// 按天获取分配 Lane 的日程
function getLaneEventsForDay(fullDate: string): LaneEvent[] {
  const dayEvents = schedules.value.filter(s => s.date === fullDate)
  return EducationalCollisionEngine.allocateLanes(dayEvents, 4)
}

function getEventsByClassroom(roomId: string): ScheduleEvent[] {
  return schedules.value.filter(s => s.classroomId === roomId)
}

function getEventsByTeacher(teacherId: string): ScheduleEvent[] {
  return schedules.value.filter(s => s.teacherId === teacherId)
}

const tableEvents = computed(() => {
  if (currentSubTab.value === 'conflictRecord') {
    return schedules.value.filter(s => s.hasConflict)
  }
  return schedules.value
})

// 卡片颜色样式
function getCardInlineStyle(event: ScheduleEvent) {
  const style = EducationalCollisionEngine.getSemanticChipStyle(event)
  return {
    backgroundColor: style.background,
    borderColor: style.borderColor,
    color: style.color
  }
}

function getCardBackgroundClass(event: ScheduleEvent) {
  if (event.hasConflict) {
    return 'ring-2 ring-rose-500 ring-offset-1'
  }
  return ''
}

function getBadgeStyle(event: ScheduleEvent) {
  const style = EducationalCollisionEngine.getSemanticChipStyle(event)
  return {
    backgroundColor: style.borderColor,
    color: 'var(--st-color-card, #ffffff)'
  }
}

function getBadgeText(event: ScheduleEvent) {
  if (event.hasConflict) return '冲'
  if (event.status === 'completed') return '已'
  if (event.classType === 'make_up') return '补'
  if (event.classType === 'trial') return '试'
  return '正'
}

// 交互操作
function prevWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d
}

function nextWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d
}

function resetToCurrentWeek() {
  currentWeekStart.value = mondayOf(new Date())
}

function handleSubTabChange(key: string) {
  currentSubTab.value = key
}

function handleSearch() {
  loadSchedules()
}

function handleReset() {
  filterTeacher.value = isDataScopeSelf.value ? currentTeacherId.value : ''
  filterAdvisor.value = ''
  filterCourse.value = ''
  filterClassroom.value = ''
  loadSchedules()
}
function handleRefresh() {
  loadSchedules()
}

function handleGridCellClick(fullDate: string, hour: number) {
  const startTime = `${String(hour).padStart(2, '0')}:00`
  const endTime = `${String(hour + 1).padStart(2, '0')}:30`
  openQuickSchedule({ date: fullDate, startTime, endTime })
}

function handleCardClick(event: ScheduleEvent) {
  detailDrawerRef.value?.open(event)
}

function openQuickSchedule(eventOrParams?: any) {
  if (eventOrParams && eventOrParams.id) {
    quickScheduleRef.value?.open({ event: eventOrParams })
  } else {
    quickScheduleRef.value?.open(eventOrParams)
  }
}

function openConflictCenter() {
  const conflicts = schedules.value.filter(s => s.hasConflict)
  conflictCenterRef.value?.open(conflicts)
}

/** 导出当前查看这一周的课表 (与页面上的讲师、教室筛选一致) */
function handleExport() {
  const weekDates = new Set(currentWeekDays.value.map((d) => d.fullDate))
  const rows = schedules.value
    .filter((s) => weekDates.has(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  if (rows.length === 0) {
    ElMessage.info('这一周没有排课')
    return
  }
  const first = currentWeekDays.value[0]?.fullDate || ''
  downloadCsv(`课表-${first}起一周`, [
    { title: '日期', value: (s: ScheduleEvent) => s.date },
    { title: '开始', value: (s) => s.startTime },
    { title: '结束', value: (s) => s.endTime },
    { title: '班级', value: (s) => s.className },
    { title: '课程', value: (s) => s.courseName },
    { title: '讲师', value: (s) => s.teacherName },
    { title: '教室', value: (s) => s.classroomName },
    { title: '校区', value: (s) => s.campusName },
  ], rows)
  ElMessage.success(`已导出 ${rows.length} 节课`)
}

async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定取消该排课课次吗？', '提示', { type: 'warning' })
    try {
      await educationalApi.deleteSchedule(id)
      ElMessage.success('排课已取消并同步落盘')
      await loadSchedules()
    } catch (err: any) {
      ElMessage.error(err.message || '取消排课失败')
    }
  } catch {
    // cancelled
  }
}
</script>
