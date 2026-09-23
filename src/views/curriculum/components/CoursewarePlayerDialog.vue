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
    <div class="flex flex-col h-[82vh] bg-[#0c1021] rounded-lg overflow-hidden relative">
      <!-- 顶部控制条 -->
      <div class="h-12 bg-[#141b34] px-4 flex items-center justify-between border-b border-gray-800 text-white z-10">
        <div class="flex items-center space-x-3">
          <span class="px-2 py-0.5 rounded bg-[#1890FF] text-xs font-bold">盛通白板课件</span>
          <span class="text-sm font-semibold truncate max-w-[450px]" :title="lessonName">
            {{ lessonName }}
          </span>
          <span v-if="pptFileName" class="text-xs text-gray-400 hidden sm:inline truncate max-w-[260px]">
            ({{ pptFileName }})
          </span>
        </div>

        <div class="flex items-center space-x-3">
          <el-button
            v-if="downloadUrl"
            size="small"
            type="info"
            link
            class="!text-xs !text-gray-300 hover:!text-white"
            @click="handleDownload"
          >
            <el-icon class="mr-1"><Download /></el-icon> 下载课件
          </el-button>

          <el-button
            size="small"
            type="primary"
            class="!text-xs"
            @click="toggleFullscreen"
          >
            <el-icon class="mr-1"><FullScreen /></el-icon> {{ isFullscreen ? '退出全屏' : '全屏授课' }}
          </el-button>
        </div>
      </div>

      <!-- 课件主展示区域 -->
      <div ref="containerRef" class="flex-1 w-full h-full relative flex items-center justify-center bg-[#070b18] overflow-hidden">
        <!-- 如果存在原生交互式课件 HTML -->
        <iframe
          v-if="pptUrl"
          :src="pptUrl"
          class="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media"
          allowfullscreen
        ></iframe>

        <!-- 兜底状态 -->
        <div v-else class="text-center p-8 text-gray-400 space-y-4">
          <el-icon class="text-5xl text-gray-600"><Document /></el-icon>
          <p class="text-base">该课次暂未生成在线白板交互课件或正在转码中</p>
          <el-button v-if="downloadUrl" type="primary" size="small" @click="handleDownload">
            下载课件源文件
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, FullScreen, Document } from '@element-plus/icons-vue'

const visible = ref(false)
const lessonName = ref('')
const pptFileName = ref('')
const pptUrl = ref('')
const downloadUrl = ref('')
const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

const title = computed(() => `随堂授课互动白板 - ${lessonName.value}`)

function open(lesson: { sessionName: string; pptUrl?: string; pptFileName?: string; downloadUrl?: string }) {
  lessonName.value = lesson.sessionName || '课件详情'
  pptUrl.value = lesson.pptUrl || ''
  pptFileName.value = lesson.pptFileName || ''
  downloadUrl.value = lesson.downloadUrl || ''
  visible.value = true
}

function handleClose(done: () => void) {
  pptUrl.value = ''
  done()
}

function handleDownload() {
  if (downloadUrl.value) {
    window.open(downloadUrl.value, '_blank')
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
