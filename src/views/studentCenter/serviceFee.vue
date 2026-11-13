<template>
  <div class="p-5 space-y-4">
    <!-- 顶部统计看板与易快报对接状态 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">待财务核销总金额</div>
          <div class="text-2xl font-bold font-mono text-st-warning mt-1">¥ {{ pendingTotalFee.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-warning-light text-st-warning flex items-center justify-center font-bold text-lg">
          <Clock class="w-5 h-5" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">已核销入账总金额</div>
          <div class="text-2xl font-bold font-mono text-st-success mt-1">¥ {{ verifiedTotalFee.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-success-light text-st-success flex items-center justify-center font-bold text-lg">
          <CheckCircle2 class="w-5 h-5" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">本月代报考人次</div>
          <div class="text-2xl font-bold font-mono text-st-primary mt-1">{{ records.length }} <span class="text-xs font-normal">人次</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-primary-light text-st-primary flex items-center justify-center font-bold text-lg">
          <Trophy class="w-5 h-5" />
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">易快报费控系统连接</div>
          <div class="flex items-center space-x-2 mt-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-st-success animate-ping"></span>
            <span class="text-xs font-bold text-st-success">实时联通 (API 正常)</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-st-primary-light text-st-primary flex items-center justify-center font-bold text-lg">
          <Link2 class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- 筛选面板与多 Tab 切换 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <!-- 多 Tab -->
        <el-radio-group v-model="activeTab">
          <el-radio-button value="all">全部报考记录 ({{ records.length }})</el-radio-button>
          <el-radio-button value="pending">待财务核销 ({{ pendingList.length }})</el-radio-button>
          <el-radio-button value="verified">已核销入账 ({{ verifiedList.length }})</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 检索项 -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-64">
          <el-input v-model="keyword" placeholder="搜索单号、学员姓名或赛事名称..." clearable />
        </div>
        <div class="w-48">
          <el-select v-model="selectedCategory" placeholder="类型过滤" clearable class="w-full">
            <el-option label="全部类型" value="" />
            <el-option label="等级考试" value="certification" />
            <el-option label="白名单赛事" value="competition" />
          </el-select>
        </div>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 汇总小计统计条 (SummaryStrip 集成) -->
    <SummaryStrip
      :total-count="filteredRecords.length"
      :display-amount="filteredFeeSum"
      unit="人次"
      currency="元"
      :summary-text="`当前筛选条件下：共计 ${filteredRecords.length} 人次代报考，服务费总额 ¥ ${filteredFeeSum} 元 (待财务核销 ¥ ${pendingTotalFee.toFixed(2)} 元，已核销入账 ¥ ${verifiedTotalFee.toFixed(2)} 元)`"
    >
      <template #right>
        <el-button plain :disabled="filteredRecords.length === 0" @click="handleExportReport">导出对账单</el-button>
        <el-button
          type="warning"
          :disabled="selectedRows.length === 0"
          @click="handleBatchVerify"
        >
          批量核销 (已选 {{ selectedRows.length }})
        </el-button>
        <el-button type="primary" @click="showAddDialog = true">
          + 新增报考记录
        </el-button>
      </template>
    </SummaryStrip>

    <!-- 服务费数据表格 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="overflow-x-auto w-full min-w-0">
        <el-table
          :data="filteredRecords" v-loading="listLoading"
          style="width: 100%"
          stripe
          @selection-change="(rows: ServiceFeeRecordItem[]) => selectedRows = rows"
        >
          <template #empty>
            <AppEmpty
              :type="listError ? 'error' : (keyword || selectedCategory ? 'search' : 'data')"
              :description="listError || undefined"
              @retry="loadRecords"
              action-text="重置筛选"
              @action="handleReset"
            />
          </template>

          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="certNo" label="报考单号" width="150">
            <template #default="{ row }">
              <span class="font-mono text-xs font-semibold text-st-primary">{{ row.certNo }}</span>
            </template>
          </el-table-column>
          <el-table-column label="学员姓名 / 学号" min-width="140">
            <template #default="{ row }">
              <div class="text-xs">
                <span class="font-bold text-st-title">{{ row.studentName }}</span>
                <span class="text-st-muted font-mono ml-1.5">{{ row.studentNo }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="campusName" label="归属校区" width="100" />
          <el-table-column prop="examType" label="考级与赛事项目名称" min-width="220" />
          <el-table-column label="业务类别" width="110" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.category === 'competition' ? 'warning' : 'primary'">
                {{ row.category === 'competition' ? '白名单赛事' : '等级考试' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="代报服务费" width="120" align="right">
            <template #default="{ row }">
              <span class="text-st-danger-deep font-bold font-mono text-sm">¥ {{ row.fee.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="invoiceTitle" label="发票抬头" min-width="150" />
          <el-table-column label="核销编号" width="160">
            <template #default="{ row }">
              <span v-if="row.yikuaibaoVoucherNo" class="font-mono text-xs text-st-primary bg-st-primary-light px-1.5 py-0.5 rounded">
                {{ row.yikuaibaoVoucherNo }}
              </span>
              <span v-else class="text-st-muted text-xs">待报销生成</span>
            </template>
          </el-table-column>
          <el-table-column label="核销状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'verified' ? 'success' : 'warning'" size="small">
                {{ row.status === 'verified' ? '已核销入账' : '待财务核销' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="录入时间" width="140" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleViewVoucher(row as any)">凭证查看</el-button>
              <el-button
                v-if="row.status === 'pending'"
                link
                type="success"
                size="small"
                @click="handleSingleVerify(row as any)"
              >
                核销登记
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 凭证查看弹窗 -->
    <el-dialog v-model="voucherDialogVisible" title="考级报考与易快报核销对账凭证" :width="DIALOG_SIZE.md">
      <div v-if="activeRecord" class="space-y-4 text-xs">
        <div class="border rounded p-4 bg-st-header space-y-2">
          <div class="flex justify-between border-b pb-2">
            <span class="font-bold text-sm text-st-title">代报项目：{{ activeRecord.examType }}</span>
            <span class="text-st-danger-deep font-bold font-mono text-sm">¥ {{ activeRecord.fee.toFixed(2) }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-st-secondary">
            <div>单号: <b class="font-mono">{{ activeRecord.certNo }}</b></div>
            <div>学员: <b>{{ activeRecord.studentName }} ({{ activeRecord.studentNo }})</b></div>
            <div>归属校区: <b>{{ activeRecord.campusName }}</b></div>
            <div>发票抬头: <b>{{ activeRecord.invoiceTitle }}</b></div>
            <div>易快报单号: <b class="font-mono text-st-primary">{{ activeRecord.yikuaibaoVoucherNo || '暂无' }}</b></div>
            <div>核销时间: <b class="font-mono">{{ activeRecord.verifyTime || '待核销' }}</b></div>
          </div>
        </div>

        <div class="border rounded p-3 text-center bg-st-header space-y-2">
          <div class="text-st-muted text-xs">电子凭证与发票扫描附件：</div>
          <img
            :src="activeRecord.voucherImage || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400'"
            class="mx-auto rounded border shadow-sm max-h-48 object-cover"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="voucherDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增报考记录弹窗 -->
    <el-dialog v-model="showAddDialog" title="新增考级 / 赛事代报名记录" :width="DIALOG_SIZE.md">
      <el-form label-position="top">
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="报考学员" required>
            <el-select
              v-model="newRecordForm.studentId"
              filterable
              remote
              :remote-method="studentSearch.search"
              :loading="studentSearch.loading.value"
              placeholder="输入姓名、学号或手机号搜索"
              class="w-full"
              @change="handleStudentSelect"
            >
              <el-option
                v-for="s in studentsList"
                :key="s.id"
                :label="`${s.name} (${s.studentNo})`"
                :value="s.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="业务类型" required>
            <el-select v-model="newRecordForm.category" class="w-full">
              <el-option label="等级考试认证" value="certification" />
              <el-option label="全国白名单科技赛事" value="competition" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="考级或赛事项目名称" required>
          <el-input v-model="newRecordForm.examType" placeholder="如：全国青少年软件编程Scratch三级考级" />
        </el-form-item>

        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="代报服务费金额 (¥)" required>
            <el-input-number v-model="newRecordForm.fee" :min="100" :step="50" class="w-full" />
          </el-form-item>
          <el-form-item label="发票抬头">
            <el-input v-model="newRecordForm.invoiceTitle" placeholder="默认为学员或个人" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="feeSubmitting" @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="feeSubmitting" @click="handleConfirmAdd">保存并提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 单条核销登记弹窗 -->
    <el-dialog v-model="singleVerifyDialog" title="易快报财务核销入账登记" :width="DIALOG_SIZE.sm">
      <div v-if="verifyTarget" class="space-y-3 text-xs">
        <div class="p-3 bg-st-primary-light border border-st-primary-border rounded text-st-primary-active">
          为学员 <b class="font-bold">{{ verifyTarget.studentName }}</b> 的报考项目 [{{ verifyTarget.examType }}] 登记核销，金额 ¥{{ verifyTarget.fee }}。
        </div>
        <el-form label-position="top">
          <el-form-item label="易快报费控报销凭证单号" required>
            <el-input v-model="verifyVoucherNo" placeholder="如：YKB-20260921-0899" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button :disabled="feeSubmitting" @click="singleVerifyDialog = false">取消</el-button>
        <el-button type="primary" :loading="feeSubmitting" @click="confirmSingleVerify">确认核销入账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useSubmit } from '@/composables/useSubmit'
import { useStudentSearch } from '@/composables/useStudentSearch'
import { useLoadState } from '@/composables/useLoadState'
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CheckCircle2, Trophy, Link2, Clock } from 'lucide-vue-next'
import { studentApi } from '@/api'
import { useTenantStore } from '@/stores/tenantStore'
import SummaryStrip from '@/components/SummaryStrip.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { DIALOG_SIZE } from '@/constants/ui'
import type { Student } from '@/types/student'
import type { ServiceFeeRecordItem } from '@/api/modules/student'
import { downloadCsv, todayStamp } from '@/utils/csvExport'

// 列表加载状态：加载中显示遮罩，加载失败时空状态区显示原因和“重新加载”
const { loading: listLoading, loadError: listError, track: trackList, fail: failList } = useLoadState()

const activeTab = ref('all')
const keyword = ref('')
const selectedCategory = ref('')
const selectedRows = ref<ServiceFeeRecordItem[]>([])

const filteredFeeSum = computed(() => {
  return filteredRecords.value.reduce((sum, item) => sum + (item.fee || 0), 0).toFixed(2)
})

const tenantStore = useTenantStore()
// 报考学员：后端按关键字搜索 (以前不传分页只取到 10 个学员)
const studentSearch = useStudentSearch(() => tenantStore.currentCampusId)
const studentsList = studentSearch.options
const feeRecords = ref<ServiceFeeRecordItem[]>([])

function loadStudents() {
  return studentSearch.search()
}

function loadRecords() {
  return trackList(loadRecordsTask)
}

async function loadRecordsTask() {
  try {
    const res = await studentApi.getServiceFees()
    if (res && res.data && Array.isArray(res.data)) {
      feeRecords.value = res.data
      return
    }
    feeRecords.value = []
  } catch (err: unknown) {
    failList(err, '加载代报考账本失败')
    ElMessage.error(err instanceof Error ? err.message : '加载考务代报考账本失败')
    feeRecords.value = []
  }
}

onMounted(() => {
  loadStudents()
  loadRecords()
})

const records = computed(() => {
  return feeRecords.value
})

const pendingList = computed(() => {
  return records.value.filter(r => r.status === 'pending')
})

const verifiedList = computed(() => {
  return records.value.filter(r => r.status === 'verified')
})

const pendingTotalFee = computed(() => {
  return pendingList.value.reduce((acc, r) => acc + r.fee, 0)
})

const verifiedTotalFee = computed(() => {
  return verifiedList.value.reduce((acc, r) => acc + r.fee, 0)
})

const filteredRecords = computed(() => {
  return records.value.filter(item => {
    if (activeTab.value === 'pending' && item.status !== 'pending') return false
    if (activeTab.value === 'verified' && item.status !== 'verified') return false

    if (keyword.value) {
      const q = keyword.value.trim().toLowerCase()
      const mNo = item.certNo.toLowerCase().includes(q)
      const mName = item.studentName.toLowerCase().includes(q)
      const mExam = item.examType.toLowerCase().includes(q)
      if (!mNo && !mName && !mExam) return false
    }

    if (selectedCategory.value && item.category !== selectedCategory.value) {
      return false
    }

    return true
  })
})

function handleReset() {
  keyword.value = ''
  selectedCategory.value = ''
}

// 凭证查看
const voucherDialogVisible = ref(false)
const activeRecord = ref<ServiceFeeRecordItem | null>(null)

function handleViewVoucher(row: ServiceFeeRecordItem) {
  activeRecord.value = row
  voucherDialogVisible.value = true
}

// 新增记录
const showAddDialog = ref(false)
const newRecordForm = reactive({
  studentId: 'std-001',
  studentName: '张小萌',
  studentNo: 'S948918',
  campusId: tenantStore.currentCampusId,
  category: 'certification' as 'certification' | 'competition',
  examType: '',
  fee: 450,
  invoiceTitle: ''
})

function handleStudentSelect(sId: string) {
  const s = studentsList.value.find(item => item.id === sId)
  if (s) {
    newRecordForm.studentName = s.name
    newRecordForm.studentNo = s.studentNo
    newRecordForm.campusId = s.campusId
  }
}

// 新增、核销提交中锁定按钮，连点只发一次
const { submitting: feeSubmitting, submit: submitFee } = useSubmit()

async function handleConfirmAdd() {
  if (!newRecordForm.examType.trim()) {
    ElMessage.warning('请输入考级或赛事项目名称')
    return
  }
  const payload = {
    studentId: newRecordForm.studentId,
    studentName: newRecordForm.studentName,
    studentNo: newRecordForm.studentNo,
    campusId: newRecordForm.campusId,
    campusName: tenantStore.campuses.find(c => c.id === newRecordForm.campusId)?.name || tenantStore.currentCampus.name,
    examType: newRecordForm.examType,
    category: newRecordForm.category,
    fee: newRecordForm.fee,
    invoiceTitle: newRecordForm.invoiceTitle || `${newRecordForm.studentName} (个人)`,
    operator: '学管财务'
  }
  await submitFee(async () => {
    try {
      await studentApi.createServiceFee(payload)
      ElMessage.success('代报考记录已添加，已提交审核')
      showAddDialog.value = false
      newRecordForm.examType = ''
      void loadRecords()
    } catch (err: unknown) {
      ElMessage.error(err instanceof Error ? err.message : '添加代报考记录失败')
    }
  })
}

// 单条核销
const singleVerifyDialog = ref(false)
const verifyTarget = ref<ServiceFeeRecordItem | null>(null)
const verifyVoucherNo = ref('')

function handleSingleVerify(row: ServiceFeeRecordItem) {
  verifyTarget.value = row
  verifyVoucherNo.value = `YKB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
  singleVerifyDialog.value = true
}

async function confirmSingleVerify() {
  const target = verifyTarget.value
  if (!target) return
  await submitFee(async () => {
    try {
      await studentApi.verifyServiceFee(target.id, verifyVoucherNo.value)
      ElMessage.success(`核销入账成功，凭证号 ${verifyVoucherNo.value}`)
      singleVerifyDialog.value = false
      void loadRecords()
    } catch (err: unknown) {
      ElMessage.error(err instanceof Error ? err.message : '核销入账失败')
    }
  })
}

// 批量核销
async function handleBatchVerify() {
  const pendingIds = selectedRows.value.filter(r => r.status === 'pending').map(r => r.id)
  if (pendingIds.length === 0) {
    ElMessage.info('所选项中没有待核销记录')
    return
  }
  try {
    const vNo = `YKB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
    await studentApi.batchVerifyServiceFees({ ids: pendingIds, yikuaibaoVoucherNo: vNo })
    await loadRecords()
    ElMessage.success(`已核销 ${pendingIds.length} 笔代报考费用，核销编号 ${vNo}`)
    selectedRows.value = []
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '批量核销失败')
  }
}

function handleExportReport() {
  downloadCsv(`代报考对账单-${todayStamp()}`, [
    { title: '报考单号', value: (r: ServiceFeeRecordItem) => r.certNo },
    { title: '学员姓名', value: (r) => r.studentName },
    { title: '学号', value: (r) => r.studentNo },
    { title: '归属校区', value: (r) => r.campusName },
    { title: '项目名称', value: (r) => r.examType },
    { title: '业务类别', value: (r) => (r.category === 'competition' ? '白名单赛事' : '等级考试') },
    { title: '代报服务费 (元)', value: (r) => Number(r.fee || 0).toFixed(2) },
    { title: '发票抬头', value: (r) => r.invoiceTitle },
    { title: '核销编号', value: (r) => r.yikuaibaoVoucherNo },
    { title: '核销状态', value: (r) => (r.status === 'verified' ? '已核销' : '待核销') },
    { title: '录入时间', value: (r) => r.createTime },
  ], filteredRecords.value)
}
</script>
