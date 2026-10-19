<template>
  <div class="p-4 space-y-4 bg-st-bg min-h-full">
    <!-- 顶部工作台标题与操作 -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <h2 class="text-base font-bold text-st-title">业务与资金审批工作台 (多级风控流转)</h2>
          <el-tag size="small" type="danger" effect="plain">强管控三级审批</el-tag>
        </div>
        <p class="text-xs text-st-muted mt-1">
          标准化 3 级严密风控审批流：
          <span class="text-st-primary font-medium">1/3 教学课消核实</span> &rarr;
          <span class="text-st-primary font-medium">2/3 校区校长审批</span> &rarr;
          <span class="text-st-primary font-medium">3/3 总部财务终审</span>
        </p>
      </div>

      <div class="flex items-center space-x-2">
        <el-button
          size="small"
          type="primary"
          :disabled="selectedPendingRows.length === 0"
          @click="handleBatchPass"
        >
          <el-icon class="mr-1"><Check /></el-icon>
          批量同意 ({{ selectedPendingRows.length }})
        </el-button>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="selectedPendingRows.length === 0"
          @click="handleBatchReject"
        >
          <el-icon class="mr-1"><Close /></el-icon>
          批量驳回
        </el-button>
      </div>
    </div>

    <!-- 3 大业务主 Tab (常规收款确认 | 季度扣费审批 | 退费多级复核) -->
    <div class="bg-white rounded-lg px-4 py-2.5 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <el-button-group size="small">
        <el-button
          v-for="biz in businessTabs"
          :key="biz.key"
          :type="activeBusinessTab === biz.key ? 'primary' : 'default'"
          @click="handleBusinessTabChange(biz.key)"
        >
          <span>{{ biz.name }}</span>
          <span
            :class="[
              'text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-1.5',
              activeBusinessTab === biz.key ? 'bg-white text-st-primary' : 'bg-gray-200 text-st-muted'
            ]"
          >
            {{ businessCounts[biz.key] || 0 }}
          </span>
        </el-button>
      </el-button-group>

      <!-- 横向状态分段 Tab (待我审批 | 已通过 | 已驳回 | 全部单据) -->
      <div class="flex items-center space-x-1">
        <el-button
          v-for="st in statusTabs"
          :key="st.key"
          size="small"
          :type="activeStatusTab === st.key ? 'primary' : 'default'"
          :plain="activeStatusTab === st.key"
          class="!m-0"
          @click="activeStatusTab = st.key"
        >
          {{ st.name }}
        </el-button>
      </div>
    </div>

    <!-- 审批流转可视化概览 (ElSteps 呈现 3 个审批阶段规范) -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border">
      <div class="text-xs font-bold text-st-title mb-3 flex items-center justify-between">
        <span>多级审批流转标准链路规范</span>
        <span class="text-st-muted font-normal text-[11px]">* 任意节点驳回即终止流转，终审通过后原子级触发资金变动</span>
      </div>
      <el-steps :active="2" finish-status="success" align-center size="small">
        <el-step title="1. 教学课消核实" description="教学主管/学管核验排课出勤与待消课时" />
        <el-step title="2. 校区校长审批" description="分校区校长核准退费原因/优惠减免额度" />
        <el-step title="3. 总部财务终审" description="集团财务中心核销账目并出纳打款原路退回" />
      </el-steps>
    </div>

    <!-- 核心审批单表格 -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border">
      <el-table
        ref="approvalTableRef"
        :data="filteredApprovals"
        style="width: 100%"
        stripe
        size="small"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="42" align="center" />

        <el-table-column prop="approvalNo" label="审批单号" width="175">
          <template #default="{ row }">
            <span
              class="font-mono text-xs text-st-secondary hover:text-st-primary cursor-pointer flex items-center space-x-1"
              @click="copyText(row.approvalNo, '审批单号')"
              title="点击复制单号"
            >
              <span>{{ row.approvalNo }}</span>
              <el-icon class="text-[11px]"><DocumentCopy /></el-icon>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="businessType" label="业务类型" width="125">
          <template #default="{ row }">
            <el-tag
              :type="row.businessType === 'refund' ? 'danger' : row.businessType === 'quarterly' ? 'warning' : 'primary'"
              size="small"
            >
              {{ getBusinessLabel(row.businessType as any) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="applicantName" label="申请人" width="105" />

        <el-table-column label="关联合同/学员" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div>
              <span class="font-medium text-st-title">{{ row.studentName }}</span>
              <span class="text-st-muted font-mono text-[11px] ml-1">({{ row.studentNo }})</span>
            </div>
            <div class="text-[11px] text-st-muted truncate">{{ row.reason }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="campusName" label="归属校区" width="110" />

        <el-table-column prop="amount" label="涉及金额" width="130" align="right" sortable>
          <template #default="{ row }">
            <span
              :class="[
                'font-bold font-mono text-sm',
                row.businessType === 'refund' ? 'text-st-danger' : 'text-emerald-600'
              ]"
            >
              ¥ {{ row.amount.toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <!-- 当前审批节点 (步骤条视觉微徽章) -->
        <el-table-column label="当前审批节点" min-width="170">
          <template #default="{ row }">
            <div class="flex items-center space-x-1.5">
              <el-tag
                :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'"
                size="small"
                effect="dark"
              >
                {{ row.status === 'approved' ? '已办结' : row.status === 'rejected' ? '已驳回' : `${row.currentStep}/3` }}
              </el-tag>
              <span class="text-xs font-medium text-st-title">
                {{ getStepName(row as any) }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="申请时间" width="155" sortable />

        <el-table-column prop="status" label="审批状态" width="95" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'"
              size="small"
            >
              {{ row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已驳回' : '审批中' }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="flex items-center space-x-1">
              <template v-if="row.status === 'pending'">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="openPassDialog(row as any)"
                >
                  同意
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="openRejectDialog(row as any)"
                >
                  驳回
                </el-button>
              </template>
              <el-button
                link
                type="primary"
                size="small"
                @click="openTimelineDialog(row as any)"
              >
                流转轨迹
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 弹窗 1: 同意审批确认 (Pass Dialog) -->
    <el-dialog
      v-model="passDialogVisible"
      title="审批通过确认"
      width="480px"
      destroy-on-close
    >
      <div v-if="currentActiveRecord" class="space-y-3 text-xs">
        <div class="bg-blue-50/70 p-3 rounded border border-blue-100 space-y-1">
          <div><span class="text-st-muted">审批单号：</span><strong class="font-mono text-st-title">{{ currentActiveRecord.approvalNo }}</strong></div>
          <div><span class="text-st-muted">业务类型：</span><span>{{ getBusinessLabel(currentActiveRecord.businessType) }}</span></div>
          <div><span class="text-st-muted">学员及校区：</span><span>{{ currentActiveRecord.studentName }} ({{ currentActiveRecord.campusName }})</span></div>
          <div><span class="text-st-muted">当前推进节点：</span><strong class="text-st-primary">{{ getStepName(currentActiveRecord) }}</strong></div>
          <div><span class="text-st-muted">涉及金额：</span><strong class="text-st-danger font-mono font-bold">¥ {{ currentActiveRecord.amount.toFixed(2) }}</strong></div>
        </div>

        <div>
          <label class="block font-medium text-st-regular mb-1">审批附言 (选填)</label>
          <el-input
            v-model="passComment"
            type="textarea"
            :rows="2"
            placeholder="填写审批核准留言（如：已核验学员出勤课消无误，同意放行）"
            size="small"
          />
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="passDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmPass">确认通过</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 2: 驳回审批确认 (Reject Dialog) -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="审批驳回处理"
      width="480px"
      destroy-on-close
    >
      <div v-if="currentActiveRecord" class="space-y-3 text-xs">
        <el-alert
          title="驳回将立即终止审批流转并退回申请人重新提交！"
          type="error"
          show-icon
          :closable="false"
        />

        <div class="bg-gray-50 p-3 rounded border border-gray-200">
          <div><span class="text-st-muted">审批单号：</span><span class="font-mono">{{ currentActiveRecord.approvalNo }}</span></div>
          <div><span class="text-st-muted">学员姓名：</span><span>{{ currentActiveRecord.studentName }}</span></div>
          <div><span class="text-st-muted">涉及金额：</span><span class="font-mono font-bold text-st-danger">¥ {{ currentActiveRecord.amount.toFixed(2) }}</span></div>
        </div>

        <div>
          <label class="block font-medium text-st-danger mb-1">* 驳回原因与修改指导 (必填)</label>
          <el-input
            v-model="rejectComment"
            type="textarea"
            :rows="3"
            placeholder="请详细说明驳回原因（如：银行流水凭证模糊/退课扣费课时计算有误，需重新核算）"
            size="small"
          />
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="rejectDialogVisible = false">取消</el-button>
        <el-button size="small" type="danger" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 3: 审批流转时间轴 (ElTimeline Dialog) -->
    <el-dialog
      v-model="timelineDialogVisible"
      title="审批全流程审计轨迹与时间轴"
      width="540px"
      destroy-on-close
    >
      <div v-if="currentActiveRecord" class="space-y-4 text-xs">
        <div class="bg-gray-50 p-3 rounded border border-gray-200 grid grid-cols-2 gap-2">
          <div><span class="text-st-muted">单据编号：</span><span class="font-mono font-bold">{{ currentActiveRecord.approvalNo }}</span></div>
          <div><span class="text-st-muted">当前状态：</span><el-tag size="small" :type="currentActiveRecord.status === 'approved' ? 'success' : currentActiveRecord.status === 'rejected' ? 'danger' : 'warning'">{{ currentActiveRecord.status }}</el-tag></div>
          <div><span class="text-st-muted">申请人：</span><span>{{ currentActiveRecord.applicantName }}</span></div>
          <div><span class="text-st-muted">涉及学员：</span><span>{{ currentActiveRecord.studentName }}</span></div>
        </div>

        <div class="pt-2">
          <div class="font-bold text-st-title mb-3">多级审批流转历史轨迹</div>
          <el-timeline>
            <el-timeline-item
              timestamp="发起申请"
              placement="top"
              type="primary"
              size="normal"
            >
              <div class="font-medium text-st-title">{{ currentActiveRecord.applicantName }} 发起审批</div>
              <div class="text-[11px] text-st-muted mt-0.5">{{ currentActiveRecord.reason }}</div>
              <div class="text-[10px] text-st-secondary font-mono mt-0.5">{{ currentActiveRecord.createdAt }}</div>
            </el-timeline-item>

            <el-timeline-item
              v-for="(node, index) in (serverTimelineNodes.length > 0 ? serverTimelineNodes : currentActiveRecord.timeline)"
              :key="index"
              :timestamp="node.time"
              placement="top"
              :type="node.status === 'passed' ? 'success' : 'danger'"
              size="normal"
            >
              <div class="flex items-center space-x-2">
                <span class="font-bold text-st-title">{{ node.step }}</span>
                <el-tag :type="node.status === 'passed' ? 'success' : 'danger'" size="small">
                  {{ node.status === 'passed' ? '通过' : '驳回' }}
                </el-tag>
              </div>
              <div class="text-[11px] text-st-regular mt-1">
                操作人：<strong class="text-st-title">{{ node.operator }}</strong>
              </div>
              <div v-if="node.comment" class="text-[11px] text-st-muted mt-0.5 bg-gray-50 p-1.5 rounded border border-gray-100">
                审核附言：{{ node.comment }}
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <template #footer>
        <el-button size="small" type="primary" @click="timelineDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, DocumentCopy } from '@element-plus/icons-vue'
import { useTenantStore } from '@/stores/tenantStore'
import { financialApi } from '@/api'
import type { ApprovalRecord, ApprovalBusinessType } from '@/types/financial'

const tenantStore = useTenantStore()

// 3 大业务 Tab
const activeBusinessTab = ref<string>('all')
const businessTabs = [
  { key: 'all', name: '全部业务' },
  { key: 'payment', name: '常规收款确认' },
  { key: 'quarterly', name: '季度扣费审批' },
  { key: 'refund', name: '退费多级复核' }
]

// 状态分段 Tab
const activeStatusTab = ref<string>('all')
const statusTabs = [
  { key: 'all', name: '全部状态' },
  { key: 'pending', name: '待我审批' },
  { key: 'approved', name: '已通过' },
  { key: 'rejected', name: '已驳回' }
]

const remoteApprovals = ref<ApprovalRecord[]>([])

async function loadApprovals() {
  try {
    const res = await financialApi.getApprovals({
      campusId: tenantStore.currentCampusId
    })
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
      if (Array.isArray(list)) {
        remoteApprovals.value = list
        return
      }
    }
  } catch (err) {
    console.warn('[ApprovalFlow] 远程审批单拉取失败:', err)
  }
  remoteApprovals.value = []
}

const allApprovals = computed(() => {
  return remoteApprovals.value
})

const businessCounts = computed(() => {
  const map: Record<string, number> = {
    all: allApprovals.value.length,
    payment: 0,
    quarterly: 0,
    refund: 0
  }
  for (const a of allApprovals.value) {
    if (map[a.businessType] !== undefined) {
      map[a.businessType]++
    }
  }
  return map
})

const filteredApprovals = computed(() => {
  return allApprovals.value.filter(a => {
    if (activeBusinessTab.value !== 'all' && a.businessType !== activeBusinessTab.value) {
      return false
    }
    if (activeStatusTab.value !== 'all' && a.status !== activeStatusTab.value) {
      return false
    }
    return true
  })
})

function handleBusinessTabChange(key: string) {
  activeBusinessTab.value = key
}

// 多选
const selectedRows = ref<ApprovalRecord[]>([])
function handleSelectionChange(rows: ApprovalRecord[]) {
  selectedRows.value = rows
}

const selectedPendingRows = computed(() => {
  return selectedRows.value.filter(r => r.status === 'pending')
})

// 辅助方法
function getBusinessLabel(type: ApprovalBusinessType): string {
  switch (type) {
    case 'payment': return '常规收款确认'
    case 'quarterly': return '季度扣费审批'
    case 'refund': return '退费多级复核'
    case 'transfer': return '学员转校审批'
    case 'make_over': return '学员转让审批'
    case 'wallet_prestore': return '钱包预存审批'
    case 'service_fee': return '代报考审批'
    default: return type
  }
}

function getStepName(record: ApprovalRecord): string {
  if (record.status === 'approved') return '终审完成 (已办结)'
  if (record.status === 'rejected') return '流转中断 (已驳回)'

  switch (record.currentStep) {
    case 1: return '1/3 教学课消核实'
    case 2: return '2/3 校区校长审批'
    case 3: return '3/3 总部财务终审'
    default: return `第 ${record.currentStep} 步审批`
  }
}

// 弹窗逻辑
const passDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const timelineDialogVisible = ref(false)

const currentActiveRecord = ref<ApprovalRecord | null>(null)
const passComment = ref('')
const rejectComment = ref('')

function openPassDialog(record: ApprovalRecord) {
  currentActiveRecord.value = record
  passComment.value = ''
  passDialogVisible.value = true
}

async function confirmPass() {
  if (!currentActiveRecord.value) return
  try {
    await financialApi.auditApproval(currentActiveRecord.value.id, {
      action: 'pass',
      comment: passComment.value || '审核通过'
    })
    passDialogVisible.value = false
    ElMessage.success('审批已成功推进至下一节点并同步落盘')
    await loadApprovals()
  } catch (err: any) {
    ElMessage.error(err.message || '审批推进失败')
  }
}

function openRejectDialog(record: ApprovalRecord) {
  currentActiveRecord.value = record
  rejectComment.value = ''
  rejectDialogVisible.value = true
}

async function confirmReject() {
  if (!currentActiveRecord.value) return
  if (!rejectComment.value.trim()) {
    ElMessage.warning('驳回审批必须填写明确的驳回原因与修改意见！')
    return
  }

  try {
    await financialApi.auditApproval(currentActiveRecord.value.id, {
      action: 'reject',
      comment: rejectComment.value.trim()
    })
    rejectDialogVisible.value = false
    ElMessage.warning('审批单已驳回并中断流转，状态已同步落盘')
    await loadApprovals()
  } catch (err: any) {
    ElMessage.error(err.message || '驳回失败')
  }
}

const serverTimelineNodes = ref<any[]>([])

async function openTimelineDialog(record: ApprovalRecord) {
  currentActiveRecord.value = record
  serverTimelineNodes.value = []
  timelineDialogVisible.value = true
  try {
    const res = await financialApi.getApprovalTimeline(record.id)
    if (res && res.success && res.data && Array.isArray(res.data.nodes)) {
      serverTimelineNodes.value = res.data.nodes.map((n: any) => ({
        step: n.stepName,
        operator: n.reviewerName,
        comment: n.comment,
        time: n.createdAt ? n.createdAt.replace('T', ' ').slice(0, 19) : '',
        status: n.action === 'reject' ? 'rejected' : 'passed',
      }))
    }
  } catch (err) {
    console.warn('[ApprovalFlow] 后端时间轴拉取降级:', err)
  }
}

function copyText(text: string, title: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success(`${title}已复制`)
    }).catch(() => {})
  }
}

// 批量通过 (单请求调用后端 batchAudit 深模块接口)
async function handleBatchPass() {
  const count = selectedPendingRows.value.length
  if (count === 0) return

  try {
    await ElMessageBox.confirm(
      `确定要批量通过选中的 ${count} 笔待审单据吗？系统将推进其当前审批节点。`,
      '批量审批确认',
      {
        confirmButtonText: '确定批量通过',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    try {
      const approvalIds = selectedPendingRows.value.map(item => item.id)
      const res = await financialApi.batchAudit({
        approvalIds,
        action: 'pass',
        comment: '批量快速审批通过'
      })
      if (res && res.success) {
        ElMessage.success(`成功批量通过 ${res.data?.successCount ?? count} 笔审批单据`)
      } else {
        const failedCount = res.data?.failedCount || 0
        const successCount = res.data?.successCount || 0
        ElMessage.warning(`批量处理完成：成功 ${successCount} 笔，失败 ${failedCount} 笔`)
      }
      await loadApprovals()
    } catch (err: any) {
      ElMessage.error(err.message || '批量审批推进失败')
    }
  } catch {
    // 弹窗取消
  }
}

// 批量驳回 (单请求调用后端 batchAudit 深模块接口)
async function handleBatchReject() {
  const count = selectedPendingRows.value.length
  if (count === 0) return

  try {
    const { value } = await ElMessageBox.prompt('请输入批量驳回的统一说明附言：', '批量驳回确认', {
      confirmButtonText: '确定驳回',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '驳回说明不能为空'
    })
    try {
      const approvalIds = selectedPendingRows.value.map(item => item.id)
      const res = await financialApi.batchAudit({
        approvalIds,
        action: 'reject',
        comment: value
      })
      if (res && res.success) {
        ElMessage.warning(`已批量驳回 ${res.data?.successCount ?? count} 笔审批单据`)
      } else {
        const failedCount = res.data?.failedCount || 0
        const successCount = res.data?.successCount || 0
        ElMessage.warning(`批量驳回完成：已驳回 ${successCount} 笔，异常 ${failedCount} 笔`)
      }
      await loadApprovals()
    } catch (err: any) {
      ElMessage.error(err.message || '批量驳回失败')
    }
  } catch {
    // 弹窗取消
  }
}

onMounted(async () => {
  await loadApprovals()
})

watch(() => tenantStore.currentCampusId, () => {
  loadApprovals()
})
</script>
