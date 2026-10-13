<template>
  <div class="bg-white rounded-lg p-6 shadow-card border border-st-border space-y-6">
    <div class="border-b border-st-border pb-4">
      <h3 class="text-sm font-bold text-st-title">机构品牌 LOGO 配置</h3>
      <p class="text-xs text-st-muted mt-1">配置一校教培系统各端系统顶栏、移动端App及学员专属纸质评测报告的品牌 LOGO</p>
    </div>

    <div class="space-y-6 max-w-2xl">
      <!-- 上传系统LOGO -->
      <div>
        <label class="block text-xs font-medium text-st-title mb-2">
          <span class="text-rose-500 mr-1">*</span>系统顶栏 LOGO (浅色背景)
        </label>
        <div class="flex items-center space-x-4">
          <div
            @click="triggerMockUpload('logoUrl')"
            class="w-48 h-16 border-2 border-dashed border-st-border rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer overflow-hidden"
          >
            <img v-if="form.logoUrl" :src="form.logoUrl" class="w-full h-full object-contain p-1" alt="Logo" />
            <template v-else>
              <el-icon class="text-xl text-st-muted"><Plus /></el-icon>
              <span class="text-[11px] text-st-muted mt-1">点击上传 LOGO</span>
            </template>
          </div>
          <div class="text-xs text-st-muted leading-relaxed">
            <p>建议上传图片尺寸为 <span class="font-mono text-st-title">200*66</span> 像素，大小不超过 1MB。</p>
            <p>格式限定为 <span class="font-mono text-st-title">png、jpg</span> 格式，建议透明底 PNG 获得最佳展示效果。</p>
          </div>
        </div>
      </div>

      <!-- 小图标 LOGO -->
      <div>
        <label class="block text-xs font-medium text-st-title mb-2">
          浏览器 Favicon 与收起态微图标
        </label>
        <div class="flex items-center space-x-4">
          <div
            @click="triggerMockUpload('faviconUrl')"
            class="w-12 h-12 border-2 border-dashed border-st-border rounded-lg flex items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer overflow-hidden"
          >
            <img v-if="form.faviconUrl" :src="form.faviconUrl" class="w-full h-full object-contain p-1" alt="Favicon" />
            <el-icon v-else class="text-base text-st-muted"><Plus /></el-icon>
          </div>
          <div class="text-xs text-st-muted leading-relaxed">
            <p>建议上传图片尺寸为 <span class="font-mono text-st-title">30*30</span> 像素，大小不超过 1MB，限定 png/jpg 格式。</p>
          </div>
        </div>
      </div>

      <!-- 用户报告LOGO -->
      <div>
        <label class="block text-xs font-medium text-st-title mb-2">
          <span class="text-rose-500 mr-1">*</span>学员测评与学习报告专属 LOGO
        </label>
        <div class="flex items-center space-x-4">
          <div
            @click="triggerMockUpload('reportLogoUrl')"
            class="w-64 h-20 border-2 border-dashed border-st-border rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer overflow-hidden"
          >
            <img v-if="form.reportLogoUrl" :src="form.reportLogoUrl" class="w-full h-full object-contain p-1" alt="Report Logo" />
            <template v-else>
              <el-icon class="text-xl text-st-muted"><Plus /></el-icon>
              <span class="text-[11px] text-st-muted mt-1">点击上传报告抬头 LOGO</span>
            </template>
          </div>
          <div class="text-xs text-st-muted leading-relaxed">
            <p>建议上传图片尺寸为 <span class="font-mono text-st-title">302*94</span> 像素，大小不超过 1MB。</p>
            <p>打印输出至 A4 测评报告抬头，格式限定为 png、jpg 格式。</p>
          </div>
        </div>
      </div>

      <div class="pt-4">
        <el-button type="primary" size="small" :loading="saving" @click="handleSave">保存品牌配置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { CompanyInfo } from '@/types/system'

const props = defineProps<{
  orgMeta?: CompanyInfo
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', payload: { logoUrl: string; faviconUrl: string; reportLogoUrl: string }): void
}>()

const form = reactive({
  logoUrl: '',
  faviconUrl: '',
  reportLogoUrl: '',
})

watch(
  () => props.orgMeta,
  (meta) => {
    if (meta) {
      form.logoUrl = meta.logoUrl || ''
      form.faviconUrl = meta.faviconUrl || ''
      form.reportLogoUrl = meta.reportLogoUrl || ''
    }
  },
  { immediate: true }
)

function triggerMockUpload(field: 'logoUrl' | 'faviconUrl' | 'reportLogoUrl') {
  // 模拟选择预设高质量品牌素材，以便测试真实落库与预览
  const mockImages: Record<string, string> = {
    logoUrl: '/images/brand-logo-light.png',
    faviconUrl: '/favicon.ico',
    reportLogoUrl: '/images/report-header-logo.png',
  }
  form[field] = mockImages[field]
  ElMessage.success(`已载入品牌素材: ${field}`)
}

function handleSave() {
  emit('save', { ...form })
}
</script>
