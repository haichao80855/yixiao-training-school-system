<template>
  <aside
    :class="[
      'app-sidebar bg-white border-r border-st-border flex flex-col justify-between transition-[width] duration-200 select-none z-20 shrink-0 h-[calc(100vh-60px)]',
      collapsed ? 'w-[64px]' : 'w-[220px]'
    ]"
  >
    <!-- 菜单滚动区 -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden py-3 no-scrollbar">
      <el-menu
        :default-active="activePath"
        :collapse="collapsed"
        :collapse-transition="false"
        class="app-menu border-none w-full !border-r-0"
        router
        unique-opened
      >
        <!-- 控制台首页 -->
        <el-menu-item index="/dashboard">
          <el-icon><Monitor /></el-icon>
          <template #title>
            <span>控制台总览</span>
          </template>
        </el-menu-item>

        <!-- 1. 教研中心 -->
        <el-sub-menu index="/curriculum">
          <template #title>
            <el-icon><Reading /></el-icon>
            <span>教研中心</span>
          </template>
          <el-menu-item index="/curriculum/courseManage">
            课程研发管理
          </el-menu-item>
          <el-menu-item index="/curriculum/subject">
            科目体系设置
          </el-menu-item>
          <el-menu-item index="/curriculum/lessonPlan">
            课次进度大纲
          </el-menu-item>
          <el-menu-item index="/curriculum/platformCourse">
            资源平台课程库
          </el-menu-item>
        </el-sub-menu>

        <!-- 2. 学员中心 -->
        <el-sub-menu index="/studentCenter">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>学员中心</span>
          </template>
          <el-menu-item index="/studentCenter/allStudent">
            全部学员全景
          </el-menu-item>
          <el-menu-item index="/studentCenter/unassigned">
            待分班学员池
          </el-menu-item>
          <el-menu-item index="/studentCenter/serviceFee">
            服务费代报考
          </el-menu-item>
        </el-sub-menu>

        <!-- 3. 教务中心 -->
        <el-sub-menu index="/educational">
          <template #title>
            <el-icon><Calendar /></el-icon>
            <span>教务中心</span>
          </template>
          <el-menu-item index="/educational/workbench">
            教学讲台
          </el-menu-item>
          <el-menu-item index="/educational/timeSchedule">
            排课课表
          </el-menu-item>
          <el-menu-item index="/educational/classManagement">
            班级与班容
          </el-menu-item>
          <el-menu-item index="/educational/attendance">
            授课点名消课
          </el-menu-item>
        </el-sub-menu>

        <!-- 4. 财务中心 -->
        <el-sub-menu index="/financial">
          <template #title>
            <el-icon><Money /></el-icon>
            <span>财务中心</span>
          </template>
          <el-menu-item index="/financial/orderManagement">
            订单营收流水
          </el-menu-item>
          <el-menu-item index="/financial/chargingLedger">
            收费流水账本
          </el-menu-item>
          <el-menu-item index="/financial/approvalFlow">
            业务审批工作台
          </el-menu-item>
        </el-sub-menu>

        <!-- 5. 系统设置 -->
        <el-sub-menu index="/systemSetting">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </template>
          <el-menu-item index="/systemSetting/authoritiesInfo">
            组织架构与机构
          </el-menu-item>
          <el-menu-item index="/systemSetting/roleManagement">
            角色与权限
          </el-menu-item>
          <el-menu-item index="/systemSetting/dictSetting">
            业务参数字典
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>

    <!-- 侧边栏底部固定校区提示 -->
    <div class="p-2 border-t border-st-border">
      <button
        type="button"
        @click="openCampusModal"
        :class="[
          'w-full rounded-lg hover:bg-slate-50 transition-colors flex items-center text-left',
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
        ]"
        :title="`当前校区：${currentCampus.name}（点击切换）`"
      >
        <span class="w-8 h-8 rounded-lg bg-st-primary-light text-st-primary flex items-center justify-center shrink-0">
          <el-icon :size="16"><Location /></el-icon>
        </span>
        <span v-if="!collapsed" class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-st-title truncate">{{ currentCampus.name }}</span>
          <span class="block text-xs text-st-muted truncate">{{ currentCampus.code }}</span>
        </span>
        <el-icon v-if="!collapsed" class="text-st-placeholder shrink-0"><Switch /></el-icon>
      </button>
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
  Location,
  Switch
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
.app-menu {
  --el-menu-item-height: 40px;
  --el-menu-sub-item-height: 38px;
  --el-menu-item-font-size: 14px;
  --el-menu-text-color: var(--st-color-secondary);
  --el-menu-hover-text-color: var(--st-color-title);
  --el-menu-hover-bg-color: #F1F5F9;
  --el-menu-active-color: var(--st-color-primary);
  --el-menu-base-level-padding: 14px;
  --el-menu-level-padding: 16px;
  --el-menu-icon-width: 20px;
  padding: 0 8px;
}

/* 一级菜单与子菜单标题：圆角胶囊行 */
:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  border-radius: 8px;
  margin: 2px 0;
  font-weight: 500;
}
:deep(.el-menu-item .el-icon),
:deep(.el-sub-menu__title .el-icon) {
  color: var(--st-color-muted);
  font-size: 17px;
}

/* 二级菜单项：缩进对齐图标后的文字，字号略小 */
:deep(.el-menu--inline) {
  padding: 2px 0 4px;
}
:deep(.el-menu--inline .el-menu-item) {
  padding-left: 46px !important;
  font-size: 13px;
  font-weight: 400;
  height: 38px;
  line-height: 38px;
}

/* 选中态：浅品牌底 + 品牌色文字，无硬边框 */
:deep(.el-menu-item.is-active) {
  background-color: var(--st-color-primary-light);
  color: var(--st-color-primary);
  font-weight: 600;
}
:deep(.el-menu-item.is-active .el-icon) {
  color: var(--st-color-primary);
}
:deep(.el-sub-menu.is-active > .el-sub-menu__title),
:deep(.el-sub-menu.is-active > .el-sub-menu__title .el-icon) {
  color: var(--st-color-title);
}

/* 折叠态：图标居中 */
:deep(.el-menu--collapse) {
  width: 100%;
}
:deep(.el-menu--collapse .el-menu-item),
:deep(.el-menu--collapse .el-sub-menu__title) {
  justify-content: center;
  padding: 0 !important;
}
</style>
