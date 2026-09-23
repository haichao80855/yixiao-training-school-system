<template>
  <div class="p-5 space-y-4">
    <!-- 顶部统计看板与易快报对接状态 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">待财务核销总金额</div>
          <div class="text-2xl font-bold font-mono text-amber-600 mt-1">¥ {{ pendingTotalFee.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
          ⏳
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">已核销入账总金额</div>
          <div class="text-2xl font-bold font-mono text-emerald-600 mt-1">¥ {{ verifiedTotalFee.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
          ✓
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">本月代报考人次</div>
          <div class="text-2xl font-bold font-mono text-st-primary mt-1">{{ records.length }} <span class="text-xs font-normal">人次</span></div>
        </div>
        <div class="w-10 h-10 rounded-full bg-blue-50 text-st-primary flex items-center justify-center font-bold text-lg">
          🏆
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border border-st-border shadow-card flex items-center justify-between">
        <div>
          <div class="text-xs text-st-muted">易快报费控系统连接</div>
          <div class="flex items-center space-x-2 mt-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span class="text-xs font-bold text-emerald-700">实时联通 (API 正常)</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
          🔗
        </div>
      </div>
    </div>

    <!-- 筛选面板与多 Tab 切换 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <!-- 多 Tab -->
        <el-radio-group v-model="activeTab" size="small">
          <el-radio-button value="all">全部报考记录 ({{ records.length }})</el-radio-button>
          <el-radio-button value="pending">待财务核销 ({{ pendingList.length }})</el-radio-button>
          <el-radio-button value="verified">已核销入账 ({{ verifiedList.length }})</el-radio-button>
        </el-radio-group>

        <div class="space-x-2">
          <el-button size="small" plain @click="handleExportReport">导出代报考对账单</el-button>
          <el-button
            size="small"
            type="warning"
            :disabled="selectedRows.length === 0"
            @click="handleBatchVerify"
          >
            批量核销 (已选 {{ selectedRows.length }})
          </el-button>
          <el-button type="primary" size="small" @click="showAddDialog = true">
            + 新增报考记录
          </el-button>
        </div>
      </div>

      <!-- 检索项 -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-64">
          <el-input v-model="keyword" placeholder="搜索单号、学员姓名或赛事名称..." size="small" clearable />
        </div>
        <div class="w-48">
          <el-select v-model="selectedCategory" size="small" placeholder="类型过滤" clearable class="w-full">
            <el-option label="全部类型" value="" />
            <el-option label="等级考试" value="certification" />
            <el-option label="白名单赛事" value="competition" />
          </el-select>
        </div>
        <el-button size="small" @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 服务费数据表格 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <el-table
        :data="filteredRecords"
        style="width: 100%"
        stripe
        @selection-change="(rows: ServiceFeeRecord[]) => selectedRows = rows"
      >
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
        <el-table-column label="易快报凭证号" width="160">
          <template #default="{ row }">
            <span v-if="row.yikuaibaoVoucherNo" class="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
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
            <el-button link type="primary" size="small" @click="handleViewVoucher(row)">凭证查看</el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="success"
              size="small"
              @click="handleSingleVerify(row)"
            >
              核销登记
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 凭证查看弹窗 -->
    <el-dialog v-model="voucherDialogVisible" title="考级报考与易快报核销对账凭证" width="560px">
      <div v-if="activeRecord" class="space-y-4 text-xs">
        <div class="border rounded p-4 bg-slate-50 space-y-2">
          <div class="flex justify-between border-b pb-2">
            <span class="font-bold text-sm text-st-title">代报项目：{{ activeRecord.examType }}</span>
            <span class="text-st-danger-deep font-bold font-mono text-sm">¥ {{ activeRecord.fee.toFixed(2) }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-st-secondary">
            <div>单号: <b class="font-mono">{{ activeRecord.certNo }}</b></div>
            <div>学员: <b>{{ activeRecord.studentName }} ({{ activeRecord.studentNo }})</b></div>
            <div>归属校区: <b>{{ activeRecord.campusName }}</b></div>
            <div>发票抬头: <b>{{ activeRecord.invoiceTitle }}</b></div>
            <div>易快报单号: <b class="font-mono text-indigo-700">{{ activeRecord.yikuaibaoVoucherNo || '暂无' }}</b></div>
            <div>核销时间: <b class="font-mono">{{ activeRecord.verifyTime || '待核销' }}</b></div>
          </div>
        </div>

        <div class="border rounded p-3 text-center bg-gray-50 space-y-2">
          <div class="text-st-muted text-[11px]">电子凭证与发票扫描附件：</div>
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
    <el-dialog v-model="showAddDialog" title="新增考级 / 赛事代报名记录" width="560px">
      <el-form label-position="top" size="small">
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="报考学员" required>
            <el-select v-model="newRecordForm.studentId" filterable class="w-full" @change="handleStudentSelect">
              <el-option
                v-for="s in MOCK_STUDENTS"
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
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAdd">保存并提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 单条核销登记弹窗 -->
    <el-dialog v-model="singleVerifyDialog" title="易快报财务核销入账登记" width="450px">
      <div v-if="verifyTarget" class="space-y-3 text-xs">
        <div class="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900">
          为学员 <b class="font-bold">{{ verifyTarget.studentName }}</b> 的报考项目 [{{ verifyTarget.examType }}] 登记核销，金额 ¥{{ verifyTarget.fee }}。
        </div>
        <el-form label-position="top" size="small">
          <el-form-item label="易快报费控报销凭证单号" required>
            <el-input v-model="verifyVoucherNo" placeholder="如：YKB-20260921-0899" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="singleVerifyDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSingleVerify">确认核销入账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MOCK_SERVICE_FEES,
  MOCK_STUDENTS,
  addServiceFeeRecord,
  verifyServiceFeeRecord,
  batchVerifyServiceFeeRecords
} from '@/mocks'
import type { ServiceFeeRecord } from '@/types/student'

const activeTab = ref('all')
const keyword = ref('')
const selectedCategory = ref('')
const selectedRows = ref<ServiceFeeRecord[]>([])

const records = computed(() => {
  return MOCK_SERVICE_FEES
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
const activeRecord = ref<ServiceFeeRecord | null>(null)

function handleViewVoucher(row: ServiceFeeRecord) {
  activeRecord.value = row
  voucherDialogVisible.value = true
}

// 新增记录
const showAddDialog = ref(false)
const newRecordForm = reactive({
  studentId: 'std-001',
  studentName: '张小萌',
  studentNo: 'S948918',
  campusId: 'campus-bj-hq',
  category: 'certification' as 'certification' | 'competition',
  examType: '',
  fee: 450,
  invoiceTitle: ''
})

function handleStudentSelect(sId: string) {
  const s = MOCK_STUDENTS.find(item => item.id === sId)
  if (s) {
    newRecordForm.studentName = s.name
    newRecordForm.studentNo = s.studentNo
    newRecordForm.campusId = s.campusId
  }
}

function handleConfirmAdd() {
  if (!newRecordForm.examType.trim()) {
    ElMessage.warning('请输入考级或赛事项目名称')
    return
  }
  addServiceFeeRecord({
    studentId: newRecordForm.studentId,
    studentName: newRecordForm.studentName,
    studentNo: newRecordForm.studentNo,
    campusId: newRecordForm.campusId,
    examType: newRecordForm.examType,
    category: newRecordForm.category,
    fee: newRecordForm.fee,
    invoiceTitle: newRecordForm.invoiceTitle || `${newRecordForm.studentName} (个人)`
  })
  ElMessage.success('代报考记录已添加，并推送至易快报待审池！')
  showAddDialog.value = false
  newRecordForm.examType = ''
}

// 单条核销
const singleVerifyDialog = ref(false)
const verifyTarget = ref<ServiceFeeRecord | null>(null)
const verifyVoucherNo = ref('')

function handleSingleVerify(row: ServiceFeeRecord) {
  verifyTarget.value = row
  verifyVoucherNo.value = `YKB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
  singleVerifyDialog.value = true
}

function confirmSingleVerify() {
  if (!verifyTarget.value) return
  verifyServiceFeeRecord(verifyTarget.value.id, verifyVoucherNo.value)
  ElMessage.success(`核销入账成功！易快报凭证号: ${verifyVoucherNo.value}`)
  singleVerifyDialog.value = false
}

// 批量核销
function handleBatchVerify() {
  const pendingIds = selectedRows.value.filter(r => r.status === 'pending').map(r => r.id)
  if (pendingIds.length === 0) {
    ElMessage.info('所选项中没有待核销记录')
    return
  }
  const count = batchVerifyServiceFeeRecords(pendingIds)
  ElMessage.success(`成功批量核销 ${count} 笔代报考费用，凭证已回写易快报系统！`)
  selectedRows.value = []
}

function handleExportReport() {
  ElMessage.success(`代报考与易快报服务费对账单已生成，共 ${records.value.length} 笔明细。`)
}
</script>
