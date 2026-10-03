<template>
  <div class="p-4 space-y-4 bg-st-bg min-h-full">
    <!-- 顶部标题与风控导读 -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <h2 class="text-base font-bold text-st-title">校区收费流水账本 (资金进出风控)</h2>
          <el-tag size="small" type="success" effect="plain">银企直联核验</el-tag>
        </div>
        <p class="text-xs text-st-muted mt-1">
          统筹核算线上微信商户号、支付宝生活号扫码收单、招商银行对公电汇、线下银联POS机与学员钱包预存款明细账目
        </p>
      </div>

      <div class="flex items-center space-x-2">
        <el-button size="small" @click="handleRefresh">
          <el-icon class="mr-1"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" size="small" @click="handleExportLedger">
          <el-icon class="mr-1"><Download /></el-icon>
          导出对账单
        </el-button>
      </div>
    </div>

    <!-- 4 大核心风控资金指标卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
        <div class="text-xs text-st-muted flex justify-between items-center">
          <span>今日收款流水总额</span>
          <el-tag size="small" type="success">实时</el-tag>
        </div>
        <div class="text-xl font-bold font-mono text-st-title mt-1.5">
          ¥ {{ metrics.todayAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </div>
        <div class="text-[11px] text-st-muted mt-1">
          今日交易笔数：<strong class="text-st-primary font-mono">{{ metrics.todayCount }}</strong> 笔
        </div>
      </div>

      <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
        <div class="text-xs text-st-muted flex justify-between items-center">
          <span>本期实收流水净额</span>
          <el-tag size="small" type="primary">当月账期</el-tag>
        </div>
        <div class="text-xl font-bold font-mono text-st-danger mt-1.5">
          ¥ {{ metrics.netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </div>
        <div class="text-[11px] text-st-muted mt-1">
          累计实收订单：<strong class="text-st-title font-mono">{{ metrics.totalCount }}</strong> 笔
        </div>
      </div>

      <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
        <div class="text-xs text-st-muted flex justify-between items-center">
          <span>线上通道收单占比</span>
          <span class="text-emerald-600 font-mono font-bold">{{ metrics.onlineRatio }}%</span>
        </div>
        <div class="text-xl font-bold font-mono text-emerald-600 mt-1.5">
          ¥ {{ metrics.onlineAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </div>
        <div class="text-[11px] text-st-muted mt-1">
          微信商户号 + 支付宝生活号
        </div>
      </div>

      <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
        <div class="text-xs text-st-muted flex justify-between items-center">
          <span>对公转账与POS刷卡</span>
          <span class="text-blue-600 font-mono font-bold">{{ metrics.bankPosRatio }}%</span>
        </div>
        <div class="text-xl font-bold font-mono text-blue-600 mt-1.5">
          ¥ {{ metrics.bankPosAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </div>
        <div class="text-[11px] text-st-muted mt-1">
          招商银行对公电汇 + 银联POS
        </div>
      </div>
    </div>

    <!-- 筛选过滤栏 -->
    <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-2.5">
      <div class="flex flex-wrap items-center gap-2">
        <el-select v-model="filterCampus" placeholder="归属校区" size="small" class="!w-36" clearable>
          <el-option label="全部校区" value="all" />
          <el-option label="总部校区" value="campus-bj-hq" />
          <el-option label="远洋校区" value="campus-bj-yy" />
          <el-option label="朝阳校区" value="campus-bj-cy" />
          <el-option label="海淀分校" value="campus-bj-hd" />
          <el-option label="望京校区" value="campus-bj-wj" />
        </el-select>

        <el-select v-model="filterMethod" placeholder="结算通道" size="small" class="!w-36" clearable>
          <el-option label="全部通道" value="all" />
          <el-option label="微信商户号" value="微信商户号" />
          <el-option label="支付宝生活号" value="支付宝生活号" />
          <el-option label="招商银行对公" value="招商银行对公" />
          <el-option label="银联POS" value="银联POS" />
        </el-select>

        <el-select v-model="filterType" placeholder="收费类型" size="small" class="!w-36" clearable>
          <el-option label="全部类型" value="all" />
          <el-option label="新签报读" value="新签报读" />
          <el-option label="续费培优" value="续费培优" />
          <el-option label="季度扣费" value="季度扣费" />
          <el-option label="换课差额" value="换课差额" />
          <el-option label="退费返还" value="退费返还" />
          <el-option label="代报考服务费" value="代报考服务费" />
          <el-option label="钱包充值" value="钱包充值" />
        </el-select>

        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          size="small"
          class="!w-56"
        />

        <el-input
          v-model="filterKeyword"
          placeholder="搜索学员姓名/流水单号"
          size="small"
          class="!w-44"
          clearable
        />

        <el-button type="primary" size="small" @click="handleFilter">查询</el-button>
        <el-button size="small" @click="resetFilter">重置</el-button>
      </div>

      <div class="text-xs text-st-muted">
        当前筛选匹配流水：<strong class="text-st-primary font-mono">{{ displayLedgers.length }}</strong> 笔
      </div>
    </div>

    <!-- 流水账本核心表格 -->
    <div class="bg-white rounded-lg p-4 shadow-card border border-st-border">
      <el-table
        :data="displayLedgers"
        style="width: 100%"
        stripe
        size="small"
      >
        <el-table-column prop="transNo" label="流水单号" width="165">
          <template #default="{ row }">
            <span
              class="font-mono text-xs text-st-secondary hover:text-st-primary cursor-pointer flex items-center space-x-1"
              @click="copyText(row.transNo, '流水单号')"
              title="点击复制单号"
            >
              <span>{{ row.transNo }}</span>
              <el-icon class="text-[11px]"><DocumentCopy /></el-icon>
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="orderNo" label="关联订单号" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="font-mono text-xs">{{ row.orderNo || '--' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="date" label="交易时间" width="155" sortable />

        <el-table-column prop="campusName" label="归属校区" width="110" />

        <el-table-column label="缴费学员" width="130">
          <template #default="{ row }">
            <div>
              <span class="font-semibold text-st-title">{{ row.student }}</span>
              <span v-if="row.studentNo" class="text-st-muted font-mono text-[11px] ml-1">({{ row.studentNo }})</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="收费类型" width="120">
          <template #default="{ row }">
            <el-tag
              :type="row.type === '退费返还' ? 'danger' : row.type === '续费培优' ? 'warning' : 'primary'"
              size="small"
            >
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="amount" label="实收金额" width="130" align="right" sortable>
          <template #default="{ row }">
            <span
              :class="[
                'font-bold font-mono text-sm',
                row.amount < 0 ? 'text-blue-600' : 'text-st-danger'
              ]"
            >
              ¥ {{ row.amount.toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="method" label="结算通道" width="130">
          <template #default="{ row }">
            <el-tag
              :type="row.method === '微信商户号' ? 'success' : row.method === '支付宝生活号' ? '' : row.method === '招商银行对公' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.method }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="verifier" label="对账人" width="100" />

        <el-table-column prop="status" label="对账状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '已退款' ? 'info' : 'success'" size="small">
              {{ row.status || '已核销' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openLedgerDetail(row)">
              明细对账
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 弹窗: 明细账单详情 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="资金对账流水明细单"
      width="520px"
      destroy-on-close
    >
      <div v-if="currentLedger" class="space-y-3 text-xs">
        <el-descriptions title="资金流水单凭证" :column="2" border size="small">
          <el-descriptions-item label="流水单号">{{ currentLedger.transNo }}</el-descriptions-item>
          <el-descriptions-item label="交易时间">{{ currentLedger.date }}</el-descriptions-item>
          <el-descriptions-item label="缴费学员">{{ currentLedger.student }} ({{ currentLedger.studentNo || '--' }})</el-descriptions-item>
          <el-descriptions-item label="归属校区">{{ currentLedger.campusName }}</el-descriptions-item>
          <el-descriptions-item label="收费类型">{{ currentLedger.type }}</el-descriptions-item>
          <el-descriptions-item label="结算通道">{{ currentLedger.method }}</el-descriptions-item>
          <el-descriptions-item label="交易金额">
            <span class="font-bold text-st-danger font-mono">¥ {{ currentLedger.amount.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="核验状态">{{ currentLedger.status || '已核销' }}</el-descriptions-item>
          <el-descriptions-item label="对账责任人" :span="2">{{ currentLedger.verifier }}</el-descriptions-item>
          <el-descriptions-item label="对账附言" :span="2">{{ currentLedger.remark || '银企直联核验自动平账' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button size="small" type="primary" @click="detailDialogVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, DocumentCopy } from '@element-plus/icons-vue'
import { useTenantStore } from '@/stores/tenantStore'
import { financialApi } from '@/api'
import { getLedgerRecords, isCampusMatch } from '@/mocks/financial'
import type { LedgerRecord } from '@/types/financial'

const tenantStore = useTenantStore()

const filterCampus = ref('all')
const filterMethod = ref('all')
const filterType = ref('all')
const filterDateRange = ref<string[] | null>(null)
const filterKeyword = ref('')

const remoteLedgers = ref<LedgerRecord[]>([])

async function loadLedgers() {
  const fallbackList = getLedgerRecords(tenantStore.currentCampusId)
  try {
    const res = await financialApi.getOrders({
      campusId: filterCampus.value === 'all' ? undefined : filterCampus.value,
      pageSize: 200
    }, [])
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
      if (Array.isArray(list) && list.length > 0) {
        remoteLedgers.value = list.map((o: any) => ({
          transNo: `TX${o.orderNo ? o.orderNo.replace(/\D/g, '') : Date.now()}`,
          orderNo: o.orderNo,
          date: o.payTime ? o.payTime.replace('T', ' ').slice(0, 19) : (o.createdAt ? o.createdAt.replace('T', ' ').slice(0, 19) : '2026-09-21 10:00:00'),
          campusId: o.campusId,
          campusName: o.campus?.name || tenantStore.currentCampus.name,
          student: o.student?.name || o.studentName || '学员',
          studentNo: o.student?.studentNo || o.studentNo || 'S001',
          type: o.orderType === 'refund' ? '退费冲减' : (o.orderType === 'quarterly' ? '季度学费' : '常规学费'),
          amount: o.orderType === 'refund' ? -Math.abs(Number(o.actualAmount || 0)) : Number(o.actualAmount || 0),
          method: o.paymentMethod === 'wechat' ? '微信商户号' : (o.paymentMethod === 'alipay' ? '支付宝生活号' : (o.paymentMethod === 'bank_transfer' ? '招商银行对公' : '银联POS')),
          verifier: o.creator?.realName || o.creator || '系统财务',
          status: o.status === 'paid' ? '已核销' : (o.status === 'void' ? '已作废' : '待处理')
        }))
        return
      }
    }
  } catch (err) {
    console.warn('[ChargingLedger] 远程流水拉取未就绪，使用本地双轨模式:', err)
  }
  remoteLedgers.value = fallbackList
}

const allLedgers = computed(() => {
  return remoteLedgers.value.length > 0 ? remoteLedgers.value : getLedgerRecords(tenantStore.currentCampusId)
})

const displayLedgers = computed(() => {
  return allLedgers.value.filter(item => {
    if (filterCampus.value && filterCampus.value !== 'all') {
      if (!isCampusMatch(item.campusId, filterCampus.value)) return false
    }
    if (filterMethod.value && filterMethod.value !== 'all' && item.method !== filterMethod.value) {
      return false
    }
    if (filterType.value && filterType.value !== 'all' && item.type !== filterType.value) {
      return false
    }
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      const d = item.date.split(' ')[0]
      if (d < filterDateRange.value[0] || d > filterDateRange.value[1]) return false
    }
    if (filterKeyword.value.trim()) {
      const kw = filterKeyword.value.trim().toLowerCase()
      const matchTrans = item.transNo.toLowerCase().includes(kw)
      const matchStu = item.student.toLowerCase().includes(kw)
      const matchNo = (item.studentNo || '').toLowerCase().includes(kw)
      const matchOrder = (item.orderNo || '').toLowerCase().includes(kw)
      if (!matchTrans && !matchStu && !matchNo && !matchOrder) return false
    }
    return true
  })
})

// 资金核心风控指标统计
const metrics = computed(() => {
  const list = allLedgers.value
  let totalCents = 0
  let todayCents = 0
  let todayCount = 0
  let onlineCents = 0
  let bankPosCents = 0

  const todayStr = '2026-09-21'

  for (const item of list) {
    const cents = Math.round(item.amount * 100)
    totalCents += cents

    if (item.date.startsWith(todayStr)) {
      todayCents += cents
      todayCount++
    }

    if (item.method === '微信商户号' || item.method === '支付宝生活号') {
      onlineCents += cents
    } else if (item.method === '招商银行对公' || item.method === '银联POS') {
      bankPosCents += cents
    }
  }

  const netAmount = Number((totalCents / 100).toFixed(2))
  const todayAmount = Number((todayCents / 100).toFixed(2))
  const onlineAmount = Number((onlineCents / 100).toFixed(2))
  const bankPosAmount = Number((bankPosCents / 100).toFixed(2))

  const totalAbs = Math.abs(onlineAmount) + Math.abs(bankPosAmount)
  const onlineRatio = totalAbs > 0 ? Math.round((Math.abs(onlineAmount) / totalAbs) * 100) : 0
  const bankPosRatio = 100 - onlineRatio

  return {
    netAmount,
    totalCount: list.length,
    todayAmount,
    todayCount,
    onlineAmount,
    bankPosAmount,
    onlineRatio,
    bankPosRatio
  }
})

function handleFilter() {
  ElMessage.success(`查询完成，匹配到 ${displayLedgers.value.length} 笔对账流水`)
}

function resetFilter() {
  filterCampus.value = 'all'
  filterMethod.value = 'all'
  filterType.value = 'all'
  filterDateRange.value = null
  filterKeyword.value = ''
  ElMessage.info('已重置筛选条件')
}

function handleRefresh() {
  loadLedgers()
  ElMessage.success('流水账本已刷新至最新账期数据')
}

onMounted(async () => {
  await loadLedgers()
})

watch(() => tenantStore.currentCampusId, () => {
  loadLedgers()
})

// 导出对账单
function handleExportLedger() {
  const data = displayLedgers.value
  if (data.length === 0) {
    ElMessage.warning('当前无对账数据可导出')
    return
  }

  const headers = ['流水单号', '关联订单号', '交易时间', '归属校区', '缴费学员', '学号', '收费类型', '实收金额', '结算通道', '对账人', '状态']
  const rows = data.map(l => [
    l.transNo,
    l.orderNo || '',
    l.date,
    l.campusName,
    l.student,
    l.studentNo || '',
    l.type,
    l.amount,
    l.method,
    l.verifier,
    l.status || '已核销'
  ])

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map(e => e.join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `校区资金流水对账单_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  ElMessage.success(`成功导出 ${data.length} 笔对账流水明细`)
}

// 明细账单详情
const detailDialogVisible = ref(false)
const currentLedger = ref<LedgerRecord | null>(null)

function openLedgerDetail(row: LedgerRecord) {
  currentLedger.value = row
  detailDialogVisible.value = true
}

function copyText(text: string, title: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success(`${title}已复制`)
    }).catch(() => {})
  }
}
</script>
