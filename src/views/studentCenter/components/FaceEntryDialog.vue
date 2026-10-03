<template>
  <el-dialog
    v-model="visible"
    title="人脸识别考勤底库录入"
    width="520px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-if="student" class="space-y-4">
      <div class="p-3 bg-slate-50 border rounded flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-st-title">{{ student.name }}</span>
          <span class="text-st-muted font-mono ml-2">{{ student.studentNo }}</span>
          <div class="text-st-secondary mt-0.5">{{ student.campusName }} - {{ student.grade }}</div>
        </div>
        <el-tag :type="student.faceEntered ? 'success' : 'info'" size="small">
          {{ student.faceEntered ? '已有底库特征' : '尚未录入' }}
        </el-tag>
      </div>

      <!-- 摄像头取景模拟框 -->
      <div class="relative bg-slate-900 rounded-lg overflow-hidden h-64 flex flex-col items-center justify-center text-white border-2 border-slate-700">
        <!-- 取景辅助圆框 -->
        <div class="w-40 h-40 rounded-full border-2 border-dashed border-blue-400 flex items-center justify-center relative">
          <img
            :src="capturedImage || student.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'"
            class="w-36 h-36 rounded-full object-cover"
          />
          <div v-if="scanning" class="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse flex items-center justify-center">
            <span class="text-xs font-bold text-blue-200">特征点提取中...</span>
          </div>
        </div>

        <div class="absolute bottom-3 text-xs text-slate-300">
          {{ scanning ? '正在比对人脸关键点 (128维特征向量)...' : '请正对摄像头，保持光线充足与面部无遮挡' }}
        </div>
      </div>

      <!-- 扫描提取进度条 -->
      <div v-if="scanning || progress > 0" class="space-y-1">
        <div class="flex justify-between text-xs text-st-secondary">
          <span>AI 人脸模型建模进度</span>
          <span class="font-mono font-bold text-st-primary">{{ progress }}%</span>
        </div>
        <el-progress :percentage="progress" :status="progress === 100 ? 'success' : ''" :stroke-width="6" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center">
        <el-button size="small" @click="handleReset">重新抓拍</el-button>
        <div class="space-x-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="scanning" @click="handleCapture">
            {{ progress === 100 ? '保存并更新底库' : '模拟拍照与提取' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Student } from '@/types/student'
import { studentApi } from '@/api'
import { updateStudent } from '@/mocks'

const props = defineProps<{
  modelValue: boolean
  student: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const scanning = ref(false)
const progress = ref(0)
const capturedImage = ref('')

function handleCapture() {
  if (progress.value === 100) {
    if (props.student) {
      const faceUrl = capturedImage.value || props.student.avatar || ''
      try {
        studentApi.updateStudent(props.student.id, {
          avatar: faceUrl
        })
      } catch {
        // dual-track
      }
      updateStudent(props.student.id, {
        faceEntered: true,
        faceImageUrl: faceUrl
      })
      ElMessage.success('学员人脸底库已成功录入并同步至校区考勤闸机！')
      emit('success')
      visible.value = false
    }
    return
  }

  scanning.value = true
  progress.value = 10
  capturedImage.value = props.student?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'

  const timer = setInterval(() => {
    progress.value += 30
    if (progress.value >= 100) {
      progress.value = 100
      scanning.value = false
      clearInterval(timer)
      ElMessage.success('人脸特征提取完毕！点击保存即可生效。')
    }
  }, 300)
}

function handleReset() {
  progress.value = 0
  scanning.value = false
  capturedImage.value = ''
}
</script>
