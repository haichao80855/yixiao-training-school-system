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

        <!-- 各业务中心：只显示当前账号有权限打开的页面，整组都没有权限时整组隐藏 -->
        <el-sub-menu v-for="group in visibleGroups" :key="group.index" :index="group.index">
          <template #title>
            <el-icon><component :is="group.icon" /></el-icon>
            <span>{{ group.title }}</span>
          </template>
          <el-menu-item v-for="item in group.items" :key="item.path" :index="item.path">
            {{ item.title }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>

    <!-- 侧边栏底部固定校区提示 -->
    <div class="p-2 border-t border-st-border">
      <button
        type="button"
        :disabled="!tenantStore.canSwitchCampus"
        @click="openCampusModal"
        :class="[
          'w-full rounded-lg transition-colors flex items-center text-left',
          tenantStore.canSwitchCampus ? 'hover:bg-st-header' : 'cursor-default',
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
        ]"
        :title="tenantStore.canSwitchCampus ? `当前校区：${currentCampus.name}（点击切换）` : `当前校区：${currentCampus.name}`"
      >
        <span class="w-8 h-8 rounded-lg bg-st-primary-light text-st-primary flex items-center justify-center shrink-0">
          <el-icon :size="16"><Location /></el-icon>
        </span>
        <span v-if="!collapsed" class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-st-title truncate">{{ currentCampus.name }}</span>
          <span class="block text-xs text-st-muted truncate">{{ currentCampus.code }}</span>
        </span>
        <el-icon v-if="!collapsed && tenantStore.canSwitchCampus" class="text-st-placeholder shrink-0"><Switch /></el-icon>
      </button>
    </div>

    <!-- 挂载隐形校区切换触发器 -->
    <CampusSelector ref="campusSelectorRef" class="hidden" />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { Monitor, BookOpen as Reading, Users as UserFilled, Calendar, Wallet as Money, Settings as Setting, MapPin as Location, ArrowLeftRight as Switch } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { canAccessRoute } from '@/router/access'
import { useTenantStore } from '@/stores/tenantStore'
import CampusSelector from './CampusSelector.vue'

defineProps<{
  collapsed: boolean
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

interface MenuGroup {
  index: string
  title: string
  icon: Component
  items: { path: string; title: string }[]
}

const MENU_GROUPS: MenuGroup[] = [
  {
    index: '/curriculum',
    title: '教研中心',
    icon: Reading,
    items: [
      { path: '/curriculum/courseManage', title: '课程研发管理' },
      { path: '/curriculum/subject', title: '科目体系设置' },
      { path: '/curriculum/lessonPlan', title: '课次进度大纲' },
      { path: '/curriculum/platformCourse', title: '资源平台课程库' },
    ],
  },
  {
    index: '/studentCenter',
    title: '学员中心',
    icon: UserFilled,
    items: [
      { path: '/studentCenter/allStudent', title: '全部学员全景' },
      { path: '/studentCenter/unassigned', title: '待分班学员池' },
      { path: '/studentCenter/serviceFee', title: '服务费代报考' },
    ],
  },
  {
    index: '/educational',
    title: '教务中心',
    icon: Calendar,
    items: [
      { path: '/educational/workbench', title: '教学讲台' },
      { path: '/educational/timeSchedule', title: '排课课表' },
      { path: '/educational/classManagement', title: '班级与班容' },
      { path: '/educational/attendance', title: '授课点名消课' },
    ],
  },
  {
    index: '/financial',
    title: '财务中心',
    icon: Money,
    items: [
      { path: '/financial/orderManagement', title: '订单营收流水' },
      { path: '/financial/chargingLedger', title: '收费流水账本' },
      { path: '/financial/approvalFlow', title: '业务审批工作台' },
      { path: '/financial/teacherPay', title: '老师课酬' },
    ],
  },
  {
    index: '/systemSetting',
    title: '系统设置',
    icon: Setting,
    items: [
      { path: '/systemSetting/authoritiesInfo', title: '组织架构与机构' },
      { path: '/systemSetting/roleManagement', title: '角色与权限' },
      { path: '/systemSetting/dictSetting', title: '业务参数字典' },
    ],
  },
]

/** 页面所需权限写在路由 meta.requiresPermission 上，菜单和路由守卫用同一份 */
function canOpen(path: string): boolean {
  return canAccessRoute(router.resolve(path), authStore)
}

const visibleGroups = computed(() =>
  MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canOpen(item.path)) })).filter(
    (group) => group.items.length > 0,
  ),
)
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
  --el-menu-hover-bg-color: var(--st-color-fill);
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
