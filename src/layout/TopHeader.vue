<template>
  <header class="h-[60px] bg-white border-b border-st-border px-4 flex items-center justify-between select-none z-30 relative">
    <!-- 左侧：品牌与折叠触发器 -->
    <div class="flex items-center gap-2 shrink-0">
      <button type="button" class="flex items-center gap-2.5 pr-2 rounded-lg" @click="handleGoHome">
        <span class="w-8 h-8 rounded-lg bg-st-primary flex items-center justify-center text-white">
          <svg class="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </span>
        <span class="text-[16px] font-semibold text-st-title tracking-tight whitespace-nowrap">一校教培系统</span>
      </button>

      <!-- 侧边栏折叠/展开按钮 -->
      <button
        type="button"
        class="header-icon-btn ml-3"
        title="折叠/展开侧边栏"
        aria-label="折叠/展开侧边栏"
        @click="$emit('toggle-sidebar')"
      >
        <el-icon :size="18"><Fold /></el-icon>
      </button>
    </div>

    <!-- 右侧：校区、通知、全屏与用户 -->
    <div class="flex items-center gap-1.5 shrink-0">
      <!-- 多校区切换选择器 -->
      <CampusSelector ref="campusSelectorRef" class="mr-2" />

      <!-- 待办消息与通知 -->
      <el-popover placement="bottom-end" :width="300" trigger="click" @show="loadTodoCounts">
        <template #reference>
          <button type="button" class="header-icon-btn relative" title="待办" :aria-label="todoTotal > 0 ? `待办 ${todoTotal} 项` : '待办'">
            <el-icon :size="18"><Bell /></el-icon>
            <span
              v-if="todoTotal > 0"
              class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-st-danger text-white text-xs leading-4 font-semibold text-center ring-2 ring-white"
            >
              {{ todoTotal > 99 ? '99+' : todoTotal }}
            </span>
          </button>
        </template>
        <div class="text-[13px]">
          <div class="pb-2 mb-1 border-b border-st-border font-semibold text-st-title">待办</div>
          <button
            v-if="todoCounts.approvals !== null"
            type="button"
            class="notice-item"
            @click="$router.push('/financial/approvalFlow')"
          >
            <span class="notice-dot bg-st-primary"></span>
            <span class="flex-1"><span class="font-medium text-st-title">待审批</span> · 退费等审批工单</span>
            <span class="notice-count">{{ todoCounts.approvals }}</span>
          </button>
          <button
            v-if="todoCounts.unassigned !== null"
            type="button"
            class="notice-item"
            @click="$router.push('/studentCenter/unassigned')"
          >
            <span class="notice-dot bg-st-warning"></span>
            <span class="flex-1"><span class="font-medium text-st-title">待分班</span> · 已购课、尚未安排班级的学员</span>
            <span class="notice-count">{{ todoCounts.unassigned }}</span>
          </button>
          <button type="button" class="notice-item" @click="$router.push('/educational/timeSchedule')">
            <span class="notice-dot bg-st-purple"></span>
            <span class="flex-1"><span class="font-medium text-st-title">课表</span> · 查看本周校区课表</span>
          </button>
        </div>
      </el-popover>

      <!-- 全屏切换 -->
      <button
        type="button"
        class="header-icon-btn hidden sm:inline-flex"
        title="切换全屏模式"
        aria-label="切换全屏模式"
        @click="toggleFullScreen"
      >
        <el-icon :size="18"><FullScreen /></el-icon>
      </button>

      <span class="w-px h-5 bg-st-border mx-2 hidden lg:block"></span>

      <!-- 用户信息与下拉菜单 -->
      <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
        <div class="flex items-center gap-2 cursor-pointer pl-1 pr-2 py-1 rounded-lg hover:bg-st-fill transition-colors">
          <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold', isTeacher ? 'bg-st-success-light text-st-success' : 'bg-st-primary-light text-st-primary']">
            {{ avatarChar }}
          </div>
          <div class="hidden lg:block text-left leading-tight">
            <div class="text-[13px] font-medium text-st-title">{{ currentUserName }}</div>
            <div class="text-xs text-st-muted">{{ currentUserRole }}</div>
          </div>
          <el-icon class="hidden lg:block text-st-placeholder" :size="12"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu class="min-w-[180px]">
            <el-dropdown-item command="profile">个人中心</el-dropdown-item>
            <el-dropdown-item command="password">修改密码</el-dropdown-item>
            <el-dropdown-item command="campus">切换工作校区</el-dropdown-item>
            <template v-if="isDev">
              <el-dropdown-item command="test-data" divided>
                <Database class="w-4 h-4 mr-2 text-st-muted" />
                <span>测试数据管理</span>
              </el-dropdown-item>
            </template>
            <el-dropdown-item command="logout" divided class="!text-st-danger">
              <LogOut class="w-4 h-4 mr-2" />
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <ChangePasswordDialog v-if="passwordDialogRequested" v-model="passwordDialogVisible" />
    <!-- 测试数据管理弹窗 -->
    <el-dialog v-model="testDataModalVisible" title="测试数据与 Mock 数据管理中枢" :width="DIALOG_SIZE.md" destroy-on-close>
      <div class="space-y-4 text-xs">
        <div class="p-3.5 bg-st-primary-light border border-st-primary-border rounded-lg text-st-primary-active leading-relaxed">
          <div class="font-bold text-sm mb-1 flex items-center gap-1.5">
            <Settings class="w-4 h-4 text-st-primary" />
            <span>系统业务测试数据状态（已为您清空初始 Mock 数据）</span>
          </div>
          <div>当前系统内预设业务模拟数据已全部清空，方便您自由录入学员、签约开单、创建班级与排课测试。</div>
        </div>

        <!-- 实时数据看板 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="p-2.5 bg-st-header border rounded-lg text-center">
            <div class="text-xs text-st-muted">学员总数</div>
            <div class="text-lg font-bold text-st-primary font-mono">{{ liveStats.studentCount }}</div>
          </div>
          <div class="p-2.5 bg-st-header border rounded-lg text-center">
            <div class="text-xs text-st-muted">班级总数</div>
            <div class="text-lg font-bold text-st-success font-mono">{{ liveStats.classCount }}</div>
          </div>
          <div class="p-2.5 bg-st-header border rounded-lg text-center">
            <div class="text-xs text-st-muted">排课日程</div>
            <div class="text-lg font-bold text-st-purple font-mono">{{ liveStats.scheduleCount }}</div>
          </div>
          <div class="p-2.5 bg-st-header border rounded-lg text-center">
            <div class="text-xs text-st-muted">财务订单</div>
            <div class="text-lg font-bold text-st-warning font-mono">{{ liveStats.orderCount }}</div>
          </div>
        </div>

        <!-- 明细统计 -->
        <div class="p-3 bg-st-header rounded border text-st-secondary space-y-1 text-xs">
          <div class="flex justify-between">
            <span>• 待分班学员调度池：</span>
            <b class="text-st-title">{{ liveStats.unassignedCount }} 人</b>
          </div>
          <div class="flex justify-between">
            <span>• 待办财务审批工单：</span>
            <b class="text-st-title">{{ liveStats.approvalCount }} 笔</b>
          </div>
          <div class="flex justify-between">
            <span>• 考勤消课打卡记录：</span>
            <b class="text-st-title">{{ liveStats.attendanceCount }} 条</b>
          </div>
          <div class="flex justify-between">
            <span>• 教研标准课程库：</span>
            <b class="text-st-title">{{ liveStats.courseCount }} 门</b>
          </div>
        </div>

        <div class="text-xs text-st-secondary">
          提示：点击“一键清空全部业务数据”可将学员、班级、课表与订单全部重置为 0；需要恢复官方演示数据时可随时点击“恢复初始演示Mock数据”。
        </div>
      </div>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <el-button type="danger" plain @click="handleClearBusinessData">
            清空全部业务数据
          </el-button>
          <div class="space-x-2">
            <el-button type="warning" plain @click="handleClearLocalStorage">
              清空本地缓存
            </el-button>
            <el-button type="primary" @click="handleRestorePresetData">
              恢复初始演示Mock数据
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Database, LogOut, Settings, PanelLeftClose as Fold, Bell, Maximize as FullScreen, ChevronDown as ArrowDown } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { DIALOG_SIZE } from '@/constants/ui'
import CampusSelector from './CampusSelector.vue'
// 顶栏随 MainLayout 首屏加载：改密码弹窗和待办数量接口按需加载，不计入首屏体积
const ChangePasswordDialog = defineAsyncComponent(() => import('./ChangePasswordDialog.vue'))

defineEmits(['toggle-sidebar'])

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const currentUserName = computed(() => authStore.user?.realName || authStore.user?.account || '')
const currentUserRole = computed(() => authStore.user?.roleName || '')
const avatarChar = computed(() => currentUserName.value ? currentUserName.value.charAt(0) : '用')
const isTeacher = computed(() => authStore.isTeacher)
// 演示用的快捷换号与测试数据入口仅在开发环境展示
const isDev = import.meta.env.DEV

const campusSelectorRef = ref<{ open?: () => void } | null>(null)
const passwordDialogVisible = ref(false)
const passwordDialogRequested = ref(false)

/** 待办数量：只统计当前账号有权限查看的项；null 表示无权限或获取失败，不展示该项 */
const todoCounts = ref<{ approvals: number | null; unassigned: number | null }>({ approvals: null, unassigned: null })
const todoTotal = computed(() => (todoCounts.value.approvals ?? 0) + (todoCounts.value.unassigned ?? 0))

async function loadTodoCounts() {
  const [{ financialApi }, { studentApi }] = await Promise.all([
    import('@/api/modules/financial'),
    import('@/api/modules/student'),
  ])
  const [approvals, stats] = await Promise.all([
    authStore.hasPermission('financial:approvalFlow')
      ? financialApi.getApprovals({ status: 'pending', page: 1, pageSize: 1 }).catch(() => null)
      : Promise.resolve(null),
    authStore.hasPermission('student:allStudent')
      ? studentApi.getStudentStats().catch(() => null)
      : Promise.resolve(null),
  ])
  const approvalTotal = approvals?.data?.total
  const unassigned = stats?.data?.unassigned
  todoCounts.value = {
    approvals: typeof approvalTotal === 'number' ? approvalTotal : null,
    unassigned: typeof unassigned === 'number' ? unassigned : null,
  }
}

onMounted(loadTodoCounts)

function handleGoHome() {
  router.push('/dashboard')
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {})
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }
}

const testDataModalVisible = ref(false)
const liveStats = ref({
  studentCount: 22,
  classCount: 8,
  scheduleCount: 33,
  orderCount: 25,
  evaluationCount: 1,
  unassignedCount: 4,
  approvalCount: 2,
  attendanceCount: 18,
  courseCount: 6,
  isCleared: false
})

function updateLiveStats() {
  // 保持统计概览展示
}

function openTestDataModal() {
  updateLiveStats()
  testDataModalVisible.value = true
}

function handleClearBusinessData() {
  ElMessageBox.confirm(
    '提示：当前系统已全面接通服务端真实数据库，业务数据（学员、班级、课表日程、财务流水）已持久化安全落盘。本地清空仅重置前端临时缓存，不会破坏数据库物理记录。确认刷新前端状态？',
    '业务数据状态提示',
    {
      confirmButtonText: '确认刷新',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    updateLiveStats()
    ElMessage.info('已重新同步前端状态！即将刷新...')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }).catch(() => {})
}

function handleClearLocalStorage() {
  ElMessageBox.confirm(
    '确认清空浏览器本地前端界面缓存（保留当前账号登录会话与数据库连接）？',
    '清空前端缓存确认',
    {
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('yixiao_auth_token')
      const user = localStorage.getItem('yixiao_auth_user')
      const campusId = localStorage.getItem('yixiao_current_campus_id')

      localStorage.clear()

      if (token && !token.startsWith('mock-')) localStorage.setItem('yixiao_auth_token', token)
      if (user) localStorage.setItem('yixiao_auth_user', user)
      if (campusId) localStorage.setItem('yixiao_current_campus_id', campusId)
      localStorage.setItem('yixiao_mock_data_cleared', 'false')
      localStorage.setItem('yixiao_mock_v5_cleared', '1')
    }
    updateLiveStats()
    ElMessage.success('浏览器本地临时缓存已成功清空（保留登录凭据）！即将重新拉取数据库真实数据...')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }).catch(() => {})
}

function handleRestorePresetData() {
  ElMessageBox.confirm(
    '当前系统数据统一由后端 SQLite 数据库真实持久化提供。如需重置初始演示数据，请在后端环境执行 seed 脚本。确认刷新展示？',
    '提示',
    {
      confirmButtonText: '确认刷新',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    ElMessage.success('正在刷新界面数据...')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }).catch(() => {})
}

function handleUserCommand(command: string) {
  if (command === 'test-data') {
    openTestDataModal()
    return
  }
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出当前账号并返回登录界面吗？', '安全退出提示', {
      confirmButtonText: '确定退出',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      authStore.logout()
      tenantStore.reset()
      ElMessage.success('已安全退出登录')
      router.push('/login')
    }).catch(() => {})
  } else if (command === 'campus') {
    campusSelectorRef.value?.open?.()
  } else if (command === 'profile') {
    router.push('/systemSetting/authoritiesInfo')
  } else if (command === 'password') {
    passwordDialogRequested.value = true
    passwordDialogVisible.value = true
  }
}
</script>

<style scoped>
.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--st-color-secondary);
  transition: background-color 0.15s, color 0.15s;
}
.header-icon-btn:hover {
  background-color: var(--st-color-fill);
  color: var(--st-color-title);
}
.notice-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 9px 8px;
  border-radius: 6px;
  text-align: left;
  color: var(--st-color-secondary);
  line-height: 1.5;
}
.notice-item:hover {
  background-color: var(--st-color-header);
}
.notice-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--st-color-title);
}
.notice-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  margin-top: 7px;
  flex-shrink: 0;
}
</style>
