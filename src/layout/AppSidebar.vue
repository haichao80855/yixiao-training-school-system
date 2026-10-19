<template>
  <aside
    :class="[
      'bg-white border-r border-st-border flex flex-col justify-between transition-all duration-300 select-none z-20 shrink-0 h-[calc(100vh-60px)]',
      collapsed ? 'w-[64px]' : 'w-[220px]'
    ]"
  >
    <!-- 菜单滚动区 -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden py-3">
      <el-menu
        :default-active="activePath"
        :collapse="collapsed"
        :collapse-transition="false"
        class="border-none w-full !border-r-0"
        router
        unique-opened
      >
        <!-- 控制台首页 -->
        <el-menu-item index="/dashboard" class="!h-11">
          <el-icon><Monitor /></el-icon>
          <template #title>
            <span class="font-medium text-xs">控制台总览</span>
          </template>
        </el-menu-item>

        <!-- 1. 教研中心 -->
        <el-sub-menu index="/curriculum">
          <template #title>
            <el-icon><Reading /></el-icon>
            <span class="font-medium text-xs">教研中心</span>
          </template>
          <el-menu-item index="/curriculum/courseManage" class="!h-10 !pl-10 !text-xs">
            课程研发管理
          </el-menu-item>
          <el-menu-item index="/curriculum/subject" class="!h-10 !pl-10 !text-xs">
            科目体系设置
          </el-menu-item>
          <el-menu-item index="/curriculum/lessonPlan" class="!h-10 !pl-10 !text-xs">
            课次进度大纲
          </el-menu-item>
          <el-menu-item index="/curriculum/platformCourse" class="!h-10 !pl-10 !text-xs">
            资源平台课程库
          </el-menu-item>
        </el-sub-menu>

        <!-- 2. 学员中心 -->
        <el-sub-menu index="/studentCenter">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span class="font-medium text-xs">学员中心</span>
          </template>
          <el-menu-item index="/studentCenter/allStudent" class="!h-10 !pl-10 !text-xs">
            全部学员全景
          </el-menu-item>
          <el-menu-item index="/studentCenter/unassigned" class="!h-10 !pl-10 !text-xs">
            待分班学员池
          </el-menu-item>
          <el-menu-item index="/studentCenter/serviceFee" class="!h-10 !pl-10 !text-xs">
            服务费代报考
          </el-menu-item>
        </el-sub-menu>

        <!-- 3. 教务中心 -->
        <el-sub-menu index="/educational">
          <template #title>
            <el-icon><Calendar /></el-icon>
            <span class="font-medium text-xs">教务中心</span>
          </template>
          <el-menu-item index="/educational/workbench" class="!h-10 !pl-10 !text-xs font-semibold text-st-primary">
            教学讲台
          </el-menu-item>
          <el-menu-item index="/educational/timeSchedule" class="!h-10 !pl-10 !text-xs">
            7×15 排课网格
          </el-menu-item>
          <el-menu-item index="/educational/classManagement" class="!h-10 !pl-10 !text-xs">
            班级与班容
          </el-menu-item>
          <el-menu-item index="/educational/attendance" class="!h-10 !pl-10 !text-xs">
            授课点名消课
          </el-menu-item>
        </el-sub-menu>

        <!-- 4. 财务中心 -->
        <el-sub-menu index="/financial">
          <template #title>
            <el-icon><Money /></el-icon>
            <span class="font-medium text-xs">财务中心</span>
          </template>
          <el-menu-item index="/financial/orderManagement" class="!h-10 !pl-10 !text-xs">
            订单营收流水
          </el-menu-item>
          <el-menu-item index="/financial/chargingLedger" class="!h-10 !pl-10 !text-xs">
            收费流水账本
          </el-menu-item>
          <el-menu-item index="/financial/approvalFlow" class="!h-10 !pl-10 !text-xs">
            业务审批工作台
          </el-menu-item>
        </el-sub-menu>

        <!-- 5. 系统设置 -->
        <el-sub-menu index="/systemSetting">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span class="font-medium text-xs">系统设置</span>
          </template>
          <el-menu-item index="/systemSetting/authoritiesInfo" class="!h-10 !pl-10 !text-xs">
            组织架构与机构
          </el-menu-item>
          <el-menu-item index="/systemSetting/roleManagement" class="!h-10 !pl-10 !text-xs">
            4级RBAC角色
          </el-menu-item>
          <el-menu-item index="/systemSetting/dictSetting" class="!h-10 !pl-10 !text-xs">
            业务参数字典
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>

    <!-- 侧边栏底部固定校区提示 -->
    <div
      @click="openCampusModal"
      :class="[
        'p-3 border-t border-st-border bg-slate-50/80 hover:bg-st-primary-light/50 transition-colors cursor-pointer flex items-center',
        collapsed ? 'justify-center' : 'justify-between'
      ]"
      :title="`当前归属：${currentCampus.name} (点击可快速切换校区)`"
    >
      <div v-if="!collapsed" class="flex items-center space-x-2 overflow-hidden">
        <el-icon class="text-amber-500 shrink-0 text-base"><Location /></el-icon>
        <div class="truncate">
          <div class="text-[11px] font-semibold text-st-title truncate">
            {{ currentCampus.name }}
          </div>
          <div class="text-[10px] text-st-muted font-mono truncate">
            {{ currentCampus.code }} · 数据已隔离
          </div>
        </div>
      </div>
      <div v-else class="text-base text-amber-500 flex items-center justify-center">
        <el-icon><Location /></el-icon>
      </div>

      <span v-if="!collapsed" class="text-[10px] text-st-primary font-medium shrink-0 ml-1">
        切换
      </span>
    </div>

    <!-- 挂载隐形校区切换触发器 -->
    <CampusSelector ref="campusSelectorRef" class="hidden" />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Monitor,
  Reading,
  UserFilled,
  Calendar,
  Money,
  Setting,
  Location
} from '@element-plus/icons-vue'
import { useTenantStore } from '@/stores/tenantStore'
import CampusSelector from './CampusSelector.vue'

defineProps<{
  collapsed: boolean
}>()

const route = useRoute()
const tenantStore = useTenantStore()
const currentCampus = computed(() => tenantStore.currentCampus)

const activePath = computed(() => route.path)

const campusSelectorRef = ref<{ dialogVisible: boolean; open?: () => void } | null>(null)

function openCampusModal() {
  if (campusSelectorRef.value) {
    if (typeof campusSelectorRef.value.open === 'function') {
      campusSelectorRef.value.open()
    } else {
      campusSelectorRef.value.dialogVisible = true
    }
  }
}
</script>

<style scoped>
:deep(.el-menu-item.is-active) {
  background-color: var(--st-color-border-light, #ECF5FF) !important;
  color: var(--st-color-primary, #1890FF) !important;
  font-weight: 600;
  border-right: 3px solid var(--st-color-primary, #1890FF);
}

:deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--st-color-primary, #1890FF) !important;
  font-weight: 600;
}
</style>
