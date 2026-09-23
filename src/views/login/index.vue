<template>
  <div class="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 select-none relative overflow-hidden">
    <!-- 背景流光装饰微光圈 -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- 顶部极简品牌导航 -->
    <header class="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          <span class="font-extrabold text-lg tracking-wider">ST</span>
        </div>
        <div>
          <div class="font-bold text-base tracking-wide flex items-center gap-2">
            <span>盛通教育「一校教培系统」</span>
            <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30 font-mono">
              SZ:002599
            </span>
          </div>
          <div class="text-xs text-slate-400 tracking-wider">
            ShengTong Education Cloud ERP & Teaching Station
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 text-xs text-slate-400">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          系统状态：云端双活就绪
        </span>
      </div>
    </header>

    <!-- 主体区域：左侧宣传特性 + 右侧登录卡片 -->
    <main class="w-full max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 z-10">
      <!-- 左侧宣传说明 -->
      <div class="w-full lg:w-1/2 space-y-6 text-center lg:text-left">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-medium">
          <span>🚀 全新一代面向智慧校区与教学讲台的工作台</span>
        </div>

        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
          科技赋能教培，<br />
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
            打造老师专属智能讲台
          </span>
        </h1>

        <p class="text-sm text-slate-300 leading-relaxed max-w-xl">
          覆盖教研课程研发、7×15 智能甘特排课、随堂快捷点名消课、AI 助教深度课评生成、多校区多租户与 4 级 RBAC 矩阵，助推教培机构全流程数字化闭环。
        </p>

        <!-- 核心能力亮点芯片 -->
        <div class="grid grid-cols-2 gap-3 pt-2 max-w-lg mx-auto lg:mx-0">
          <div class="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm">
            <span class="text-xl">🖥️</span>
            <div>
              <div class="text-xs font-semibold text-white">教学服务讲台</div>
              <div class="text-[10px] text-slate-400">课次/点名/多媒体课评</div>
            </div>
          </div>
          <div class="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm">
            <span class="text-xl">⚡</span>
            <div>
              <div class="text-xs font-semibold text-white">三维排课碰撞引擎</div>
              <div class="text-[10px] text-slate-400">师资/教室/时间防冲突</div>
            </div>
          </div>
          <div class="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm">
            <span class="text-xl">🪄</span>
            <div>
              <div class="text-xs font-semibold text-white">AI 智能课评中枢</div>
              <div class="text-[10px] text-slate-400">大模型一键润色发送</div>
            </div>
          </div>
          <div class="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm">
            <span class="text-xl">🛡️</span>
            <div>
              <div class="text-xs font-semibold text-white">集团多校区隔离</div>
              <div class="text-[10px] text-slate-400">4 级细粒度权限管控</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录面板 -->
      <div class="w-full lg:w-96 max-w-md bg-white text-slate-800 rounded-2xl shadow-2xl p-7 border border-slate-100 flex flex-col justify-between">
        <div>
          <!-- 标题栏 -->
          <div class="mb-5 text-center">
            <h2 class="text-xl font-bold text-slate-900">欢迎登录系统</h2>
            <p class="text-xs text-slate-500 mt-1">请输入工号或点击下方角色卡片快捷进入</p>
          </div>

          <!-- 表单区 -->
          <el-form :model="loginForm" class="space-y-4" @submit.prevent="handleFormLogin">
            <el-form-item class="!mb-3">
              <el-input
                v-model="loginForm.account"
                placeholder="请输入用户名/工号 (如 zhangls / donghaichao)"
                size="large"
                clearable
                class="w-full"
              >
                <template #prefix>
                  <span class="text-slate-400 text-sm">👤</span>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item class="!mb-3">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入登录密码 (默认 123456)"
                show-password
                size="large"
                class="w-full"
                @keyup.enter="handleFormLogin"
              >
                <template #prefix>
                  <span class="text-slate-400 text-sm">🔒</span>
                </template>
              </el-input>
            </el-form-item>

            <div class="flex items-center justify-between text-xs text-slate-500">
              <el-checkbox v-model="rememberMe" label="记住账号" size="small" />
              <span class="text-st-primary hover:underline cursor-pointer">忘记密码？</span>
            </div>

            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="w-full !rounded-lg !h-11 !text-sm !font-semibold !mt-2 shadow-md shadow-blue-500/20"
              @click="handleFormLogin"
            >
              登 录 系 统
            </el-button>
          </el-form>
        </div>

        <!-- 分割线 -->
        <div class="my-5 relative text-center">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200"></div>
          </div>
          <span class="relative px-3 bg-white text-[11px] text-slate-400 uppercase tracking-wider">
            一键体验不同岗位账号
          </span>
        </div>

        <!-- 快捷角色体验卡片 (重点满足用户测试老师账号需求) -->
        <div class="space-y-2">
          <!-- 1. 授课老师 (张老师) -->
          <button
            type="button"
            class="w-full p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 transition-all text-left flex items-center justify-between group cursor-pointer"
            @click="handleQuickLogin('zhangls')"
          >
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                张
              </div>
              <div>
                <div class="text-xs font-bold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5">
                  <span>张老师</span>
                  <span class="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-normal">
                    授课老师
                  </span>
                </div>
                <div class="text-[10px] text-slate-500">少儿编程主讲 · 直通教学讲台</div>
              </div>
            </div>
            <span class="text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
              进入 ➔
            </span>
          </button>

          <!-- 2. 超级管理员 (冬海潮) -->
          <button
            type="button"
            class="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 transition-all text-left flex items-center justify-between group cursor-pointer"
            @click="handleQuickLogin('donghaichao')"
          >
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                海
              </div>
              <div>
                <div class="text-xs font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-1.5">
                  <span>冬海潮</span>
                  <span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-normal">
                    超级管理员
                  </span>
                </div>
                <div class="text-[10px] text-slate-500">集团总部 · 统管全校区全流程</div>
              </div>
            </div>
            <span class="text-xs text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
              进入 ➔
            </span>
          </button>

          <!-- 3. 执行校长 (张建华) -->
          <button
            type="button"
            class="w-full p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-all text-left flex items-center justify-between group cursor-pointer"
            @click="handleQuickLogin('zhangjh')"
          >
            <div class="flex items-center space-x-2">
              <span class="text-xs">👨‍💼</span>
              <span class="text-xs font-medium text-slate-700">张建华 (执行校长)</span>
            </div>
            <span class="text-[11px] text-slate-400 group-hover:text-slate-600">切换 ➔</span>
          </button>

          <!-- 4. 校区财务 (王财务) -->
          <button
            type="button"
            class="w-full p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-all text-left flex items-center justify-between group cursor-pointer"
            @click="handleQuickLogin('wangcw')"
          >
            <div class="flex items-center space-x-2">
              <span class="text-xs">💰</span>
              <span class="text-xs font-medium text-slate-700">王财务 (校区出纳)</span>
            </div>
            <span class="text-[11px] text-slate-400 group-hover:text-slate-600">切换 ➔</span>
          </button>
        </div>
      </div>
    </main>

    <!-- 底部版权信息 -->
    <footer class="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500 border-t border-slate-800/60 z-10">
      北京盛通教育科技股份有限公司 (SZ: 002599) · 一校智慧教培一体化平台 · 讲台与教学服务中枢
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const loading = ref(false)
const rememberMe = ref(true)

const loginForm = reactive({
  account: 'zhangls',
  password: '123'
})

function executeLogin(account: string, _password?: string) {
  loading.value = true
  setTimeout(() => {
    const res = authStore.login(account, _password)
    loading.value = false

    // 联动校区
    if (res.user.campusId) {
      tenantStore.setCampus(res.user.campusId)
    }

    ElMessage.success(`欢迎您，${res.user.realName}！已以【${res.user.roleName || '系统用户'}】身份成功登录`)

    // 若是授课老师，直达教学讲台页面；否则进入仪表盘
    if (res.user.roles.includes('teacher') || res.user.teacherId) {
      router.push('/educational/workbench')
    } else {
      router.push('/dashboard')
    }
  }, 250)
}

function handleFormLogin() {
  if (!loginForm.account) {
    ElMessage.warning('请输入用户名/工号')
    return
  }
  executeLogin(loginForm.account, loginForm.password)
}

function handleQuickLogin(account: string) {
  loginForm.account = account
  executeLogin(account)
}
</script>

<style scoped>
:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #1890ff inset !important;
}
</style>
