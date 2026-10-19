<template>
  <el-dialog
    v-model="visible"
    title="上传课堂实录与回放视频"
    :width="DIALOG_SIZE.md"
    destroy-on-close
  >
    <div v-if="lesson" class="space-y-4 text-xs">
      <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div class="font-bold text-st-title">{{ lesson.lessonTitle || lesson.className }}</div>
        <div class="text-st-muted mt-1">上课时间: {{ lesson.date }} {{ lesson.startTime }}-{{ lesson.endTime }}</div>
      </div>

      <el-form label-position="top">
        <el-form-item label="视频来源类型">
          <el-radio-group v-model="sourceType">
            <el-radio-button label="url">云端直链 / 直播录播回放</el-radio-button>
            <el-radio-button label="upload">本地视频上传 (MP4)</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="sourceType === 'url'" label="视频播放 URL">
          <el-input v-model="playbackUrl" placeholder="请输入 mp4 或 m3u8 回放视频地址" clearable />
        </el-form-item>

        <el-form-item v-else label="上传视频文件">
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-st-primary cursor-pointer w-full" @click="handleSimulateUpload">
            <Video class="w-8 h-8 mx-auto text-st-primary/70" />
            <div class="text-st-primary font-medium mt-1">点击选择本地教学实录视频</div>
            <div class="text-st-muted text-[11px] mt-0.5">支持 MP4、MOV 格式，最大不超过 500MB</div>
          </div>
        </el-form-item>
      </el-form>

      <div v-if="playbackUrl" class="border rounded-lg p-2.5 bg-blue-50/50 border-blue-200">
        <div class="font-semibold text-blue-900 flex items-center justify-between">
          <span>在线预览与流媒体校验</span>
          <span class="text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 class="w-3.5 h-3.5" />
            格式支持良好
          </span>
        </div>
        <div class="text-[11px] text-blue-700 font-mono mt-1 break-all">
          {{ playbackUrl }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">确认保存回放</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Video, CheckCircle2 } from 'lucide-vue-next'
import { DIALOG_SIZE } from '@/constants/ui'
import type { WorkbenchLessonCard } from '@/types/educational'

const visible = ref(false)
const lesson = ref<WorkbenchLessonCard | null>(null)
const sourceType = ref('url')
const playbackUrl = ref('')

function open(targetLesson: WorkbenchLessonCard) {
  lesson.value = targetLesson
  playbackUrl.value = targetLesson.playbackUrl || 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/playback/demo.mp4'
  visible.value = true
}

function handleSimulateUpload() {
  playbackUrl.value = 'https://public-test-shengtong.oss-cn-zhangjiakou.aliyuncs.com/playback/classroom_upload_2026.mp4'
  sourceType.value = 'url'
  ElMessage.success('视频模拟上传成功！已自动填入视频流地址。')
}

function handleSave() {
  if (lesson.value) {
    lesson.value.playbackUrl = playbackUrl.value
  }
  ElMessage.success('课堂回放视频已成功绑定，家长端现已可随时在线点播回放！')
  visible.value = false
}

defineExpose({ open })
</script>
