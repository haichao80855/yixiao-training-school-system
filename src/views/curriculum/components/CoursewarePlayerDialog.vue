<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="92%"
    top="3vh"
    destroy-on-close
    class="courseware-player-dialog !rounded-xl overflow-hidden"
    :before-close="handleClose"
  >
    <div class="flex flex-col h-[82vh] bg-slate-950 rounded-lg overflow-hidden relative">
      <!-- 顶部控制条 -->
      <div class="h-12 bg-slate-900 px-4 flex items-center justify-between border-b border-gray-800 text-white z-10">
        <div class="flex items-center space-x-3">
          <span class="px-2 py-0.5 rounded bg-st-primary text-xs font-bold">盛通白板课件</span>
          <span
            v-if="viewSource === 'mirror'"
            class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/40 text-xs"
            title="原平台当前无法访问，正在使用本校备份的课件文件"
          >
            备份课件
          </span>
          <span class="text-sm font-semibold truncate max-w-[450px]" :title="lessonName">
            {{ lessonName }}
          </span>
          <span v-if="pptFileName" class="text-xs text-st-placeholder hidden sm:inline truncate max-w-[260px]">
            ({{ pptFileName }})
          </span>
        </div>

        <div class="flex items-center space-x-3">
          <el-button
            v-if="downloadUrl"
            size="small"
            type="info"
            link
            class="!text-xs !text-st-placeholder hover:!text-white"
            @click="handleDownload"
          >
            <el-icon class="mr-1"><Download /></el-icon> 下载课件
          </el-button>

          <el-button
            type="primary"
            class="!text-xs"
            @click="toggleFullscreen"
          >
            <el-icon class="mr-1"><FullScreen /></el-icon> {{ isFullscreen ? '退出全屏' : '全屏授课' }}
          </el-button>
        </div>
      </div>

      <!-- 课件主展示区域 -->
      <div ref="containerRef" class="flex-1 w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
        <div v-if="resolving" class="text-sm text-st-placeholder">正在打开课件...</div>

        <!-- 在线白板 / 备份课件预览 -->
        <iframe
          v-else-if="frameUrl"
          :src="frameUrl"
          class="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media"
          allowfullscreen
        ></iframe>

        <!-- 兜底状态 -->
        <div v-else class="text-center p-8 text-st-placeholder space-y-4">
          <el-icon class="text-5xl text-st-secondary"><Document /></el-icon>
          <p class="text-base">{{ viewMessage || '该课次暂未生成在线白板交互课件或正在转码中' }}</p>
          <el-button v-if="downloadUrl && viewSource !== 'unavailable'" type="primary" @click="handleDownload">
            下载课件源文件
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, Maximize as FullScreen, FileText as Document } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { coursewareSourceApi } from '@/api/modules/coursewareSource'

const visible = ref(false)
const lessonName = ref('')
const pptFileName = ref('')
const pptUrl = ref('')
const downloadUrl = ref('')
const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

/** 实际嵌入的地址：平时是百家云白板；原平台不可用时由后端换成备份课件的预览地址 */
const frameUrl = ref('')
const viewSource = ref<'origin' | 'mirror' | 'unavailable'>('origin')
const viewMessage = ref('')
const resolving = ref(false)
let openSeq = 0

const title = computed(() => `随堂授课互动白板 - ${lessonName.value}`)

async function open(lesson: { sessionName: string; pptUrl?: string; pptFileName?: string; downloadUrl?: string }) {
  lessonName.value = lesson.sessionName || '课件详情'
  pptUrl.value = lesson.pptUrl || ''
  pptFileName.value = lesson.pptFileName || ''
  downloadUrl.value = lesson.downloadUrl || ''
  frameUrl.value = ''
  viewSource.value = 'origin'
  viewMessage.value = ''
  visible.value = true

  if (!pptUrl.value && !downloadUrl.value) return
  const seq = ++openSeq
  resolving.value = true
  try {
    const r = await coursewareSourceApi.resolve({
      purpose: 'preview',
      pptUrl: pptUrl.value,
      downloadUrl: downloadUrl.value,
      filename: pptFileName.value,
    })
    if (seq !== openSeq) return
    viewSource.value = r.source
    viewMessage.value = r.message || ''
    frameUrl.value = r.viewer === 'iframe' || r.viewer === 'office' ? r.url : ''
  } catch {
    // 后端不可用时保持原来的行为：直接嵌入百家云白板
    if (seq !== openSeq) return
    frameUrl.value = pptUrl.value
  } finally {
    if (seq === openSeq) resolving.value = false
  }
}

function handleClose(done: () => void) {
  openSeq++
  frameUrl.value = ''
  pptUrl.value = ''
  resolving.value = false
  done()
}

async function handleDownload() {
  if (!downloadUrl.value) return
  // 先同步打开空白窗口，等后端返回后再跳转，避免被浏览器当作弹窗拦截
  const win = window.open('', '_blank')
  let target = downloadUrl.value
  try {
    const r = await coursewareSourceApi.resolve({
      purpose: 'download',
      downloadUrl: downloadUrl.value,
      filename: pptFileName.value,
    })
    if (r.source === 'unavailable') {
      win?.close()
      await ElMessageBox.confirm(`${r.message || '课件当前无法下载'}。仍要尝试打开原链接吗？`, '课件不可用', {
        confirmButtonText: '尝试原链接',
        cancelButtonText: '取消',
        type: 'warning',
      })
        .then(() => window.open(r.url || downloadUrl.value, '_blank', 'noopener'))
        .catch(() => {})
      return
    }
    target = r.url
    if (r.source === 'mirror') ElMessage.info('原平台当前无法访问，正在从本校备份下载')
  } catch {
    // 后端不可用：退回原链接
  }
  if (win) {
    win.opener = null
    win.location.href = target
  } else {
    window.open(target, '_blank', 'noopener')
  }
}

function toggleFullscreen() {
  if (!containerRef.value) return
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen().catch(() => {})
    isFullscreen.value = true
  } else {
    document.exitFullscreen().catch(() => {})
    isFullscreen.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
:deep(.el-dialog__body) {
  padding: 0 !important;
}
:deep(.el-dialog__header) {
  margin-bottom: 0 !important;
  padding: 12px 16px !important;
}
</style>
