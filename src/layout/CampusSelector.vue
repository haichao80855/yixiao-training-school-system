<template>
  <div>
    <!-- 顶部或侧边栏触发按钮 -->
    <div
      @click="dialogVisible = true"
      class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm select-none"
      :class="customClass"
    >
      <MapPin class="w-3.5 h-3.5 text-amber-300" />
      <span>当前所在</span>
      <span class="text-blue-200 underline underline-offset-2">[切换]</span>
      <span class="font-bold text-white">{{ currentCampus.name }}</span>
      <span v-if="currentCampus.isHeadquarter" class="text-[10px] bg-amber-400 text-slate-900 px-1 rounded font-semibold ml-1">
        总部
      </span>
    </div>

    <!-- 校区切换弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="选择当前工作校区 (多校区数据隔离)"
      width="460px"
      append-to-body
      destroy-on-close
    >
      <div class="space-y-3">
        <p class="text-xs text-st-secondary">
          切换校区将实时重载系统所有模块（教研课程授权、学员档案、7x15 排课看板、财务营收流水）的数据作用域。
        </p>

        <div class="divide-y divide-gray-100 border border-st-border rounded-lg overflow-hidden">
          <div
            v-for="campus in campuses"
            :key="campus.id"
            @click="selectCampus(campus.id)"
            :class="[
              'p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs',
              campus.id === currentCampus.id
                ? 'bg-st-primary-light text-st-primary font-bold border-l-4 border-st-primary'
                : 'hover:bg-gray-50 text-st-regular'
            ]"
          >
            <div class="space-y-0.5">
              <div class="flex items-center space-x-2">
                <span class="text-sm font-semibold">{{ campus.name }}</span>
                <span class="font-mono text-[11px] text-st-muted">({{ campus.code }})</span>
                <el-tag v-if="campus.isHeadquarter" size="small" type="warning" effect="dark">
                  集团总部
                </el-tag>
              </div>
              <div class="text-[11px] text-st-secondary">
                {{ campus.address }}
              </div>
            </div>

            <div v-if="campus.id === currentCampus.id" class="text-st-primary font-bold flex items-center space-x-1">
              <Check class="w-3.5 h-3.5" />
              <span>当前激活</span>
            </div>
            <div v-else class="text-xs text-st-muted">
              点击切换
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center text-xs text-st-muted">
          <span>当前法人实体：{{ tenantStore.companyName }}</span>
          <el-button size="small" @click="dialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { MapPin, Check } from 'lucide-vue-next'
import { useTenantStore } from '@/stores/tenantStore'

defineProps<{
  customClass?: string
}>()

const tenantStore = useTenantStore()
const dialogVisible = ref(false)

const campuses = computed(() => tenantStore.campuses)
const currentCampus = computed(() => tenantStore.currentCampus)

function selectCampus(campusId: string) {
  if (campusId === currentCampus.value.id) {
    dialogVisible.value = false
    return
  }
  tenantStore.setCampus(campusId)
  dialogVisible.value = false
  ElMessage.success({
    message: `已成功切换至【${tenantStore.currentCampus.name}】，全系统数据已实时按校区隔离重载！`,
    duration: 3000
  })
}

defineExpose({
  dialogVisible,
  open: () => {
    dialogVisible.value = true
  }
})
</script>
