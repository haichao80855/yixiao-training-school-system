<template>
  <div v-if="canView" class="bg-white rounded-lg p-5 shadow-card border border-st-border space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-st-title">课件来源</h2>
        <p class="text-xs text-st-secondary mt-1">
          平时使用盛通和百家云的课件链接；原平台无法访问时，自动改用本校备份的课件文件。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <el-radio-group
          :model-value="status?.mode"
          :disabled="!canEdit || saving || !status"
          @change="(v: string | number | boolean | undefined) => changeMode(v as CoursewareSourceMode)"
        >
          <el-radio-button value="auto">自动切换</el-radio-button>
          <el-radio-button value="origin">固定原平台</el-radio-button>
          <el-radio-button value="mirror">固定备份</el-radio-button>
        </el-radio-group>
        <el-button v-if="canEdit" :loading="probing" :disabled="!status" @click="probe">立即检测</el-button>
      </div>
    </div>

    <div v-if="loadError" class="text-xs text-st-danger">{{ loadError }}</div>
    <div v-else-if="status" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div
        v-for="item in providerRows"
        :key="item.key"
        class="rounded-md border border-st-border p-3 text-xs space-y-1.5"
      >
        <div class="flex items-center justify-between">
          <span class="font-semibold text-st-title">{{ item.name }}</span>
          <el-tag size="small" :type="stateTagType(item.p.state)">{{ stateLabel(item.p.state) }}</el-tag>
        </div>
        <div class="text-st-secondary">
          当前使用：
          <span :class="item.p.effective === 'mirror' ? 'text-st-warning font-semibold' : 'text-st-title'">
            {{ item.p.effective === 'mirror' ? item.mirrorLabel : '原平台链接' }}
          </span>
        </div>
        <div class="text-st-muted">
          最近检测：{{ formatTime(item.p.lastCheckedAt) }}
          <template v-if="item.p.lastRound">
            （成功 {{ item.p.lastRound.ok }} / 失败 {{ item.p.lastRound.fail }}<template v-if="item.p.lastFailures.length">，{{ item.p.lastFailures.slice(0, 3).join('、') }}</template>）
          </template>
        </div>
      </div>
    </div>
    <p v-if="status && !status.probeEnabled" class="text-xs text-st-muted">
      当前环境未开启自动检测（本地开发默认关闭），「自动切换」会一直使用原平台。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import {
  coursewareSourceApi,
  type CoursewareProviderStatus,
  type CoursewareSourceMode,
  type CoursewareSourceStatus,
} from '@/api/modules/coursewareSource'

const authStore = useAuthStore()
const canView = computed(() => authStore.hasPermission('system:view'))
const canEdit = computed(() => authStore.hasPermission('system:company:edit'))

const status = ref<CoursewareSourceStatus | null>(null)
const loadError = ref('')
const saving = ref(false)
const probing = ref(false)

const MODE_LABEL: Record<CoursewareSourceMode, string> = {
  auto: '自动切换',
  origin: '固定原平台',
  mirror: '固定备份',
}

const providerRows = computed(() => {
  if (!status.value) return []
  return [
    { key: 'shengtong', name: '盛通 · 课件下载', mirrorLabel: '本校备份', p: status.value.providers.shengtong },
    {
      key: 'baijiayun',
      name: '百家云 · 在线白板',
      mirrorLabel: status.value.officePreview ? '备份文件在线预览' : '备份文件（需下载查看）',
      p: status.value.providers.baijiayun,
    },
  ] as { key: string; name: string; mirrorLabel: string; p: CoursewareProviderStatus }[]
})

function stateLabel(s: CoursewareProviderStatus['state']) {
  return s === 'up' ? '正常' : s === 'down' ? '无法访问' : '未检测'
}
function stateTagType(s: CoursewareProviderStatus['state']) {
  return s === 'up' ? 'success' : s === 'down' ? 'danger' : 'info'
}
function formatTime(iso: string | null) {
  if (!iso) return '尚未检测'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  try {
    status.value = await coursewareSourceApi.getStatus()
    loadError.value = ''
  } catch (e) {
    loadError.value = `课件来源状态读取失败：${(e as Error).message}`
  }
}

async function changeMode(mode: CoursewareSourceMode) {
  if (!status.value || mode === status.value.mode) return
  try {
    await ElMessageBox.confirm(`确定把课件来源改为「${MODE_LABEL[mode]}」吗？全体老师立即生效。`, '切换课件来源', {
      type: 'warning',
      confirmButtonText: '确定切换',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  saving.value = true
  try {
    status.value = await coursewareSourceApi.setMode(mode)
    ElMessage.success(`课件来源已改为「${MODE_LABEL[mode]}」`)
  } catch (e) {
    ElMessage.error(`切换失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}

async function probe() {
  probing.value = true
  try {
    status.value = await coursewareSourceApi.probeNow()
  } catch (e) {
    ElMessage.error(`检测失败：${(e as Error).message}`)
  } finally {
    probing.value = false
  }
}

onMounted(() => {
  if (canView.value) void load()
})
</script>
