<template>
  <el-dialog
    v-model="visible"
    title="学员 7 种异常状态流转状态机"
    width="720px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-if="student" class="space-y-4">
      <!-- 学员基本名片 -->
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <img
            :src="student.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'"
            class="w-10 h-10 rounded-full object-cover border border-slate-300"
          />
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-st-title">{{ student.name }}</span>
              <span class="text-xs text-st-muted font-mono">{{ student.studentNo }}</span>
              <el-tag size="small" :type="getStatusTagType(student.status)">
                {{ getStatusLabel(student.status) }}
              </el-tag>
            </div>
            <div class="text-xs text-st-secondary mt-0.5">
              归属校区: <span class="font-semibold text-st-primary">{{ student.campusName }}</span> |
              联系电话: <span class="font-mono">{{ student.phone }}</span> |
              在读课包: <span class="font-semibold text-emerald-600">{{ activePackages.length }}</span> 个
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[11px] text-st-muted">电子钱包可用余额</div>
          <div class="text-base font-bold font-mono text-st-danger-deep">
            ¥ {{ (student.wallet.principalBalance + student.wallet.bonusBalance).toFixed(2) }}
          </div>
        </div>
      </div>

      <!-- 异动分支选择器 -->
      <div>
        <label class="block text-xs font-bold text-st-title mb-2">选择异动分支类型</label>
        <el-radio-group v-model="currentMovement" size="small" class="w-full grid grid-cols-4 gap-2">
          <el-radio-button value="transfer_class" label="1. 转班">转班</el-radio-button>
          <el-radio-button value="change_course" label="2. 换课">换课</el-radio-button>
          <el-radio-button value="suspend" label="3. 停课" :disabled="student.status === 'suspended'">停课</el-radio-button>
          <el-radio-button value="resume" label="4. 复课" :disabled="student.status !== 'suspended'">复课</el-radio-button>
          <el-radio-button value="transfer_campus" label="5. 转校">转校</el-radio-button>
          <el-radio-button value="transfer_student" label="6. 转让">转让</el-radio-button>
          <el-radio-button value="refund" label="7. 退费">退费</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 动态异动配置表单 -->
      <div class="border border-st-border rounded-lg p-4 bg-white space-y-4">
        <!-- 分支 1: 转班 -->
        <div v-if="currentMovement === 'transfer_class'" class="space-y-3">
          <div class="text-xs font-bold text-st-title flex items-center justify-between border-b pb-2">
            <span>转班操作：等额课时移转，解除原班级关联并排入新班级</span>
            <el-tag size="small" type="info">容量预检</el-tag>
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="选择需要转班的有效课包" required>
              <el-select v-model="transferForm.packageId" placeholder="请选择学员有效课包" class="w-full">
                <el-option
                  v-for="pkg in activePackages"
                  :key="pkg.packageId"
                  :label="`${pkg.courseName} (当前剩余: ${pkg.remainingLessons} 课时, 当前班级: ${pkg.className || '未分班'})`"
                  :value="pkg.packageId"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="选择目标新班级" required>
              <el-select v-model="transferForm.toClassId" placeholder="请选择目标排课班级" class="w-full">
                <el-option
                  v-for="cls in filteredTargetClasses"
                  :key="cls.id"
                  :label="`${cls.name} [${cls.teacherName}] (当前: ${cls.currentCount}/${cls.capacity}人)`"
                  :value="cls.id"
                  :disabled="cls.currentCount >= cls.capacity"
                />
              </el-select>
            </el-form-item>
            <div v-if="selectedTargetClass" class="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-800">
              提示：目标班级「{{ selectedTargetClass.name }}」容量为 {{ selectedTargetClass.capacity }} 人，当前已入班 {{ selectedTargetClass.currentCount }} 人。
              {{ previewResult?.capacityImpact ? (previewResult.capacityImpact.willExceedCapacity ? '满班警告：已达额定人数上限，禁止转入！' : `班级尚有名额 (剩余 ${previewResult.capacityImpact.remainingSlots} 人)，允许转入。`) : (selectedTargetClass.currentCount < selectedTargetClass.capacity ? '班级尚有名额，允许转入。' : '满班警告：已无空余名额！') }}
            </div>
          </el-form>
        </div>

        <!-- 分支 2: 换课 -->
        <div v-if="currentMovement === 'change_course'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            换课操作：按原课包剩余学费净值折算新课程课时，多退少补
          </div>
          <el-form label-position="top" size="small">
            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="选择原课包" required>
                <el-select v-model="changeCourseForm.packageId" placeholder="选择原课包" class="w-full">
                  <el-option
                    v-for="pkg in activePackages"
                    :key="pkg.packageId"
                    :label="`${pkg.courseName} (剩余 ${pkg.remainingLessons} 课时)`"
                    :value="pkg.packageId"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="目标新课程" required>
                <el-select v-model="changeCourseForm.newCourseId" placeholder="选择目标课程" class="w-full">
                  <el-option
                    v-for="c in availableCourses"
                    :key="c.id"
                    :label="`${c.name} (单价 ¥${c.pricePerLesson}/课时)`"
                    :value="c.id"
                  />
                </el-select>
              </el-form-item>
            </div>
            <el-form-item label="拟购买新课课时数" required>
              <el-input-number v-model="changeCourseForm.newLessons" :min="1" :max="200" class="w-full" />
            </el-form-item>

            <!-- 差额核算看板 (服务端权威预演数据) -->
            <div v-if="previewResult?.financialImpact" class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1.5">
              <div class="flex justify-between text-amber-900">
                <span>原课包实付剩余净值:</span>
                <span class="font-bold font-mono">¥ {{ previewResult.financialImpact.sourceResidualValue?.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-amber-900">
                <span>新课程拟购总价:</span>
                <span class="font-bold font-mono">¥ {{ previewResult.financialImpact.targetRequiredAmount?.toFixed(2) }}</span>
              </div>
              <div class="border-t border-amber-300 pt-1 flex justify-between font-bold">
                <span>差额核算结果 (原净值 - 新总价):</span>
                <span :class="previewResult.financialImpact.netDiffAmount >= 0 ? 'text-emerald-700' : 'text-red-700'" class="font-mono text-sm">
                  {{ previewResult.financialImpact.netDiffAmount >= 0 ? `+ ¥${previewResult.financialImpact.netDiffAmount.toFixed(2)} (差额自动退回电子钱包本金)` : `- ¥${Math.abs(previewResult.financialImpact.netDiffAmount).toFixed(2)} (需自钱包扣减补交)` }}
                </span>
              </div>
            </div>
          </el-form>
        </div>

        <!-- 分支 3: 停课/休学 -->
        <div v-if="currentMovement === 'suspend'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            停课/休学操作：冻结名下课包，顺延到期日，暂停排课
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="停课天数（到期日顺延天数）" required>
              <el-input-number v-model="suspendForm.days" :min="7" :max="365" class="w-full" />
            </el-form-item>
            <el-form-item label="停课休学原因分类" required>
              <el-select v-model="suspendForm.reasonCategory" class="w-full" placeholder="请选择标准异动原因">
                <el-option
                  v-for="item in transReasonDict"
                  :key="item.dictKey"
                  :label="item.label"
                  :value="item.label"
                >
                  <div class="flex items-center justify-between w-full">
                    <span>{{ item.label }}</span>
                    <span v-if="item.remark" class="text-[11px] text-st-muted ml-2">({{ item.remark }})</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="详细说明与事由备注">
              <el-input v-model="suspendForm.reason" type="textarea" :rows="2" placeholder="补充详细事由，如家长申请、突发情况等" />
            </el-form-item>
            <div class="bg-yellow-50 border border-yellow-200 rounded p-2.5 text-xs text-yellow-800">
              办理后，学员在读状态将转为「停课休学」，{{ activePackages.length }} 个有效课包将冻结，到期日统一顺延 {{ suspendForm.days }} 天。
            </div>
          </el-form>
        </div>

        <!-- 分支 4: 复课 -->
        <div v-if="currentMovement === 'resume'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            复课操作：解冻全部已冻结课包，学员恢复「正常在读」状态
          </div>
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 space-y-1">
            <p>● 学员当前处于「停课休学」状态。</p>
            <p>● 确认复课后，名下已冻结课包将全部激活解冻，重新进入教务可排课名单。</p>
          </div>
        </div>

        <!-- 分支 5: 转校 -->
        <div v-if="currentMovement === 'transfer_campus'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            转校操作：跨校区学籍与学费净值划转，需更新校区归属
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="当前校区">
              <el-input :model-value="student.campusName" disabled />
            </el-form-item>
            <el-form-item label="选择目标校区" required>
              <el-select v-model="transferCampusForm.targetCampusId" placeholder="请选择目标转入校区" class="w-full">
                <el-option
                  v-for="c in authorizedCampuses"
                  :key="c.id"
                  :label="c.name"
                  :value="c.id"
                  :disabled="c.id === student.campusId"
                />
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <!-- 分支 6: 转让 -->
        <div v-if="currentMovement === 'transfer_student'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            转让操作：将名下全部有效课包与电子钱包资金移交至其他学员
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="选择受让目标学员" required>
              <el-select v-model="transferStudentForm.targetStudentId" filterable placeholder="输入姓名或学号搜索受让学员" class="w-full">
                <el-option
                  v-for="s in otherStudents"
                  :key="s.id"
                  :label="`${s.name} (${s.studentNo} - ${s.campusName})`"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
            <div class="bg-red-50 border border-red-200 rounded p-2.5 text-xs text-red-800">
              警告：转让为单向不可逆操作！当前学员 [{{ student.name }}] 的所有课时和钱包余额 ¥{{ (student.wallet.principalBalance + student.wallet.bonusBalance).toFixed(2) }} 将全部移交给受让学员，原学员课包将自动归档。
            </div>
          </el-form>
        </div>

        <!-- 分支 7: 退费 -->
        <div v-if="currentMovement === 'refund'" class="space-y-3">
          <div class="text-xs font-bold text-st-title border-b pb-2">
            退费操作：扣除已消耗课时、教材手续费，严密执行盛通退费核算公式
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="选择退费课包" required>
              <el-select v-model="refundForm.packageId" placeholder="请选择退费课包" class="w-full">
                <el-option
                  v-for="pkg in activePackages"
                  :key="pkg.packageId"
                  :label="`${pkg.courseName} (总 ${pkg.totalLessons} 课时, 剩余 ${pkg.remainingLessons} 课时, 赠 ${pkg.bonusLessons || 0} 课时)`"
                  :value="pkg.packageId"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="扣除教材与违约手续费 (¥)">
              <el-input-number v-model="refundForm.deductionFee" :min="0" :step="50" class="w-full" />
            </el-form-item>

            <!-- 退费核算结果 (服务端权威预演数据) -->
            <div v-if="previewResult?.financialImpact" class="bg-slate-100 border border-slate-300 rounded p-3 text-xs space-y-1.5">
              <div class="flex justify-between text-slate-700">
                <span>实付正课剩余净值:</span>
                <span class="font-bold font-mono">¥ {{ previewResult.financialImpact.sourceResidualValue?.toFixed(2) }}</span>
              </div>
              <div v-if="previewResult.financialImpact.clawbackAmount > 0" class="flex justify-between text-slate-700">
                <span>赠课超额扣减追缴 (透支赠课):</span>
                <span class="text-red-600 font-bold font-mono">- ¥{{ previewResult.financialImpact.clawbackAmount.toFixed(2) }}</span>
              </div>
              <div v-if="previewResult.financialImpact.deductionFee > 0" class="flex justify-between text-slate-700">
                <span>教材与违约手续费扣除:</span>
                <span class="text-red-600 font-bold font-mono">- ¥{{ previewResult.financialImpact.deductionFee.toFixed(2) }}</span>
              </div>
              <div class="border-t border-slate-300 pt-1 flex justify-between font-bold text-st-title">
                <span>盛通核算实退金额:</span>
                <span class="text-st-danger-deep font-mono text-base">¥ {{ previewResult.financialImpact.refundableCashAmount?.toFixed(2) }}</span>
              </div>
              <div class="text-[11px] text-slate-500 pt-0.5">
                * 经由盛通防腐算法核算，赠送课时不折现，实退金额将转入退费审批工单
              </div>
            </div>
          </el-form>
        </div>

        <!-- 服务端权威预演诊断与阻断提示 -->
        <div v-if="previewResult && previewResult.blockingIssues && previewResult.blockingIssues.length > 0" class="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs space-y-1">
          <div v-for="issue in previewResult.blockingIssues" :key="issue.code" class="flex items-center space-x-1.5 font-medium">
            <span>⚠️</span>
            <span>{{ issue.message }}</span>
          </div>
        </div>
        <div v-else-if="previewResult && previewResult.warnings && previewResult.warnings.length > 0" class="bg-amber-50 border border-amber-200 text-amber-700 p-2.5 rounded text-xs space-y-1">
          <div v-for="w in previewResult.warnings" :key="w.code" class="flex items-center space-x-1.5">
            <span>ℹ️</span>
            <span>{{ w.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确认提交异动申请
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Student, MovementType } from '@/types/student'
import { studentApi, educationalApi, curriculumApi } from '@/api'
import { useTenantStore } from '@/stores/tenantStore'
import { useDict } from '@/composables/useDict'

const { items: transReasonDict } = useDict('trans_reason')

const props = defineProps<{
  modelValue: boolean
  student: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success', student?: Student): void
}>()

const tenantStore = useTenantStore()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const submitting = ref(false)
const currentMovement = ref<MovementType>('transfer_class')

// 活跃有效课包
const activePackages = computed(() => {
  if (!props.student) return []
  return props.student.coursePackages.filter(p => p.status === 'active' || p.status === 'frozen')
})

const targetClasses = ref<any[]>([])
const coursesList = ref<any[]>([])
const candidateStudents = ref<any[]>([])

async function loadOptions() {
  try {
    const [clsRes, crsRes, stdRes] = await Promise.all([
      educationalApi.getClasses({ campusId: tenantStore.currentCampusId }),
      curriculumApi.getCourses({}),
      studentApi.getStudents({ campusId: tenantStore.currentCampusId })
    ])
    if (clsRes?.data) {
      targetClasses.value = Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data.items || clsRes.data.list || [])
    }
    if (crsRes?.data) {
      coursesList.value = Array.isArray(crsRes.data) ? crsRes.data : (crsRes.data.items || crsRes.data.list || [])
    }
    if (stdRes?.data) {
      candidateStudents.value = Array.isArray(stdRes.data) ? stdRes.data : (stdRes.data.items || stdRes.data.list || [])
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载异动选项数据失败')
  }
}

// 目标班级列表
const filteredTargetClasses = computed(() => {
  return targetClasses.value
})

// 课程列表
const availableCourses = computed(() => {
  return coursesList.value.filter(c => c.status === 'enabled')
})

// 可用校区
const authorizedCampuses = computed(() => {
  return tenantStore.campuses
})

// 受让候选学员
const otherStudents = computed(() => {
  if (!props.student) return []
  return candidateStudents.value.filter(s => s.id !== props.student?.id && s.status !== 'dropped_out')
})

// --- 表单状态 ---
const transferForm = reactive({
  packageId: '',
  toClassId: ''
})

const changeCourseForm = reactive({
  packageId: '',
  newCourseId: '',
  newLessons: 20
})

const suspendForm = reactive({
  days: 30,
  reasonCategory: '家庭搬迁/距离过远',
  reason: ''
})

watch(
  transReasonDict,
  (list) => {
    if (list && list.length > 0 && !suspendForm.reasonCategory) {
      suspendForm.reasonCategory = list[0].label
    }
  },
  { immediate: true }
)

const transferCampusForm = reactive({
  targetCampusId: ''
})

const transferStudentForm = reactive({
  targetStudentId: ''
})

const refundForm = reactive({
  packageId: '',
  deductionFee: 100
})

function initMovementForm() {
  const st = props.student
  if (st) {
    if (st.status === 'suspended') {
      currentMovement.value = 'resume'
    } else {
      currentMovement.value = 'transfer_class'
    }
    const firstPkg = st.coursePackages.find(p => p.status === 'active' || p.status === 'frozen')
    if (firstPkg) {
      transferForm.packageId = firstPkg.packageId
      changeCourseForm.packageId = firstPkg.packageId
      refundForm.packageId = firstPkg.packageId
    }
    if (availableCourses.value.length > 0) {
      changeCourseForm.newCourseId = availableCourses.value[0].id
    }
    const otherCampus = authorizedCampuses.value.find(c => c.id !== st.campusId)
    if (otherCampus) {
      transferCampusForm.targetCampusId = otherCampus.id
    }
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      loadOptions()
      initMovementForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.student,
  () => {
    if (props.modelValue) {
      initMovementForm()
    }
  }
)

const selectedTargetClass = computed(() => {
  return targetClasses.value.find(c => c.id === transferForm.toClassId)
})

const previewResult = ref<any>(null)
const previewLoading = ref(false)

function getCurrentMovementDto() {
  return {
    type: currentMovement.value,
    reasonCategory: suspendForm.reasonCategory || '学业或家庭调整',
    reasonDetail: suspendForm.reason || `学员异动业务流转: ${currentMovement.value}`,
    packageId:
      currentMovement.value === 'transfer_class'
        ? transferForm.packageId
        : currentMovement.value === 'change_course'
        ? changeCourseForm.packageId
        : refundForm.packageId,
    toClassId: transferForm.toClassId,
    newCourseId: changeCourseForm.newCourseId,
    newLessons: changeCourseForm.newLessons,
    suspensionDays: suspendForm.days,
    targetCampusId: transferCampusForm.targetCampusId,
    targetStudentId: transferStudentForm.targetStudentId,
    deductionFee: refundForm.deductionFee
  }
}

let previewTimer: any = null
async function triggerPreview() {
  if (!props.student || !props.modelValue) return

  if (currentMovement.value === 'transfer_class' && (!transferForm.packageId || !transferForm.toClassId)) {
    previewResult.value = null
    return
  }
  if (currentMovement.value === 'change_course' && (!changeCourseForm.packageId || !changeCourseForm.newCourseId)) {
    previewResult.value = null
    return
  }
  if (currentMovement.value === 'transfer_campus' && !transferCampusForm.targetCampusId) {
    previewResult.value = null
    return
  }
  if (currentMovement.value === 'transfer_student' && !transferStudentForm.targetStudentId) {
    previewResult.value = null
    return
  }
  if (currentMovement.value === 'refund' && !refundForm.packageId) {
    previewResult.value = null
    return
  }

  previewLoading.value = true
  try {
    const dto = getCurrentMovementDto()
    const res = await studentApi.previewMovement(props.student.id, dto)
    previewResult.value = res?.data || res
  } catch (err: any) {
    console.warn('Preview movement failed:', err)
  } finally {
    previewLoading.value = false
  }
}

function debouncedPreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    triggerPreview()
  }, 250)
}

watch(
  [
    currentMovement,
    () => transferForm.packageId,
    () => transferForm.toClassId,
    () => changeCourseForm.packageId,
    () => changeCourseForm.newCourseId,
    () => changeCourseForm.newLessons,
    () => suspendForm.days,
    () => transferCampusForm.targetCampusId,
    () => transferStudentForm.targetStudentId,
    () => refundForm.packageId,
    () => refundForm.deductionFee
  ],
  () => {
    debouncedPreview()
  }
)

function getStatusTagType(status: string) {
  switch (status) {
    case 'normal': return 'success'
    case 'suspended': return 'warning'
    case 'transferred': return 'info'
    case 'dropped_out': return 'danger'
    default: return 'info'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'normal': return '正常在读'
    case 'suspended': return '停课休学'
    case 'transferred': return '已转校'
    case 'dropped_out': return '已结课流失'
    default: return status
  }
}

async function handleSubmit() {
  if (!props.student) return

  // 前置表单校验
  if (currentMovement.value === 'transfer_class') {
    if (!transferForm.packageId) {
      ElMessage.warning('请选择需要转班的课包')
      return
    }
    if (!transferForm.toClassId) {
      ElMessage.warning('请选择目标班级')
      return
    }
  }

  if (currentMovement.value === 'change_course') {
    if (!changeCourseForm.packageId || !changeCourseForm.newCourseId) {
      ElMessage.warning('请完整选择原课包与新课程')
      return
    }
    if (changeCourseForm.newLessons <= 0) {
      ElMessage.warning('购买新课课时必须大于0')
      return
    }
  }

  if (currentMovement.value === 'transfer_campus') {
    if (!transferCampusForm.targetCampusId) {
      ElMessage.warning('请选择目标转入校区')
      return
    }
  }

  if (currentMovement.value === 'transfer_student') {
    if (!transferStudentForm.targetStudentId) {
      ElMessage.warning('请选择受让目标学员')
      return
    }
  }

  if (currentMovement.value === 'refund') {
    if (!refundForm.packageId) {
      ElMessage.warning('请选择退费课包')
      return
    }
  }

  // 服务端预演阻断检查
  if (previewResult.value && !previewResult.value.canExecute) {
    const blockingMsg = previewResult.value.blockingIssues?.[0]?.message || '异动前置条件未满足，无法执行'
    ElMessage.error(blockingMsg)
    return
  }

  try {
    await ElMessageBox.confirm('确认执行该项异动流转操作？', '业务确认', {
      type: 'warning',
      confirmButtonText: '确认执行',
      cancelButtonText: '取消'
    })
  } catch {
    // 弹窗取消
    return
  }

  submitting.value = true
  try {
    const flatDto = getCurrentMovementDto()
    await studentApi.executeMovement(props.student.id, flatDto)

    ElMessage.success('学员异动流转已成功提交并实时生效落库！')
    try {
      const refreshed = await studentApi.getStudentById(props.student.id)
      emit('success', refreshed?.data || props.student)
    } catch {
      emit('success', props.student)
    }
    visible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '异动操作失败')
  } finally {
    submitting.value = false
  }
}
</script>
