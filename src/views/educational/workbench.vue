<template>
  <div class="p-5 space-y-4 bg-gray-50/70 min-h-screen">
    <!-- 顶部面包屑与校区上下文 -->
    <div class="bg-white rounded-lg px-5 py-3.5 shadow-xs border border-st-border flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs">
        <span class="text-st-muted">教务</span>
        <span class="text-gray-300">/</span>
        <span class="text-st-muted">教学服务</span>
        <span class="text-gray-300">/</span>
        <span class="text-st-primary font-bold">讲台</span>
      </div>

      <div class="flex items-center gap-3">
        <el-tag v-if="isTeacher" size="small" type="success" effect="light" class="font-medium">
          👨‍🏫 当前讲师：{{ currentTeacherName }}
        </el-tag>
        <div v-if="isTeacher" class="flex items-center gap-1.5 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200">
          <el-switch
            v-model="onlyMyLessons"
            size="small"
            active-text="仅看我的课程"
            @change="loadData"
          />
        </div>
        <el-tag size="small" type="primary" effect="plain" class="font-medium">
          🏫 {{ currentCampus.name }}
        </el-tag>
        <span class="text-xs text-st-muted">系统时间：2026-09-22</span>
      </div>
    </div>

    <!-- 7 维高密度运营指标看板 (1:1 复刻截图 1) -->
    <div class="bg-white rounded-lg px-6 py-4 shadow-xs border border-st-border">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center">
        <!-- 1. 课次数量 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-st-primary font-mono tracking-tight">
            {{ stats.lessonCount }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">课次数量</div>
        </div>

        <!-- 2. 未结课课次数量 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-st-primary font-mono tracking-tight">
            {{ stats.uncompletedCount }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">未结课课次数量</div>
        </div>

        <!-- 3. 上课人次 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-st-primary font-mono tracking-tight">
            {{ stats.totalStudentTimes }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">上课人次</div>
        </div>

        <!-- 4. 到课人次 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-emerald-600 font-mono tracking-tight">
            {{ stats.attendedTimes }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">到课人次</div>
        </div>

        <!-- 5. 未到人次 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-amber-600 font-mono tracking-tight">
            {{ stats.absentTimes }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">未到人次</div>
        </div>

        <!-- 6. 未签到人次 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
            {{ stats.unsignedTimes }}
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">未签到人次</div>
        </div>

        <!-- 7. 已签到人次 / 出勤率 -->
        <div class="px-3 py-1">
          <div class="text-2xl font-extrabold text-indigo-600 font-mono tracking-tight">
            {{ stats.attendedTimes }} <span class="text-xs font-normal text-st-muted">({{ stats.signedRate }}%)</span>
          </div>
          <div class="text-xs text-[#5e6d82] mt-1 font-medium">已签到人次</div>
        </div>
      </div>
    </div>

    <!-- 当日课程综合高密度筛选栏 -->
    <div class="bg-white rounded-lg p-4 shadow-xs border border-st-border space-y-3">
      <div class="flex items-center justify-between">
        <div class="font-bold text-sm text-[#1f303d] flex items-center gap-2">
          <span>当日课程</span>
          <span class="text-xs font-normal text-st-muted">（共 {{ cardList.length }} 节排课）</span>
        </div>

        <!-- 视图切换 -->
        <div class="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200">
          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs rounded font-medium transition-all flex items-center gap-1',
              viewMode === 'card' ? 'bg-white text-st-primary shadow-xs' : 'text-gray-500 hover:text-st-title'
            ]"
            @click="viewMode = 'card'"
          >
            <span>▦</span>
            <span>卡片视图</span>
          </button>
          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs rounded font-medium transition-all flex items-center gap-1',
              viewMode === 'table' ? 'bg-white text-st-primary shadow-xs' : 'text-gray-500 hover:text-st-title'
            ]"
            @click="viewMode = 'table'"
          >
            <span>≡</span>
            <span>表格视图</span>
          </button>
        </div>
      </div>

      <!-- 筛选输入矩阵 -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
        <!-- 课次状态 -->
        <el-select v-model="filters.status" placeholder="课次状态" clearable class="w-full" @change="loadData">
          <el-option label="全部课次状态" value="" />
          <el-option label="未上课" value="scheduled" />
          <el-option label="上课中" value="in_progress" />
          <el-option label="已结课" value="completed" />
        </el-select>

        <!-- 请选择角色 -->
        <el-select v-model="filters.role" placeholder="请选择角色" clearable class="w-full" @change="loadData">
          <el-option label="全部角色" value="" />
          <el-option label="授课老师" value="teacher" />
          <el-option label="班主任学管" value="head_teacher" />
          <el-option label="教务老师" value="assistant" />
        </el-select>

        <!-- 教室 -->
        <el-select v-model="filters.classroomId" placeholder="教室" clearable class="w-full" @change="loadData">
          <el-option label="全部教室" value="" />
          <el-option v-for="r in classroomOptions" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>

        <!-- 上课模式 -->
        <el-select v-model="filters.mode" placeholder="上课模式" clearable class="w-full" @change="loadData">
          <el-option label="全部模式" value="" />
          <el-option label="线下课" value="offline" />
          <el-option label="线上课" value="online" />
          <el-option label="双师课" value="dual_teacher" />
        </el-select>

        <!-- 课程名称/关键字 -->
        <el-input
          v-model="filters.search"
          placeholder="班级/课次/讲师"
          clearable
          class="w-full"
          @clear="loadData"
          @keyup.enter="loadData"
        />

        <!-- 日期范围选择器 -->
        <div class="flex items-center gap-1.5 w-full">
          <el-date-picker
            v-model="filters.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择排课日期"
            class="!w-full"
            @change="loadData"
          />
          <el-button type="primary" class="!px-3 shrink-0" @click="loadData">
            搜索
          </el-button>
        </div>
      </div>
    </div>

    <!-- 课程卡片列表流 (Card View, 1:1 复刻截图 1 & 截图 2) -->
    <div v-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="card in cardList"
        :key="card.id"
        class="bg-white rounded-xl shadow-xs border border-st-border overflow-hidden hover:shadow-md transition-shadow relative flex flex-col justify-between"
      >
        <!-- 卡片右上角斜角状态标 (未上课: 浅蓝, 已上课: 紫色, 上课中: 深蓝) -->
        <div
          :class="[
            'absolute top-0 right-0 w-16 h-16 pointer-events-none overflow-hidden z-10'
          ]"
        >
          <div
            :class="[
              'absolute transform rotate-45 text-center text-[10px] font-bold py-0.5 right-[-32px] top-[14px] w-[110px] text-white shadow-xs',
              card.status === 'completed'
                ? 'bg-[#7052ff]'
                : (card.status === 'in_progress' ? 'bg-blue-600 animate-pulse' : 'bg-[#409eff]')
            ]"
          >
            {{ card.status === 'completed' ? '已上课' : (card.status === 'in_progress' ? '上课中' : '未上课') }}
          </div>
        </div>

        <!-- 卡片上部信息区 -->
        <div class="p-4 space-y-2.5">
          <!-- 标签与时间 -->
          <div class="flex items-center gap-2 pr-12">
            <span class="bg-[#ff9500] text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-xs">
              线下课
            </span>
            <span class="text-xs text-st-secondary font-mono">
              {{ card.date }} {{ card.startTime }}:00-{{ card.endTime }}:00
            </span>
          </div>

          <!-- 课次大标题 -->
          <div class="pr-10">
            <h3 class="font-bold text-base text-st-title tracking-tight truncate hover:text-st-primary cursor-pointer">
              {{ card.lessonTitle || card.className }}
            </h3>
          </div>

          <!-- 班级胶囊标签 -->
          <div>
            <span class="inline-flex items-center text-[11px] text-[#409eff] bg-[#ecf5ff] px-2.5 py-0.5 rounded font-medium border border-[#d9ecff]">
              正常班 | {{ card.className }}
            </span>
          </div>

          <!-- 讲师与签到人数 (重要交互) -->
          <div class="flex items-center justify-between pt-1">
            <div class="text-xs text-st-title">
              <span class="text-st-muted">讲师：</span>
              <span class="font-medium">{{ card.teacherName }}</span>
            </div>

            <!-- 可点击的签到比例 -->
            <button
              type="button"
              class="text-xs font-bold text-[#409eff] hover:underline cursor-pointer flex items-center gap-0.5"
              @click="handleOpenSignIn(card)"
            >
              <span>签到({{ card.signedCount }}/{{ card.totalStudents }})</span>
            </button>
          </div>

          <!-- 校区与教务 -->
          <div class="text-xs text-st-muted space-y-0.5">
            <div>校区：{{ card.campusName || currentCampus.name }}</div>
            <div class="truncate">教务：{{ card.teachingAssistants?.join('、') || '冬海潮、钱欣蕾' }}</div>
          </div>

          <!-- 中间主状态控制药丸按钮 (上课 / 结课) -->
          <div class="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              :class="[
                'px-5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer',
                card.status === 'in_progress'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                  : 'bg-[#409eff] hover:bg-blue-600 text-white'
              ]"
              @click="handleStartLesson(card)"
            >
              {{ card.status === 'in_progress' ? '授课中...' : '上课' }}
            </button>

            <button
              type="button"
              :class="[
                'px-5 py-1.5 rounded-full text-xs font-bold text-white transition-all shadow-xs cursor-pointer',
                card.status === 'completed'
                  ? 'bg-gray-400 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-r from-[#ff7a45] to-[#fa541c] hover:opacity-90'
              ]"
              @click="handleFinishLesson(card)"
            >
              {{ card.status === 'completed' ? '已结课' : '结课' }}
            </button>
          </div>
        </div>

        <!-- 卡片底部 4 大操作常态图标栏 (下边框分割横排) -->
        <div class="border-t border-st-border bg-gray-50/50 px-3 py-2.5 grid grid-cols-4 divide-x divide-gray-200 text-center select-none">
          <!-- 1. 备课 -->
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 text-[#5e6d82] hover:text-st-primary transition-colors cursor-pointer group"
            @click="handleOpenLessonPlan(card)"
          >
            <span class="text-base group-hover:scale-110 transition-transform">📖</span>
            <span class="text-[11px] font-medium">备课</span>
          </button>

          <!-- 2. 签到 -->
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 text-[#5e6d82] hover:text-st-primary transition-colors cursor-pointer group"
            @click="handleOpenSignIn(card)"
          >
            <span class="text-base group-hover:scale-110 transition-transform">📅</span>
            <span class="text-[11px] font-medium">签到</span>
          </button>

          <!-- 3. 课评 (核心高亮) -->
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 text-[#5e6d82] hover:text-indigo-600 transition-colors cursor-pointer group"
            @click="handleOpenEvaluation(card)"
          >
            <div class="relative">
              <span class="text-base group-hover:scale-110 transition-transform text-amber-500">⭐</span>
              <span v-if="card.evaluationStatus === 'published'" class="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <span class="text-[11px] font-semibold text-indigo-700 group-hover:underline">课评</span>
          </button>

          <!-- 4. 上传回放 -->
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 text-[#5e6d82] hover:text-st-primary transition-colors cursor-pointer group"
            @click="handleOpenPlayback(card)"
          >
            <span class="text-base group-hover:scale-110 transition-transform">📺</span>
            <span class="text-[11px] font-medium">上传回放</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 表格视图 (Table View) -->
    <div v-else class="bg-white rounded-lg shadow-xs border border-st-border overflow-hidden">
      <el-table :data="cardList" stripe border size="default" style="width: 100%">
        <el-table-column label="上课时间" width="165">
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-secondary">{{ row.date }} {{ row.startTime }}-{{ row.endTime }}</span>
          </template>
        </el-table-column>

        <el-table-column label="课次名称" min-width="180">
          <template #default="{ row }">
            <div class="font-bold text-st-title">{{ row.lessonTitle || row.className }}</div>
            <div class="text-[11px] text-st-muted">班级：{{ row.className }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="teacherName" label="授课老师" width="110">
          <template #default="{ row }">
            <span class="font-medium text-st-title">👨‍🏫 {{ row.teacherName }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="classroomName" label="教室" width="140" />

        <el-table-column label="到课签到" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleOpenSignIn(row)">
              {{ row.signedCount }} / {{ row.totalStudents }} 人 ({{ Math.round((row.signedCount / row.totalStudents) * 100) }}%)
            </el-button>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : (row.status === 'in_progress' ? 'warning' : 'info')" size="small">
              {{ row.status === 'completed' ? '已结课' : (row.status === 'in_progress' ? '上课中' : '未上课') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="space-x-1 text-xs">
              <el-button link type="primary" size="small" @click="handleOpenEvaluation(row)">⭐ 课评</el-button>
              <el-button link type="primary" size="small" @click="handleOpenSignIn(row)">签到</el-button>
              <el-button link type="primary" size="small" @click="handleOpenLessonPlan(row)">备课</el-button>
              <el-button link :type="row.status === 'completed' ? 'info' : 'success'" size="small" @click="handleFinishLesson(row)">
                {{ row.status === 'completed' ? '已结课' : '结课' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 弹窗矩阵 -->
    <!-- 1. 深度课评弹窗 -->
    <LessonEvaluationDialog
      ref="evaluationDialogRef"
      @success="handleEvaluationSuccess"
    />

    <!-- 2. 教师备课抽屉 -->
    <LessonLessonPlanDrawer
      ref="lessonPlanDrawerRef"
    />

    <!-- 3. 上传回放弹窗 -->
    <LessonPlaybackDialog
      ref="playbackDialogRef"
    />

    <!-- 4. 快捷随堂签到消课抽屉/弹窗 -->
    <el-dialog
      v-model="signInDialogVisible"
      title="随堂签到与课消核销"
      width="640px"
      destroy-on-close
    >
      <div v-if="activeLessonForSignIn" class="space-y-4 text-xs">
        <div class="bg-blue-50/70 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
          <div>
            <div class="font-bold text-st-title">{{ activeLessonForSignIn.lessonTitle || activeLessonForSignIn.className }}</div>
            <div class="text-st-muted mt-0.5">授课老师: {{ activeLessonForSignIn.teacherName }} | 教室: {{ activeLessonForSignIn.classroomName }}</div>
          </div>
          <div class="text-right">
            <div class="text-emerald-600 font-bold text-sm">{{ tempAttendanceList.filter(s => s.status === 'present').length }} / {{ tempAttendanceList.length }} 人实到</div>
            <div class="text-[11px] text-st-muted">扣减标准: 1.0课时/人</div>
          </div>
        </div>

        <el-table :data="tempAttendanceList" size="small" border stripe>
          <el-table-column prop="studentName" label="学员姓名" width="120" />
          <el-table-column label="出勤状态" min-width="260">
            <template #default="{ row }">
              <el-radio-group v-model="row.status" size="small">
                <el-radio-button label="present">到课 ✓</el-radio-button>
                <el-radio-button label="late">迟到</el-radio-button>
                <el-radio-button label="leave">请假</el-radio-button>
                <el-radio-button label="absent">缺勤</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
          <el-table-column label="扣减课时" width="90" align="center">
            <template #default="{ row }">
              <span :class="row.status === 'leave' ? 'text-gray-400' : 'font-bold text-emerald-600'">
                {{ row.status === 'leave' ? '0' : '-1.0' }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <div class="flex justify-between items-center">
          <el-button size="small" @click="handleBatchAllPresent">全员设为到课</el-button>
          <div class="space-x-2">
            <el-button @click="signInDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSaveSignIn">确认打卡消课</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import type { WorkbenchLessonCard, LessonEvaluation } from '@/types/educational'
import {
  getWorkbenchLessons,
  getClassrooms,
  startLesson,
  finishLesson
} from '@/mocks/educational'
import LessonEvaluationDialog from './components/LessonEvaluationDialog.vue'
import LessonLessonPlanDrawer from './components/LessonLessonPlanDrawer.vue'
import LessonPlaybackDialog from './components/LessonPlaybackDialog.vue'

const tenantStore = useTenantStore()
const authStore = useAuthStore()

const currentCampus = computed(() => tenantStore.currentCampus)
const isTeacher = computed(() => authStore.isTeacher)
const currentTeacherName = computed(() => authStore.user?.realName || '张老师')
const onlyMyLessons = ref(authStore.isTeacher)

const viewMode = ref<'card' | 'table'>('card')
const cardList = ref<WorkbenchLessonCard[]>([])

const stats = reactive({
  lessonCount: 0,
  uncompletedCount: 0,
  totalStudentTimes: 0,
  attendedTimes: 0,
  absentTimes: 0,
  unsignedTimes: 0,
  signedRate: 0
})

const filters = reactive({
  status: '',
  role: '',
  classroomId: '',
  mode: '',
  search: '',
  date: ''
})

const classroomOptions = computed(() => getClassrooms(tenantStore.currentCampusId))

// 弹窗引用
const evaluationDialogRef = ref<InstanceType<typeof LessonEvaluationDialog>>()
const lessonPlanDrawerRef = ref<InstanceType<typeof LessonLessonPlanDrawer>>()
const playbackDialogRef = ref<InstanceType<typeof LessonPlaybackDialog>>()

// 快捷签到消课
const signInDialogVisible = ref(false)
const activeLessonForSignIn = ref<WorkbenchLessonCard | null>(null)
const tempAttendanceList = ref<{ studentId: string; studentName: string; status: 'present' | 'late' | 'leave' | 'absent' }[]>([])

function loadData() {
  const teacherIdParam = (onlyMyLessons.value && authStore.user?.teacherId) ? authStore.user.teacherId : undefined

  const res = getWorkbenchLessons({
    campusId: tenantStore.currentCampusId,
    date: filters.date || undefined,
    status: filters.status || undefined,
    mode: filters.mode || undefined,
    search: filters.search || undefined,
    classroomId: filters.classroomId || undefined,
    teacherId: teacherIdParam
  })

  cardList.value = res.cards
  Object.assign(stats, res.stats)
}

watch(() => authStore.user, (newVal) => {
  onlyMyLessons.value = !!(newVal?.roles.includes('teacher') || newVal?.teacherId)
  loadData()
})

// 上课
function handleStartLesson(card: WorkbenchLessonCard) {
  const res = startLesson(card.id)
  if (res.success) {
    card.status = 'in_progress'
    ElMessage.success(res.message)
    loadData()
  }
}

// 结课
async function handleFinishLesson(card: WorkbenchLessonCard) {
  try {
    await ElMessageBox.confirm(`确认将课次【${card.lessonTitle || card.className}】结课吗？结课后将自动归档授课记录并同步消课台账。`, '结课确认', {
      confirmButtonText: '确定结课',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res = finishLesson(card.id)
    if (res.success) {
      card.status = 'completed'
      ElMessage.success(res.message)
      loadData()
    }
  } catch {}
}

// 唤起各弹窗
function handleOpenEvaluation(card: WorkbenchLessonCard) {
  evaluationDialogRef.value?.open(card)
}

function handleOpenLessonPlan(card: WorkbenchLessonCard) {
  lessonPlanDrawerRef.value?.open(card)
}

function handleOpenPlayback(card: WorkbenchLessonCard) {
  playbackDialogRef.value?.open(card)
}

// 签到相关
function handleOpenSignIn(card: WorkbenchLessonCard) {
  activeLessonForSignIn.value = card
  // 生成模拟学员签到名单
  const count = card.totalStudents || 6
  const sampleNames = ['张星宇', '李子墨', '王梓轩', '陈思睿', '刘若涵', '赵浩宇', '周一诺', '孙嘉禾']
  tempAttendanceList.value = Array.from({ length: count }, (_, i) => {
    const isPresent = i < card.signedCount
    return {
      studentId: `stu-${i + 1}`,
      studentName: sampleNames[i % sampleNames.length],
      status: isPresent ? 'present' : (i === count - 1 ? 'leave' : 'present')
    }
  })
  signInDialogVisible.value = true
}

function handleBatchAllPresent() {
  tempAttendanceList.value.forEach(s => { s.status = 'present' })
  ElMessage.info('已将全部学员标记为到课')
}

function handleSaveSignIn() {
  if (!activeLessonForSignIn.value) return
  const attended = tempAttendanceList.value.filter(s => s.status === 'present' || s.status === 'late').length
  activeLessonForSignIn.value.signedCount = attended
  ElMessage.success(`随堂签到打卡完成！实到 ${attended} 人，已成功扣减学员对应课时！`)
  signInDialogVisible.value = false
  loadData()
}

function handleEvaluationSuccess(evalRecord: LessonEvaluation) {
  const card = cardList.value.find(c => c.id === evalRecord.lessonTimeId)
  if (card) {
    card.evaluationStatus = evalRecord.status
  }
  loadData()
}

onMounted(() => {
  loadData()
})
</script>
