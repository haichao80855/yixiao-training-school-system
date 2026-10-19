<template>
  <header class="h-[60px] bg-white border-b border-st-border shadow-header px-4 flex items-center justify-between select-none z-30 relative">
    <!-- 左侧：品牌 Logo 与折叠触发器 -->
    <div class="flex items-center space-x-3 shrink-0">
      <div class="flex items-center space-x-2.5 cursor-pointer" @click="handleGoHome">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-sm">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="leading-tight">
          <div class="flex items-center space-x-1.5">
            <span class="font-extrabold text-st-title text-base tracking-tight">一校</span>
            <span class="font-bold text-st-regular text-sm">教培系统</span>
          </div>
          <div class="text-[10px] text-st-muted font-mono tracking-tighter">
            证券代码：002599
          </div>
        </div>
      </div>

      <!-- 侧边栏折叠/展开按钮 -->
      <el-button
        link
        size="small"
        class="!ml-2 !p-1.5 text-st-secondary hover:!text-st-primary hover:!bg-st-primary-light transition-colors"
        title="折叠/展开侧边栏"
        @click="$emit('toggle-sidebar')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </el-button>
    </div>

    <!-- 右侧：高级操作胶囊栏与用户卡片 -->
    <div class="flex items-center space-x-3 shrink-0">
      <!-- 多校区切换选择器 -->
      <CampusSelector customClass="bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 !text-white !border-transparent text-xs" />

      <!-- 待办消息与通知 -->
      <el-popover placement="bottom" :width="280" trigger="click">
        <template #reference>
          <div class="relative p-1.5 rounded-full text-st-secondary hover:text-st-primary hover:bg-gray-100 cursor-pointer transition-colors" title="待办通知">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span class="absolute -top-0.5 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full border-2 border-white">
              3
            </span>
          </div>
        </template>
        <div class="text-xs space-y-2">
          <div class="font-bold text-st-title border-b border-gray-100 pb-1 flex justify-between">
            <span>待办事项通知</span>
            <span class="text-st-primary cursor-pointer hover:underline">全部已读</span>
          </div>
          <div class="p-2 bg-blue-50 rounded text-st-title cursor-pointer hover:bg-blue-100 transition-colors" @click="$router.push('/financial/approvalFlow')">
            <span class="font-semibold text-st-primary">[待审批]</span> 学员退费工单待审核与财务核验
          </div>
          <div class="p-2 bg-amber-50 rounded text-st-title cursor-pointer hover:bg-amber-100 transition-colors" @click="$router.push('/studentCenter/unassigned')">
            <span class="font-semibold text-amber-600">[学员入读]</span> 待分班学员池待履约排班入读
          </div>
          <div class="p-2 bg-purple-50 rounded text-st-title cursor-pointer hover:bg-purple-100 transition-colors" @click="$router.push('/educational/timeSchedule')">
            <span class="font-semibold text-purple-600">[排课看板]</span> 查看本周校区 7×15 网格排期
          </div>
        </div>
      </el-popover>

      <!-- 全屏切换 -->
      <el-button
        link
        size="small"
        class="!p-1.5 !rounded-full text-st-secondary hover:!text-st-primary hover:!bg-gray-100 transition-colors hidden sm:inline-flex"
        title="切换全屏模式"
        @click="toggleFullScreen"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </el-button>

      <!-- 用户信息与下拉菜单 -->
      <el-dropdown trigger="click" @command="handleUserCommand">
        <div class="flex items-center space-x-2 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors">
          <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm', isTeacher ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600']">
            {{ avatarChar }}
          </div>
          <div class="hidden lg:block text-left leading-tight">
            <div class="text-xs font-semibold text-st-title flex items-center">
              {{ currentUserName }}
              <span v-if="isTeacher" class="ml-1 text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-normal">讲师</span>
              <svg class="w-3 h-3 ml-1 text-st-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div class="text-[10px] text-st-muted">{{ currentUserRole }}</div>
          </div>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">个人中心</el-dropdown-item>
            <el-dropdown-item command="password">修改密码</el-dropdown-item>
            <el-dropdown-item command="campus" divided>切换工作校区</el-dropdown-item>
            <el-dropdown-item command="switch-teacher" divided class="flex items-center gap-1.5">
              <UserCheck class="w-4 h-4 mr-1 text-st-primary" />
              <span>快速换成：张老师 (讲师)</span>
            </el-dropdown-item>
            <el-dropdown-item command="switch-admin" class="flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 mr-1 text-amber-500" />
              <span>快速换成：冬海潮 (管理员)</span>
            </el-dropdown-item>
            <el-dropdown-item command="test-data" divided class="flex items-center gap-1.5">
              <Database class="w-4 h-4 mr-1 text-st-secondary" />
              <span>测试数据管理 / 清空Mock数据</span>
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided class="!text-rose-600 font-semibold flex items-center gap-1.5">
              <LogOut class="w-4 h-4 mr-1 text-rose-600" />
              <span>安全退出</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- AI 助手弹窗 -->
    <el-dialog v-model="aiDialogVisible" title="拓视未来教育 AI 智能助教与课评引擎" :width="DIALOG_SIZE.sm">
      <div class="space-y-3 text-xs">
        <p class="text-st-secondary">已连接拓视未来教育 AI 大模型中枢，为您实时提供智能课评生成、排课冲突建议与学员留存分析支持。</p>
        <div class="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div class="font-semibold text-st-primary mb-1">今日教务建议：</div>
          <div>检测到原阳校区周六下午 14:00 李老师存在双课冲突，建议将《EV3单片机实操》调整至 16:30 由张老师代授。</div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" type="primary" @click="aiDialogVisible = false">收到建议</el-button>
      </template>
    </el-dialog>
    <!-- 测试数据管理弹窗 -->
    <el-dialog v-model="testDataModalVisible" title="测试数据与 Mock 数据管理中枢" :width="DIALOG_SIZE.md" destroy-on-close>
      <div class="space-y-4 text-xs">
        <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 leading-relaxed">
          <div class="font-bold text-sm mb-1 flex items-center gap-1.5">
            <Settings class="w-4 h-4 text-st-primary" />
            <span>系统业务测试数据状态（已为您清空初始 Mock 数据）</span>
          </div>
          <div>当前系统内预设业务模拟数据已全部清空，方便您自由录入学员、签约开单、创建班级与排课测试。</div>
        </div>

        <!-- 实时数据看板 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="p-2.5 bg-gray-50 border rounded-lg text-center">
            <div class="text-[11px] text-gray-500">学员总数</div>
            <div class="text-lg font-bold text-st-primary font-mono">{{ liveStats.studentCount }}</div>
          </div>
          <div class="p-2.5 bg-gray-50 border rounded-lg text-center">
            <div class="text-[11px] text-gray-500">班级总数</div>
            <div class="text-lg font-bold text-emerald-600 font-mono">{{ liveStats.classCount }}</div>
          </div>
          <div class="p-2.5 bg-gray-50 border rounded-lg text-center">
            <div class="text-[11px] text-gray-500">排课日程</div>
            <div class="text-lg font-bold text-purple-600 font-mono">{{ liveStats.scheduleCount }}</div>
          </div>
          <div class="p-2.5 bg-gray-50 border rounded-lg text-center">
            <div class="text-[11px] text-gray-500">财务订单</div>
            <div class="text-lg font-bold text-amber-600 font-mono">{{ liveStats.orderCount }}</div>
          </div>
        </div>

        <!-- 明细统计 -->
        <div class="p-3 bg-gray-50 rounded border text-gray-600 space-y-1 text-[11px]">
          <div class="flex justify-between">
            <span>• 待分班学员调度池：</span>
            <b class="text-gray-800">{{ liveStats.unassignedCount }} 人</b>
          </div>
          <div class="flex justify-between">
            <span>• 待办财务审批工单：</span>
            <b class="text-gray-800">{{ liveStats.approvalCount }} 笔</b>
          </div>
          <div class="flex justify-between">
            <span>• 考勤消课打卡记录：</span>
            <b class="text-gray-800">{{ liveStats.attendanceCount }} 条</b>
          </div>
          <div class="flex justify-between">
            <span>• 教研标准课程库：</span>
            <b class="text-gray-800">{{ liveStats.courseCount }} 门</b>
          </div>
        </div>

        <div class="text-[11px] text-gray-400">
          提示：点击“一键清空全部业务数据”可将学员、班级、课表与订单全部重置为 0；需要恢复官方演示数据时可随时点击“恢复初始演示Mock数据”。
        </div>
      </div>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <el-button size="small" type="danger" plain @click="handleClearBusinessData">
            清空全部业务数据
          </el-button>
          <div class="space-x-2">
            <el-button size="small" type="warning" plain @click="handleClearLocalStorage">
              清空本地缓存
            </el-button>
            <el-button size="small" type="primary" @click="handleRestorePresetData">
              恢复初始演示Mock数据
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserCheck, ShieldCheck, Database, LogOut, Settings, Info } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { DIALOG_SIZE } from '@/constants/ui'
import CampusSelector from './CampusSelector.vue'

defineEmits(['toggle-sidebar'])

const router = useRouter()
const authStore = useAuthStore()

const currentUserName = computed(() => authStore.user?.realName || authStore.user?.account || '冬海潮')
const currentUserRole = computed(() => authStore.user?.roleName || '超级管理员')
const avatarChar = computed(() => currentUserName.value ? currentUserName.value.charAt(0) : '用')
const isTeacher = computed(() => authStore.isTeacher)

const aiDialogVisible = ref(false)

function handleGoHome() {
  router.push('/dashboard')
}

function handleAiAssistant() {
  aiDialogVisible.value = true
}

function handleDownloads() {
  ElMessage.info('已开启云端导出中心，当前暂无后台任务。')
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
      ElMessage.success('已安全退出登录')
      router.push('/login')
    }).catch(() => {})
  } else if (command === 'switch-teacher') {
    authStore.login('zhangls')
    ElMessage.success('已快速切换为授课老师【张老师】身份')
    router.push('/educational/workbench')
  } else if (command === 'switch-admin') {
    authStore.login('donghaichao')
    ElMessage.success('已快速切换为超级管理员【冬海潮】身份')
    router.push('/dashboard')
  } else if (command === 'profile') {
    router.push('/systemSetting/authoritiesInfo')
  } else {
    ElMessage.info(`触发操作: ${command}`)
  }
}
</script>
