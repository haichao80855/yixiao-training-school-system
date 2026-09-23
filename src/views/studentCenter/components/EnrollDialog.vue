<template>
  <el-dialog
    v-model="visible"
    title="学员签约报读与开单向导"
    width="760px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div class="space-y-5">
      <!-- 步骤指示器 -->
      <el-steps :active="currentStep" finish-status="success" align-center class="mb-4">
        <el-step title="确认学员与校区" />
        <el-step title="配置课程与课时" />
        <el-step title="折扣减免核算" />
        <el-step title="支付结算入库" />
      </el-steps>

      <!-- Step 1: 确认学员与校区 -->
      <div v-if="currentStep === 0" class="border border-st-border rounded-lg p-5 bg-white space-y-4">
        <h4 class="text-sm font-bold text-st-title border-b pb-2">第 1 步：确认报读学员与合同签约校区</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="选择签约报读学员" required>
            <el-select
              v-model="formData.studentId"
              filterable
              placeholder="搜索学员姓名、学号或手机号"
              class="w-full"
            >
              <el-option
                v-for="s in candidateStudents"
                :key="s.id"
                :label="`${s.name} (${s.studentNo} - ${s.phone}) - [${s.campusName}]`"
                :value="s.id"
              />
            </el-select>
          </el-form-item>

          <!-- 选中学员卡片展示 -->
          <div v-if="selectedStudent" class="p-3 bg-blue-50 border border-blue-200 rounded flex items-center space-x-3">
            <img :src="selectedStudent.avatar" class="w-12 h-12 rounded-full object-cover border" />
            <div class="flex-1 text-xs">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-sm text-st-title">{{ selectedStudent.name }}</span>
                <span class="text-st-muted font-mono">{{ selectedStudent.studentNo }}</span>
                <el-tag size="small" type="success">在读</el-tag>
              </div>
              <div class="text-st-secondary mt-1">
                年级: {{ selectedStudent.grade }} | 学校: {{ selectedStudent.school || '未填' }} |
                电子钱包余额: <b class="text-st-danger-deep font-mono">¥ {{ (selectedStudent.wallet.principalBalance + selectedStudent.wallet.bonusBalance).toFixed(2) }}</b>
              </div>
            </div>
          </div>

          <el-form-item label="合同业务归属校区" required class="mt-3">
            <el-select v-model="formData.campusId" placeholder="选择签约校区" class="w-full">
              <el-option
                v-for="c in tenantStore.campuses"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 2: 选择课程与配置课时 -->
      <div v-if="currentStep === 1" class="border border-st-border rounded-lg p-5 bg-white space-y-4">
        <h4 class="text-sm font-bold text-st-title border-b pb-2">第 2 步：选择报读课程包与课时配置</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="选择报读课程" required>
            <el-select v-model="formData.courseId" placeholder="请选择教研课程库课程" class="w-full" @change="handleCourseChange">
              <el-option
                v-for="c in availableCourses"
                :key="c.id"
                :label="`[${c.subject}] ${c.name} (课标价 ¥${c.pricePerLesson}/课时, 推荐 ${c.totalLessons} 课时)`"
                :value="c.id"
              />
            </el-select>
          </el-form-item>

          <div class="grid grid-cols-2 gap-4">
            <el-form-item label="购买正课课时数" required>
              <el-input-number v-model="formData.lessonCount" :min="1" :max="200" :step="4" class="w-full" />
            </el-form-item>
            <el-form-item label="协议赠送课时数">
              <el-input-number v-model="formData.bonusLessons" :min="0" :max="50" :step="2" class="w-full" />
            </el-form-item>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <el-form-item label="签约课时单价 (¥/课时)" required>
              <el-input-number v-model="formData.pricePerLesson" :min="0" :step="10" class="w-full" />
            </el-form-item>
            <el-form-item label="总课时资产预估">
              <el-input :model-value="`${formData.lessonCount + formData.bonusLessons} 课时 (正课 ${formData.lessonCount} + 赠送 ${formData.bonusLessons})`" disabled />
            </el-form-item>
          </div>

          <div class="p-3 bg-gray-50 border rounded text-xs flex justify-between items-center text-st-title">
            <span>课程原价计算 (正课 {{ formData.lessonCount }} × ¥{{ formData.pricePerLesson }}):</span>
            <span class="font-bold text-base font-mono text-st-primary">¥ {{ originalTotalPrice.toFixed(2) }}</span>
          </div>
        </el-form>
      </div>

      <!-- Step 3: 折扣减免与核算 -->
      <div v-if="currentStep === 2" class="border border-st-border rounded-lg p-5 bg-white space-y-4">
        <h4 class="text-sm font-bold text-st-title border-b pb-2">第 3 步：优惠减免与实收应收账务核算</h4>
        <el-form label-position="top" size="small">
          <div class="grid grid-cols-2 gap-4">
            <el-form-item label="选择大促优惠券">
              <el-select v-model="formData.couponAmount" placeholder="请选择适用优惠券" class="w-full">
                <el-option label="不使用优惠券" :value="0" />
                <el-option label="开学季特惠券 (-¥500)" :value="500" />
                <el-option label="老带新专属立减券 (-¥1000)" :value="1000" />
                <el-option label="奥赛种子学员专项券 (-¥2000)" :value="2000" />
              </el-select>
            </el-form-item>
            <el-form-item label="学管直减优惠 (¥)">
              <el-input-number v-model="formData.discountAmount" :min="0" :max="originalTotalPrice" :step="100" class="w-full" />
            </el-form-item>
          </div>

          <!-- 账务明细面板 -->
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-xs">
            <div class="flex justify-between text-amber-900">
              <span>课程标准原价:</span>
              <span class="font-mono">¥ {{ originalTotalPrice.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-amber-900">
              <span>优惠券减免:</span>
              <span class="font-mono text-red-600">- ¥ {{ formData.couponAmount.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-amber-900">
              <span>直减折扣减免:</span>
              <span class="font-mono text-red-600">- ¥ {{ formData.discountAmount.toFixed(2) }}</span>
            </div>
            <div class="border-t border-amber-300 pt-2 flex justify-between items-center text-sm font-bold text-amber-950">
              <span>最终实收应付金额:</span>
              <span class="text-xl font-bold font-mono text-st-danger-deep">¥ {{ finalActualAmount.toFixed(2) }}</span>
            </div>
          </div>
        </el-form>
      </div>

      <!-- Step 4: 支付结算方式与提交 -->
      <div v-if="currentStep === 3" class="border border-st-border rounded-lg p-5 bg-white space-y-4">
        <h4 class="text-sm font-bold text-st-title border-b pb-2">第 4 步：确认结算支付方式并生成合同订单</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="选择收款支付渠道" required>
            <el-radio-group v-model="formData.paymentMethod" size="default" class="w-full grid grid-cols-3 gap-2">
              <el-radio-button value="wechat">微信支付</el-radio-button>
              <el-radio-button value="alipay">支付宝</el-radio-button>
              <el-radio-button value="pos">POS刷卡</el-radio-button>
              <el-radio-button value="bank_transfer">银行转账</el-radio-button>
              <el-radio-button value="wallet" :disabled="walletInsufficient">
                电子钱包余额扣除
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <div v-if="formData.paymentMethod === 'wallet'" class="p-3 bg-blue-50 border border-blue-200 rounded text-xs space-y-1 text-blue-900">
            <div>学员电子钱包本金: ¥{{ selectedStudent?.wallet.principalBalance.toFixed(2) }} | 赠送金: ¥{{ selectedStudent?.wallet.bonusBalance.toFixed(2) }}</div>
            <div class="font-semibold text-emerald-700">● 优先扣除赠送金，不足部分扣除本金。</div>
          </div>

          <div class="p-4 bg-gray-50 border rounded text-xs space-y-2">
            <div class="font-bold text-st-title">签约开单确认清单：</div>
            <div class="grid grid-cols-2 gap-2 text-st-secondary">
              <div>学员姓名: <b class="text-st-title">{{ selectedStudent?.name }}</b></div>
              <div>签约校区: <b class="text-st-title">{{ tenantStore.currentCampus.name }}</b></div>
              <div>课程名称: <b class="text-st-title">{{ selectedCourse?.name }}</b></div>
              <div>入库课时: <b class="text-emerald-600">{{ formData.lessonCount + formData.bonusLessons }} 课时</b></div>
              <div>支付方式: <b class="text-st-title">{{ getPaymentMethodLabel(formData.paymentMethod) }}</b></div>
              <div>实付金额: <b class="text-st-danger-deep font-mono text-sm">¥ {{ finalActualAmount.toFixed(2) }}</b></div>
            </div>
          </div>
        </el-form>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center">
        <el-button v-if="currentStep > 0" @click="currentStep--">上一步</el-button>
        <div v-else></div>

        <div class="space-x-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button v-if="currentStep < 3" type="primary" @click="handleNextStep">下一步</el-button>
          <el-button v-else type="success" :loading="submitting" @click="handleSubmit">
            确认签约收款并入库
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { Student } from '@/types/student'
import { MOCK_STUDENTS, enrollStudent, getCoursesByCampus, restoreCoursesFromStorage } from '@/mocks'
import { studentApi } from '@/api'
import { useTenantStore } from '@/stores/tenantStore'
import type { CourseItem } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  student?: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success'): void
}>()

const tenantStore = useTenantStore()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const currentStep = ref(0)
const submitting = ref(false)

const candidateStudents = computed(() => {
  return MOCK_STUDENTS
})

const availableCoursesList = ref<CourseItem[]>([])

function refreshCourses() {
  restoreCoursesFromStorage()
  const targetCampus = props.student?.campusId || tenantStore.currentCampusId
  const list = getCoursesByCampus(targetCampus).filter(c => c.status === 'enabled')
  availableCoursesList.value = list
}

const availableCourses = computed(() => {
  return availableCoursesList.value
})

const formData = reactive({
  studentId: '',
  campusId: tenantStore.currentCampusId,
  courseId: '',
  lessonCount: 48,
  bonusLessons: 4,
  pricePerLesson: 280,
  couponAmount: 0,
  discountAmount: 0,
  paymentMethod: 'wechat' as 'wechat' | 'alipay' | 'bank_transfer' | 'pos' | 'wallet'
})

const selectedStudent = computed(() => {
  return MOCK_STUDENTS.find(s => s.id === formData.studentId)
})

const selectedCourse = computed(() => {
  return availableCourses.value.find(c => c.id === formData.courseId)
})

const originalTotalPrice = computed(() => {
  return formData.lessonCount * formData.pricePerLesson
})

const finalActualAmount = computed(() => {
  const base = originalTotalPrice.value - formData.couponAmount - formData.discountAmount
  return Math.max(0, base)
})

const walletInsufficient = computed(() => {
  if (!selectedStudent.value) return true
  const total = selectedStudent.value.wallet.principalBalance + selectedStudent.value.wallet.bonusBalance
  return total < finalActualAmount.value
})

function resetForm() {
  refreshCourses()
  currentStep.value = 0
  formData.couponAmount = 0
  formData.discountAmount = 0
  formData.paymentMethod = 'wechat'

  if (props.student) {
    formData.studentId = props.student.id
    formData.campusId = props.student.campusId || tenantStore.currentCampusId
  } else if (MOCK_STUDENTS.length > 0) {
    formData.studentId = MOCK_STUDENTS[0].id
    formData.campusId = tenantStore.currentCampusId
  }
  if (availableCourses.value.length > 0) {
    formData.courseId = availableCourses.value[0].id
    formData.pricePerLesson = availableCourses.value[0].pricePerLesson
    formData.lessonCount = availableCourses.value[0].totalLessons || 48
    formData.bonusLessons = 4
  } else {
    formData.courseId = ''
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      resetForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.student,
  () => {
    if (props.modelValue) {
      resetForm()
    }
  }
)

function handleCourseChange(courseId: string) {
  const c = availableCourses.value.find(item => item.id === courseId)
  if (c) {
    formData.pricePerLesson = c.pricePerLesson
    formData.lessonCount = c.totalLessons || 48
  }
}

function handleNextStep() {
  if (currentStep.value === 0) {
    if (!formData.studentId) {
      ElMessage.warning('请选择报读学员')
      return
    }
  }
  if (currentStep.value === 1) {
    if (!formData.courseId) {
      ElMessage.warning('请选择报读课程')
      return
    }
    if (formData.lessonCount <= 0) {
      ElMessage.warning('课时数必须大于0')
      return
    }
  }
  currentStep.value++
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case 'wechat': return '微信支付'
    case 'alipay': return '支付宝'
    case 'pos': return 'POS刷卡'
    case 'bank_transfer': return '银行转账'
    case 'wallet': return '电子钱包扣款'
    default: return method
  }
}

async function handleSubmit() {
  submitting.value = true
  try {
    // 1. 尝试向真实后端发送开单签约请求
    let orderNoGenerated = ''
    try {
      const apiRes = await studentApi.enroll({
        studentId: formData.studentId,
        courseId: formData.courseId,
        totalLessons: formData.lessonCount,
        bonusLessons: formData.bonusLessons,
        pricePerLesson: formData.pricePerLesson,
        discountAmount: formData.discountAmount,
        couponAmount: formData.couponAmount,
        paymentMethod: formData.paymentMethod,
        channel: 'ground',
        remark: '前端签约开单向导提交',
      })
      if (apiRes.success && apiRes.data?.orderNo) {
        orderNoGenerated = apiRes.data.orderNo
      }
    } catch (apiErr) {
      console.warn('[EnrollDialog] 后端开单接口异常，自动降级至本地模式:', apiErr)
    }

    // 2. 本地响应式状态库同步生效
    const res = enrollStudent({
      studentId: formData.studentId,
      courseId: formData.courseId,
      lessonCount: formData.lessonCount,
      bonusLessons: formData.bonusLessons,
      pricePerLesson: formData.pricePerLesson,
      discountAmount: formData.discountAmount,
      couponAmount: formData.couponAmount,
      actualAmount: finalActualAmount.value,
      paymentMethod: formData.paymentMethod,
      campusId: formData.campusId,
      operator: '教务学管'
    })

    if (res.success) {
      ElMessage.success(
        orderNoGenerated
          ? `签约开单成功！订单已落盘：${orderNoGenerated}`
          : res.message
      )
      emit('success')
      visible.value = false
      currentStep.value = 0
    } else {
      ElMessage.error(res.message)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '签约失败')
  } finally {
    submitting.value = false
  }
}
</script>
