<template>
  <div class="p-6 space-y-4 max-w-[1680px] mx-auto">
    <!-- 标题与操作 -->
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-st-title">老师课酬</h1>
        <p class="mt-1 text-[13px] text-st-muted">按点名记录自动计算 · 只有校区负责人及以上可见</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <el-date-picker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          format="YYYY 年 MM 月"
          :clearable="false"
          :disabled-date="isFutureMonth"
          class="!w-44"
          aria-label="选择月份"
          @change="onMonthChange"
        />
        <el-dropdown trigger="click" :disabled="!data?.lines.length" @command="handleExport">
          <el-button :disabled="!data?.lines.length">
            <Download class="w-4 h-4 mr-1.5" />
            导出
            <ChevronDown class="w-4 h-4 ml-1" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="summary">导出汇总 (每位老师一行)</el-dropdown-item>
              <el-dropdown-item command="detail">导出逐节明细</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-if="data?.status === 'confirmed'" :loading="acting" @click="handleReopen">撤销确认</el-button>
        <el-tooltip v-else :disabled="!!data?.monthEnded" content="月底以后才能确认" placement="bottom">
          <span>
            <el-button type="primary" :loading="acting" :disabled="!data || !data.monthEnded || loading" @click="handleConfirm">
              <CheckCircle2 class="w-4 h-4 mr-1.5" />
              确认本月课酬
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <!-- 加载失败 -->
    <AppEmpty v-if="loadError && !data" type="error" :description="loadError" @retry="load" />

    <template v-else>
      <!-- 状态说明 -->
      <div v-if="data" class="space-y-2">
        <div class="flex flex-wrap items-center gap-2 text-[13px]">
          <span
            :class="[
              'px-2 py-0.5 rounded-md text-xs font-medium',
              data.status === 'confirmed' ? 'bg-st-success-light text-st-success' : 'bg-st-fill text-st-secondary',
            ]"
          >
            {{ data.status === 'confirmed' ? '已确认' : '未确认' }}
          </span>
          <span v-if="data.status === 'confirmed'" class="text-st-muted">
            {{ data.confirmedBy }} 于 {{ formatTime(data.confirmedAt) }} 确认，金额已锁定
          </span>
          <span v-else-if="!data.monthEnded" class="text-st-muted">本月还没结束，金额会随点名变化，月底后可以确认</span>
          <span v-else class="text-st-muted">金额按现在的点名记录实时计算，确认后锁定</span>
          <span v-if="data.lastReopenReason && data.status !== 'confirmed'" class="text-st-muted">
            · {{ data.lastReopenedBy }} 于 {{ formatTime(data.lastReopenedAt) }} 撤销过确认：{{ data.lastReopenReason }}
          </span>
        </div>
        <div
          v-if="data.status === 'confirmed' && data.liveTotalCents !== null && data.liveTotalCents !== data.summary.totalCents"
          class="flex items-start gap-2 rounded-lg bg-st-warning-light px-4 py-3 text-[13px] text-st-warning-deep"
        >
          <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            确认以后点名记录有变化：现在重算是 ¥{{ formatYuan(data.liveTotalCents) }}，比确认时
            {{ data.liveTotalCents > data.summary.totalCents ? '多' : '少' }}
            ¥{{ formatYuan(Math.abs(data.liveTotalCents - data.summary.totalCents)) }}。需要更正的话，先撤销确认再重新确认。
          </span>
        </div>
      </div>

      <!-- 汇总 -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <div v-for="card in summaryCards" :key="card.label" class="summary-card">
          <div class="text-[13px] text-st-secondary">{{ card.label }}</div>
          <div :class="['mt-1.5 font-semibold tabular-nums text-st-title', card.big ? 'text-[26px]' : 'text-[22px]']">
            {{ card.value }}
          </div>
        </div>
      </div>

      <!-- 规则 -->
      <div v-if="data" class="panel-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="text-[13px] text-st-regular leading-relaxed">
          <span class="font-semibold text-st-title mr-2">计算规则</span>
          当天有课：基础工资 <b class="tabular-nums">{{ data.rules.dailyBase }}</b> 元 + 每节课
          <b class="tabular-nums">{{ data.rules.perLesson }}</b> 元 + 每到课人次
          <b class="tabular-nums">{{ data.rules.perStudent }}</b> 元；当天到课满
          <b class="tabular-nums">{{ data.rules.bonusThreshold }}</b> 人次另奖
          <b class="tabular-nums">{{ data.rules.bonusAmount }}</b> 元。
          <span class="text-st-muted">只算已点名的正式课，试听课和补课不计；请假、缺勤不算到课。</span>
          <span v-if="data.status === 'confirmed'" class="text-st-muted">本月按确认时的规则计算。</span>
        </div>
        <el-button class="shrink-0" @click="openRules">修改规则</el-button>
      </div>

      <!-- 老师课酬表 -->
      <div class="panel-card !p-0 overflow-hidden">
        <el-table
          v-loading="loading"
          :data="data?.lines || []"
          row-key="teacherId"
          class="w-full"
          :default-sort="{ prop: 'totalCents', order: 'descending' }"
        >
          <el-table-column type="expand" width="44" fixed>
            <template #default="{ row }">
              <div class="px-6 py-3 bg-st-header">
                <el-table :data="row.days" size="small" class="day-table">
                  <el-table-column label="日期" width="130">
                    <template #default="{ row: day }">
                      <span class="tabular-nums">{{ formatDay(day.date) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="当天课次" min-width="300">
                    <template #default="{ row: day }">
                      <div v-for="l in day.lessons" :key="l.scheduleEventId" class="text-xs leading-6">
                        <span class="tabular-nums text-st-secondary">{{ l.startTime }}-{{ l.endTime }}</span>
                        <span class="mx-1.5 text-st-title">{{ l.className }}</span>
                        <span class="text-st-muted">到课 {{ l.attendedCount }} 人</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="到课人次" width="90" align="right">
                    <template #default="{ row: day }">
                      <span class="tabular-nums">{{ day.attendedCount }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="基础" width="90" align="right">
                    <template #default="{ row: day }"><span class="tabular-nums">{{ formatYuan(day.baseCents) }}</span></template>
                  </el-table-column>
                  <el-table-column label="课时费" width="90" align="right">
                    <template #default="{ row: day }"><span class="tabular-nums">{{ formatYuan(day.lessonCents) }}</span></template>
                  </el-table-column>
                  <el-table-column label="人次费" width="90" align="right">
                    <template #default="{ row: day }"><span class="tabular-nums">{{ formatYuan(day.studentCents) }}</span></template>
                  </el-table-column>
                  <el-table-column label="奖励" width="90" align="right">
                    <template #default="{ row: day }">
                      <span :class="['tabular-nums', day.bonusReached ? 'text-st-success' : 'text-st-placeholder']">
                        {{ formatYuan(day.bonusCents) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="当天合计" width="110" align="right">
                    <template #default="{ row: day }">
                      <span class="tabular-nums font-medium text-st-title">{{ formatYuan(day.totalCents) }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="teacherName" label="老师" min-width="120" fixed>
            <template #default="{ row }">
              <span class="font-medium text-st-title">{{ row.teacherName }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="teachingDays" label="上课天数" width="112" align="right" sortable>
            <template #default="{ row }"><span class="tabular-nums">{{ row.teachingDays }}</span></template>
          </el-table-column>
          <el-table-column prop="lessonCount" label="课次" width="80" align="right" sortable>
            <template #default="{ row }"><span class="tabular-nums">{{ row.lessonCount }}</span></template>
          </el-table-column>
          <el-table-column prop="attendedCount" label="到课人次" width="112" align="right" sortable>
            <template #default="{ row }"><span class="tabular-nums">{{ row.attendedCount }}</span></template>
          </el-table-column>
          <el-table-column prop="bonusDays" label="达标天数" width="96" align="right">
            <template #default="{ row }"><span class="tabular-nums">{{ row.bonusDays }}</span></template>
          </el-table-column>
          <el-table-column label="基础工资" width="110" align="right">
            <template #default="{ row }"><span class="tabular-nums">{{ formatYuan(row.baseCents) }}</span></template>
          </el-table-column>
          <el-table-column label="课时费" width="100" align="right">
            <template #default="{ row }"><span class="tabular-nums">{{ formatYuan(row.lessonCents) }}</span></template>
          </el-table-column>
          <el-table-column label="人次费" width="100" align="right">
            <template #default="{ row }"><span class="tabular-nums">{{ formatYuan(row.studentCents) }}</span></template>
          </el-table-column>
          <el-table-column label="奖励" width="90" align="right">
            <template #default="{ row }"><span class="tabular-nums">{{ formatYuan(row.bonusCents) }}</span></template>
          </el-table-column>
          <el-table-column prop="totalCents" label="合计 (元)" width="130" align="right" sortable fixed="right">
            <template #default="{ row }">
              <span class="tabular-nums font-semibold text-st-title">{{ formatYuan(row.totalCents) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <AppEmpty
              :type="loadError ? 'error' : 'data'"
              :title="loadError ? '加载失败' : '本月还没有已点名的正式课'"
              :description="loadError || '老师在讲台点名或结课后，这里会自动算出课酬'"
              :show-action="!!loadError"
              @retry="load"
            />
          </template>
        </el-table>
      </div>
    </template>

    <!-- 修改规则 -->
    <el-dialog v-model="rulesVisible" title="修改课酬规则" :width="DIALOG_SIZE.sm" destroy-on-close>
      <el-form label-position="top" class="grid grid-cols-2 gap-x-4">
        <el-form-item v-for="field in RULE_FIELDS" :key="field.key" :label="field.label">
          <el-input-number
            v-model="rulesForm[field.key]"
            :min="0"
            :max="100000"
            :precision="field.key === 'bonusThreshold' ? 0 : 2"
            controls-position="right"
            class="!w-full"
          />
          <div class="text-xs text-st-muted mt-1">{{ field.hint }}</div>
        </el-form-item>
      </el-form>
      <p class="text-xs text-st-muted">
        规则按校区保存。修改后只影响还没确认的月份，已确认的月份仍按确认时的规则。
      </p>
      <template #footer>
        <el-button @click="rulesVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingRules" @click="saveRules">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import AppEmpty from '@/components/AppEmpty.vue'
import { DIALOG_SIZE } from '@/constants/ui'
import { useLoadState } from '@/composables/useLoadState'
import { downloadCsv } from '@/utils/csvExport'
import { useTenantStore } from '@/stores/tenantStore'
import { teacherPayApi, formatYuan, type TeacherPayMonth, type TeacherPayRules, type TeacherPayLine } from '@/api/modules/teacherPay'

const tenantStore = useTenantStore()
const { loading, loadError, track, fail } = useLoadState()

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
/** 默认看本月；月初几天上个月还没确认时，大多要处理的是上个月，所以 1~5 号默认上个月 */
const defaultMonth = now.getDate() <= 5
  ? (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    })()
  : currentMonth

const route = useRoute()
const router = useRouter()
/** 月份记在地址栏 (?month=2026-10)，刷新或分享链接后仍是同一个月 */
const queryMonth = typeof route.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month) && route.query.month <= currentMonth
  ? route.query.month
  : ''
const month = ref(queryMonth || defaultMonth)

function onMonthChange() {
  router.replace({ query: { ...route.query, month: month.value } })
  load()
}
const data = ref<TeacherPayMonth | null>(null)
const acting = ref(false)

function isFutureMonth(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}` > currentMonth
}

function load() {
  return track(async (isLatest) => {
    try {
      const res = await teacherPayApi.getMonth(month.value)
      // 快速切换月份时，只显示最后选的那个月
      if (!isLatest()) return
      data.value = res.data
    } catch (err) {
      data.value = null
      fail(err, '加载课酬失败')
    }
  })
}

const summaryCards = computed(() => {
  const s = data.value?.summary
  return [
    { label: '老师人数', value: s ? s.teacherCount : '--' },
    { label: '上课天数 (合计)', value: s ? s.teachingDays : '--' },
    { label: '计酬课次', value: s ? s.lessonCount : '--' },
    { label: '到课人次', value: s ? s.attendedCount : '--' },
    { label: '课酬合计 (元)', value: s ? formatYuan(s.totalCents) : '--', big: true },
  ]
})

function formatTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function formatDay(date: string) {
  const d = new Date(`${date}T00:00:00`)
  return `${date.slice(5)} ${WEEKDAYS[d.getDay()]}`
}

async function handleConfirm() {
  if (!data.value) return
  try {
    await ElMessageBox.confirm(
      `${monthLabel.value}共 ${data.value.summary.teacherCount} 位老师，课酬合计 ¥${formatYuan(data.value.summary.totalCents)}。确认后金额锁定，之后补点名、反结课都不会再改变这个月的金额。`,
      '确认本月课酬',
      { confirmButtonText: '确认并锁定', cancelButtonText: '再看看', type: 'warning' },
    )
  } catch {
    return
  }
  acting.value = true
  try {
    const res = await teacherPayApi.confirm(month.value)
    data.value = res.data
    ElMessage.success('已确认，本月课酬已锁定')
  } catch (err: any) {
    ElMessage.error(err?.message || '确认失败，请稍后重试')
  } finally {
    acting.value = false
  }
}

async function handleReopen() {
  let reason = ''
  try {
    const result = await ElMessageBox.prompt('撤销后按现在的点名记录重新计算，可以再次确认。请写明原因：', '撤销确认', {
      confirmButtonText: '撤销确认',
      cancelButtonText: '取消',
      inputPlaceholder: '如：补录了 10 月 8 日的点名',
      inputValidator: (v: string) => (v && v.trim().length >= 2 ? true : '请填写原因 (至少 2 个字)'),
    })
    reason = (result as { value: string }).value
  } catch {
    return
  }
  acting.value = true
  try {
    const res = await teacherPayApi.reopen(month.value, reason)
    data.value = res.data
    ElMessage.success('已撤销确认')
  } catch (err: any) {
    ElMessage.error(err?.message || '撤销失败，请稍后重试')
  } finally {
    acting.value = false
  }
}

// ---------------- 规则 ----------------
const RULE_FIELDS: Array<{ key: keyof TeacherPayRules; label: string; hint: string }> = [
  { key: 'dailyBase', label: '每天基础工资 (元)', hint: '当天至少上 1 节课才算' },
  { key: 'perLesson', label: '每节课时费 (元)', hint: '每节已点名的正式课' },
  { key: 'perStudent', label: '每到课人次 (元)', hint: '出勤、迟到算到课' },
  { key: 'bonusThreshold', label: '奖励门槛 (人次)', hint: '当天到课人次合计达到这个数' },
  { key: 'bonusAmount', label: '达标奖励 (元)', hint: '每个达标的日子发一次' },
]
const rulesVisible = ref(false)
const savingRules = ref(false)
const rulesForm = reactive<TeacherPayRules>({ dailyBase: 0, perLesson: 0, perStudent: 0, bonusThreshold: 0, bonusAmount: 0 })

function openRules() {
  if (!data.value) return
  Object.assign(rulesForm, data.value.rules)
  rulesVisible.value = true
}

async function saveRules() {
  savingRules.value = true
  try {
    await teacherPayApi.saveRules({ ...rulesForm })
    rulesVisible.value = false
    ElMessage.success('规则已保存，未确认的月份已按新规则重算')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败，请检查填写的数值')
  } finally {
    savingRules.value = false
  }
}

// ---------------- 导出 ----------------
const monthLabel = computed(() => `${month.value.slice(0, 4)} 年 ${Number(month.value.slice(5))} 月`)

function handleExport(kind: 'summary' | 'detail') {
  const d = data.value
  if (!d) return
  const campus = tenantStore.currentCampus?.name || ''
  const statusText = d.status === 'confirmed' ? '已确认' : '未确认'
  const yuan = (c: number) => (c / 100).toFixed(2)
  if (kind === 'summary') {
    downloadCsv<TeacherPayLine>(`老师课酬汇总_${campus}_${d.month}_${statusText}`, [
      { title: '老师', value: (r) => r.teacherName },
      { title: '上课天数', value: (r) => r.teachingDays },
      { title: '课次', value: (r) => r.lessonCount },
      { title: '到课人次', value: (r) => r.attendedCount },
      { title: '达标天数', value: (r) => r.bonusDays },
      { title: '基础工资(元)', value: (r) => yuan(r.baseCents) },
      { title: '课时费(元)', value: (r) => yuan(r.lessonCents) },
      { title: '人次费(元)', value: (r) => yuan(r.studentCents) },
      { title: '奖励(元)', value: (r) => yuan(r.bonusCents) },
      { title: '合计(元)', value: (r) => yuan(r.totalCents) },
    ], d.lines)
    return
  }
  type DetailRow = { teacher: string; date: string; time: string; className: string; attended: number; dayTotal: string }
  const rows: DetailRow[] = []
  for (const line of d.lines) {
    for (const day of line.days) {
      day.lessons.forEach((l, i) => {
        rows.push({
          teacher: line.teacherName,
          date: day.date,
          time: `${l.startTime}-${l.endTime}`,
          className: l.className,
          attended: l.attendedCount,
          // 当天合计只写在当天第一节课这一行，方便求和
          dayTotal: i === 0 ? yuan(day.totalCents) : '',
        })
      })
    }
  }
  downloadCsv<DetailRow>(`老师课酬明细_${campus}_${d.month}_${statusText}`, [
    { title: '老师', value: (r) => r.teacher },
    { title: '日期', value: (r) => r.date },
    { title: '时间', value: (r) => r.time },
    { title: '班级', value: (r) => r.className },
    { title: '到课人数', value: (r) => r.attended },
    { title: '当天课酬(元)', value: (r) => r.dayTotal },
  ], rows)
}

onMounted(load)
</script>

<style scoped>
.panel-card {
  padding: 16px 20px;
  background: var(--st-color-card);
  border: 1px solid var(--st-color-border);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-card);
}
.summary-card {
  padding: 14px 16px;
  background: var(--st-color-card);
  border: 1px solid var(--st-color-border);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-card);
}
.day-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
}
</style>
