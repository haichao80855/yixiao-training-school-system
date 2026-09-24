<template>
  <div class="space-y-5 p-5">
    <!-- 顶部欢迎卡片与当前校区运行态势 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center space-x-4">
        <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md">
          <span class="text-2xl font-bold">校</span>
        </div>
        <div>
          <div class="flex items-center space-x-3">
            <h1 class="text-xl font-bold text-st-title">拓视未来教育「一校教培系统」控制台</h1>
            <span class="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-st-primary border border-blue-200">
              证券代码 002599
            </span>
          </div>
          <p class="text-sm text-st-secondary mt-1">
            当前校区作用域：<span class="font-semibold text-st-primary">{{ currentCampus.name }}</span>
            （编码: {{ currentCampus.code }}） | 欢迎回来，超级管理员 冬海潮
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <el-button type="primary" plain @click="$router.push('/studentCenter/allStudent')">
          学员录入与建档
        </el-button>
        <el-button type="primary" @click="$router.push('/educational/timeSchedule')">
          排课甘特调度
        </el-button>
      </div>
    </div>

    <!-- 12个金刚区核心入口 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-st-title flex items-center gap-2">
          <span class="w-1 h-4 bg-st-primary rounded-full"></span>
          常用高频业务入口 (12大金刚区)
        </h2>
        <span class="text-xs text-st-muted">点击快速直达对应业务流程</span>
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
        <div
          v-for="item in diamondList"
          :key="item.name"
          @click="handleDiamondClick(item.path)"
          class="flex flex-col items-center justify-center p-3 rounded-lg border border-transparent hover:border-blue-200 hover:bg-st-primary-light transition-all cursor-pointer group"
        >
          <div :class="['w-11 h-11 rounded-full flex items-center justify-center text-lg mb-2 shadow-sm transition-transform group-hover:scale-110', item.bgClass]">
            <span>{{ item.icon }}</span>
          </div>
          <span class="text-xs font-medium text-st-regular group-hover:text-st-primary text-center">
            {{ item.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- 角色视角切换仪表盘与KPI指标卡 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <div class="flex items-center justify-between border-b border-st-border pb-3 mb-4">
        <div class="flex items-center space-x-2">
          <button
            v-for="role in roleTabs"
            :key="role.key"
            @click="activeRoleTab = role.key"
            :class="[
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeRoleTab === role.key
                ? 'bg-st-primary text-white shadow-sm'
                : 'text-st-regular hover:text-st-primary hover:bg-gray-100'
            ]"
          >
            {{ role.name }}
          </button>
        </div>
        <div class="text-xs text-st-muted">
          数据统计周期：本月（实时按当前校区隔离计算）
        </div>
      </div>

      <!-- 动态统计卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-st-secondary">
            <span>实收总金额 (元)</span>
            <span class="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">月环比 +12.8%</span>
          </div>
          <div class="text-2xl font-bold text-st-title my-2">
            ¥ {{ stats.totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </div>
          <div class="text-xs text-st-muted">
            已支付订单: <span class="text-st-title font-medium">{{ stats.paidOrderCount }}</span> 笔
          </div>
        </div>

        <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-st-secondary">
            <span>在籍在读学员</span>
            <span class="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">活跃</span>
          </div>
          <div class="text-2xl font-bold text-st-title my-2">
            {{ stats.studentCount }} <span class="text-xs font-normal text-st-muted">人</span>
          </div>
          <div class="text-xs text-st-muted">
            {{ currentCampus.name }} 归属生源池
          </div>
        </div>

        <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-st-secondary">
            <span>本周排课课次</span>
            <span class="text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">7x15网格</span>
          </div>
          <div class="text-2xl font-bold text-st-title my-2">
            {{ stats.scheduleCount }} <span class="text-xs font-normal text-st-muted">节</span>
          </div>
          <div class="text-xs text-st-muted flex items-center gap-1">
            冲突日程预警:
            <span :class="stats.conflictCount > 0 ? 'text-st-danger font-bold' : 'text-st-success font-bold'">
              {{ stats.conflictCount }} 处
            </span>
          </div>
        </div>

        <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-st-secondary">
            <span>授权售卖课程</span>
            <span class="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">教研库</span>
          </div>
          <div class="text-2xl font-bold text-st-title my-2">
            {{ stats.courseCount }} <span class="text-xs font-normal text-st-muted">门</span>
          </div>
          <div class="text-xs text-st-muted">
            跨校区已授权标准化课程体系
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTenantStore } from '@/stores/tenantStore'
import { getCampusStats } from '@/mocks'

const router = useRouter()
const tenantStore = useTenantStore()
const currentCampus = computed(() => tenantStore.currentCampus)

const stats = computed(() => {
  return getCampusStats(tenantStore.currentCampusId)
})

const activeRoleTab = ref('admin')

const roleTabs = [
  { key: 'admin', name: '管理员视角' },
  { key: 'edu', name: '教学教务视角' },
  { key: 'finance', name: '财务风控视角' },
  { key: 'sales', name: '招生咨询视角' }
]

const diamondList = [
  { name: '学员报名', icon: '📝', bgClass: 'bg-orange-100 text-orange-600', path: '/studentCenter/allStudent' },
  { name: '钱包充值', icon: '💳', bgClass: 'bg-amber-100 text-amber-600', path: '/studentCenter/allStudent' },
  { name: '季度续费', icon: '🎫', bgClass: 'bg-blue-100 text-blue-600', path: '/financial/orderManagement' },
  { name: '排课调度', icon: '📅', bgClass: 'bg-indigo-100 text-indigo-600', path: '/educational/timeSchedule' },
  { name: '班级管理', icon: '🏫', bgClass: 'bg-cyan-100 text-cyan-600', path: '/educational/classManagement' },
  { name: '考勤点名', icon: '⏱️', bgClass: 'bg-teal-100 text-teal-600', path: '/educational/attendance' },
  { name: '课程研发', icon: '📚', bgClass: 'bg-purple-100 text-purple-600', path: '/curriculum/courseManage' },
  { name: '课评生成', icon: '⭐', bgClass: 'bg-rose-100 text-rose-600', path: '/educational/timeSchedule' },
  { name: '异动申请', icon: '🔄', bgClass: 'bg-sky-100 text-sky-600', path: '/studentCenter/allStudent' },
  { name: '收费订单', icon: '💰', bgClass: 'bg-yellow-100 text-yellow-600', path: '/financial/orderManagement' },
  { name: '退费审批', icon: '📋', bgClass: 'bg-emerald-100 text-emerald-600', path: '/financial/approvalFlow' },
  { name: '组织架构', icon: '🏢', bgClass: 'bg-green-100 text-green-600', path: '/systemSetting/authoritiesInfo' }
]

function handleDiamondClick(path: string) {
  router.push(path)
}
</script>
