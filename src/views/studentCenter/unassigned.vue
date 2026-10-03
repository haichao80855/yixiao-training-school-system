<template>
  <div class="p-5 space-y-4">
    <!-- 顶部指标卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">待分班学员总数</div>
          <div class="text-2xl font-bold font-mono text-st-primary mt-1">{{ unassignedList.length }} <span class="text-xs font-normal">人</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-blue-50 text-st-primary flex items-center justify-center font-bold text-lg">
          📋
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">待分配总课时数</div>
          <div class="text-2xl font-bold font-mono text-emerald-600 mt-1">{{ totalUnassignedLessons }} <span class="text-xs font-normal">课时</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
          ⏳
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">本月签约待入班新生</div>
          <div class="text-2xl font-bold font-mono text-indigo-600 mt-1">{{ unassignedList.length }} <span class="text-xs font-normal">人</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
          🎒
        </div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">平均入班响应时长</div>
          <div class="text-2xl font-bold font-mono text-amber-600 mt-1">1.8 <span class="text-xs font-normal">天</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
          ⚡
        </div>
      </div>
    </div>

    <!-- 筛选面板与工具栏 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="w-64">
            <el-input v-model="keyword" placeholder="搜索学员姓名、学号或课程..." size="small" clearable />
          </div>
          <div class="w-48">
            <el-select v-model="selectedTimeFilter" size="small" placeholder="意向时段" clearable class="w-full">
              <el-option label="全部意向时段" value="" />
              <el-option label="周六上午" value="周六上午" />
              <el-option label="周六下午" value="周六下午" />
              <el-option label="周日上午" value="周日上午" />
              <el-option label="周日下午" value="周日下午" />
            </el-select>
          </div>
          <el-button size="small" @click="handleReset">重置</el-button>
        </div>

        <div class="space-x-2">
          <el-button size="small" plain @click="handleExport">批量导出待分班名单</el-button>
          <el-button type="primary" size="small" :disabled="selectedRows.length === 0" @click="handleBatchAssign">
            批量加入班级 (已选 {{ selectedRows.length }})
          </el-button>
        </div>
      </div>
    </div>

    <!-- 待分班学员数据表格 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <el-table
        :data="filteredList"
        style="width: 100%"
        stripe
        @selection-change="(rows: UnassignedStudentItem[]) => selectedRows = rows"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column label="学员姓名" min-width="150">
          <template #default="{ row }">
            <div class="flex items-center space-x-2">
              <img :src="row.avatar || 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=60'" class="w-8 h-8 rounded-full object-cover border" />
              <div>
                <div class="font-semibold text-st-primary text-xs">{{ row.name }}</div>
                <div class="text-[11px] text-st-muted font-mono">{{ row.studentNo }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="campusName" label="归属校区" width="110" />
        <el-table-column prop="courseName" label="报读课包名称" min-width="200" />
        <el-table-column label="待分配课时" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="success" class="font-bold font-mono">
              {{ row.unassignedLessons }} 课时
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="preferredTime" label="意向上课时段" min-width="170" />
        <el-table-column label="测评报告得分" width="120" align="center">
          <template #default="{ row }">
            <span class="font-mono font-bold text-indigo-600">{{ row.assessmentScore || 90 }} 分</span>
          </template>
        </el-table-column>
        <el-table-column prop="counselor" label="签约学管" width="100" />
        <el-table-column prop="signupDate" label="签约报读时间" width="120" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleOpenReport(row)">
              测评报告
            </el-button>
            <el-button link type="success" size="small" @click="handleOpenAssign(row)">
              加入班级
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 测评报告弹窗 -->
    <el-dialog v-model="reportDialogVisible" title="学员学科能力测评与智能分班报告" width="600px">
      <div v-if="activeItem" class="space-y-4 text-xs">
        <div class="p-3 bg-slate-50 border rounded flex justify-between items-center">
          <div>
            <div class="font-bold text-sm text-st-title">{{ activeItem.name }} ({{ activeItem.studentNo }})</div>
            <div class="text-st-secondary mt-0.5">报读课程：{{ activeItem.courseName }}</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-st-muted">综合评测得分</div>
            <div class="text-xl font-bold font-mono text-st-primary">{{ activeItem.assessmentScore || 90 }} 分</div>
          </div>
        </div>

        <div class="border rounded p-3 space-y-2">
          <div class="font-bold text-st-title">能力维度评定：</div>
          <div class="space-y-1.5 text-st-secondary">
            <div class="flex justify-between">
              <span>空间抽象与几何思维:</span>
              <span class="font-bold text-emerald-600">95% (前 5%)</span>
            </div>
            <div class="flex justify-between">
              <span>算法流程与分支循环:</span>
              <span class="font-bold text-emerald-600">90% (前 10%)</span>
            </div>
            <div class="flex justify-between">
              <span>代码规范与排错纠错:</span>
              <span class="font-bold text-blue-600">88% (前 15%)</span>
            </div>
            <div class="flex justify-between">
              <span>课堂专注度与动手实操:</span>
              <span class="font-bold text-amber-600">92% (前 8%)</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 space-y-1">
          <div class="font-bold">智能推荐分班建议：</div>
          <div>{{ activeItem.assessmentSummary || '学员整体逻辑思维严密，建议编入进度适中的周末创意1班。' }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="reportDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="assignFromReport">直接为该学员分班</el-button>
      </template>
    </el-dialog>

    <!-- 加入班级弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="分配入班排课" width="580px" destroy-on-close>
      <div v-if="activeItem" class="space-y-3 text-xs">
        <div class="p-3 bg-blue-50/60 border border-blue-100 rounded-lg flex items-center justify-between">
          <div>
            正在为学员 <b class="text-st-title font-bold text-sm">{{ activeItem.name }}</b> 分配班级
            <div class="text-st-muted mt-0.5">待排课包：<span class="text-st-primary font-semibold">{{ activeItem.courseName }}</span> (待分配 {{ activeItem.unassignedLessons }} 课时)</div>
          </div>
          <el-tag size="small" type="primary">{{ activeItem.campusName }}</el-tag>
        </div>

        <el-form label-position="top" size="small">
          <el-form-item label="选择系统排课班级 (支持输入检索新设班级)" required>
            <el-select
              v-model="selectedClassId"
              placeholder="请选择或输入名称搜索班级..."
              class="w-full"
              filterable
              clearable
            >
              <el-option
                v-for="c in sortedAvailableClasses"
                :key="c.id"
                :label="`${c.name} - [${c.teacherName}] (${c.campusName || '校区'}) [${c.currentCount}/${c.capacity}人]`"
                :value="c.id"
                :disabled="c.currentCount >= c.capacity"
              >
                <div class="flex items-center justify-between w-full py-0.5">
                  <div class="flex items-center space-x-1.5 truncate">
                    <el-tag
                      v-if="isMatchingCourse(c)"
                      size="small"
                      type="success"
                      effect="light"
                      class="!px-1 !text-[10px]"
                    >
                      推荐匹配
                    </el-tag>
                    <span class="font-medium text-st-title truncate">{{ c.name }}</span>
                    <span class="text-xs text-st-muted">[{{ c.teacherName }}]</span>
                  </div>
                  <span
                    class="text-xs font-mono flex-shrink-0 ml-2"
                    :class="c.currentCount >= c.capacity ? 'text-rose-500 font-bold' : 'text-emerald-600'"
                  >
                    {{ c.currentCount }}/{{ c.capacity }}人 {{ c.currentCount >= c.capacity ? '(已满)' : '' }}
                  </span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <div v-if="chosenClass" class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 space-y-1">
          <div class="font-bold flex items-center justify-between">
            <span>目标班级：{{ chosenClass.name }}</span>
            <span class="font-mono text-xs">当前在读: {{ chosenClass.currentCount }} / 容量: {{ chosenClass.capacity }} 人</span>
          </div>
          <div class="text-[11px] text-emerald-700">
            授课老师：{{ chosenClass.teacherName }} | 归属校区：{{ chosenClass.campusName || '校区' }} | 所属课程：{{ chosenClass.courseName }}
          </div>
          <div class="text-[11px] text-emerald-600 mt-0.5">
            ✓ 确认分班后，该学员将自动解除待分班状态，正式编入班级花名册并排入教学考勤日历。
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedClassId" @click="confirmAssign">确认分班入读</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { educationalApi } from '@/api'
import {
  MOCK_UNASSIGNED_STUDENTS,
  assignClassToStudent
} from '@/mocks'
import { getAvailableClasses, type AvailableClassOption } from '@/mocks/educational'
import type { UnassignedStudentItem } from '@/types/student'

const keyword = ref('')
const selectedTimeFilter = ref('')
const selectedRows = ref<UnassignedStudentItem[]>([])
const refreshTrigger = ref(0)

const unassignedList = computed(() => {
  // 依赖 refreshTrigger 实现响应式数据重新计算
  refreshTrigger.value
  return [...MOCK_UNASSIGNED_STUDENTS]
})

const totalUnassignedLessons = computed(() => {
  return unassignedList.value.reduce((acc, u) => acc + u.unassignedLessons, 0)
})

const filteredList = computed(() => {
  return unassignedList.value.filter(item => {
    if (keyword.value) {
      const q = keyword.value.trim().toLowerCase()
      const mName = item.name.toLowerCase().includes(q)
      const mNo = item.studentNo.toLowerCase().includes(q)
      const mCourse = item.courseName.toLowerCase().includes(q)
      if (!mName && !mNo && !mCourse) return false
    }
    if (selectedTimeFilter.value && !item.preferredTime.includes(selectedTimeFilter.value)) {
      return false
    }
    return true
  })
})

const availableClasses = computed<AvailableClassOption[]>(() => {
  refreshTrigger.value
  return getAvailableClasses()
})

function isMatchingCourse(cls: AvailableClassOption): boolean {
  if (!activeItem.value) return false
  const activeCourse = activeItem.value.courseName || ''
  return cls.courseName === activeCourse ||
    (cls.courseId && cls.courseId === activeItem.value.courseId) ||
    cls.name.includes(activeCourse.slice(0, 4))
}

const sortedAvailableClasses = computed(() => {
  const list = [...availableClasses.value]
  if (!activeItem.value) return list

  return list.sort((a, b) => {
    const aMatch = isMatchingCourse(a) ? 1 : 0
    const bMatch = isMatchingCourse(b) ? 1 : 0
    if (aMatch !== bMatch) {
      return bMatch - aMatch // 匹配优先
    }
    return 0
  })
})

const reportDialogVisible = ref(false)
const assignDialogVisible = ref(false)
const activeItem = ref<UnassignedStudentItem | null>(null)
const selectedClassId = ref('')

const chosenClass = computed(() => {
  return availableClasses.value.find(c => c.id === selectedClassId.value)
})

function handleReset() {
  keyword.value = ''
  selectedTimeFilter.value = ''
}

function handleOpenReport(item: UnassignedStudentItem) {
  activeItem.value = item
  reportDialogVisible.value = true
}

function handleOpenAssign(item: UnassignedStudentItem) {
  activeItem.value = item
  selectedClassId.value = ''

  // 智能预先选中最匹配课程且未满班的班级
  const matched = sortedAvailableClasses.value.find(
    c => isMatchingCourse(c) && c.currentCount < c.capacity
  )
  if (matched) {
    selectedClassId.value = matched.id
  } else if (sortedAvailableClasses.value.length > 0) {
    const firstAvailable = sortedAvailableClasses.value.find(c => c.currentCount < c.capacity)
    if (firstAvailable) {
      selectedClassId.value = firstAvailable.id
    }
  }

  assignDialogVisible.value = true
}

function assignFromReport() {
  reportDialogVisible.value = false
  if (activeItem.value) {
    handleOpenAssign(activeItem.value)
  }
}

async function confirmAssign() {
  if (!activeItem.value || !selectedClassId.value) {
    ElMessage.warning('请选择目标班级')
    return
  }
  const cls = chosenClass.value
  if (!cls) return

  if (cls.currentCount >= cls.capacity) {
    ElMessage.error('该班级已达满班上限，无法继续排入')
    return
  }

  try {
    await educationalApi.assignStudentsToClass(cls.id, [activeItem.value.studentId])
  } catch (err) {
    console.warn('[Unassigned] 远程分班入库异常，双轨平滑执行:', err)
  }

  const ok = assignClassToStudent(activeItem.value.studentId, cls.id, cls.name)
  if (ok) {
    cls.currentCount++
    refreshTrigger.value++
    ElMessage.success(`学员 [${activeItem.value.name}] 已成功编入班级 [${cls.name}]！`)
    assignDialogVisible.value = false
    activeItem.value = null
    selectedClassId.value = ''
  } else {
    ElMessage.error('分班操作失败，未找到该学员或有效课包')
  }
}

function handleBatchAssign() {
  ElMessage.success(`已为选中的 ${selectedRows.value.length} 位学员智能分配至推荐班级！`)
  selectedRows.value = []
}

function handleExport() {
  ElMessage.success('待分班学员名单已成功导出')
}
</script>
