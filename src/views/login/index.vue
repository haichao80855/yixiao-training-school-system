<template>
  <div class="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/40 text-st-title select-none relative overflow-hidden">
    <!-- 背景轻盈流光装饰微光圈 -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- 顶部极简品牌导航 -->
    <header class="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-st-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <span class="font-extrabold text-lg tracking-wider">ST</span>
        </div>
        <div>
          <div class="font-bold text-base tracking-wide flex items-center gap-2 text-st-title">
            <span>拓视未来教育「一校教培系统」</span>
            <span class="text-[10px] bg-blue-50 text-st-primary px-2 py-0.5 rounded border border-blue-200 font-mono font-semibold">
              SZ:002599
            </span>
          </div>
          <div class="text-xs text-st-muted tracking-wider">
            ShengTong Education Cloud ERP & Teaching Station
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 text-xs text-st-secondary">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-st-border shadow-xs backdrop-blur-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          系统状态：云端双活就绪
        </span>
      </div>
    </header>

    <!-- 主体区域：左侧宣传特性 + 右侧登录卡片 -->
    <main class="w-full max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 z-10">
      <!-- 左侧宣传说明 -->
      <div class="w-full lg:w-1/2 space-y-6 text-center lg:text-left">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-st-primary text-xs font-semibold shadow-xs">
          <Rocket class="w-3.5 h-3.5 text-st-primary" />
          <span>全新一代面向智慧校区与教学讲台的工作台</span>
        </div>

        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-st-title leading-tight">
          科技赋能教培，<br />
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-st-primary via-indigo-600 to-sky-600">
            打造老师专属智能讲台
          </span>
        </h1>

        <p class="text-sm text-st-regular leading-relaxed max-w-xl">
          覆盖教研课程研发、7×15 智能甘特排课、随堂快捷点名消课、AI 助教深度课评生成、多校区多租户与 4 级 RBAC 矩阵，助推教培机构全流程数字化闭环。
        </p>

        <!-- 核心能力亮点芯片 -->
        <div class="grid grid-cols-2 gap-3.5 pt-2 max-w-lg mx-auto lg:mx-0">
          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-st-border shadow-xs hover:shadow-md transition-shadow">
            <div class="w-9 h-9 rounded-lg bg-blue-50 text-st-primary flex items-center justify-center shrink-0">
              <Monitor class="w-5 h-5 text-st-primary" />
            </div>
            <div class="text-left">
              <div class="text-xs font-bold text-st-title">教学服务讲台</div>
              <div class="text-[11px] text-st-muted mt-0.5">课次/点名/多媒体课评</div>
            </div>
          </div>

          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-st-border shadow-xs hover:shadow-md transition-shadow">
            <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Zap class="w-5 h-5 text-amber-600" />
            </div>
            <div class="text-left">
              <div class="text-xs font-bold text-st-title">三维排课碰撞引擎</div>
              <div class="text-[11px] text-st-muted mt-0.5">师资/教室/时间防冲突</div>
            </div>
          </div>

          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-st-border shadow-xs hover:shadow-md transition-shadow">
            <div class="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles class="w-5 h-5 text-purple-600" />
            </div>
            <div class="text-left">
              <div class="text-xs font-bold text-st-title">AI 智能课评中枢</div>
              <div class="text-[11px] text-st-muted mt-0.5">大模型一键润色发送</div>
            </div>
          </div>

          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-st-border shadow-xs hover:shadow-md transition-shadow">
            <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Shield class="w-5 h-5 text-emerald-600" />
            </div>
            <div class="text-left">
              <div class="text-xs font-bold text-st-title">集团多校区隔离</div>
              <div class="text-[11px] text-st-muted mt-0.5">4 级细粒度权限管控</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录面板 -->
      <div class="w-full lg:w-96 max-w-md bg-white text-st-title rounded-2xl shadow-xl p-7 border border-st-border flex flex-col justify-between">
        <div>
          <!-- 标题栏 -->
          <div class="mb-5 text-center">
            <h2 class="text-xl font-bold text-st-title">欢迎登录系统</h2>
            <p class="text-xs text-st-muted mt-1">支持工号或手机号登录，也可点击下方快捷角色卡片体验</p>
          </div>

          <!-- 表单区 -->
          <el-form :model="loginForm" class="space-y-4" @submit.prevent="handleFormLogin">
            <el-form-item class="!mb-3">
              <el-input
                v-model="loginForm.account"
                placeholder="请输入用户名/工号或手机号"
                size="large"
                clearable
                class="w-full"
              >
                <template #prefix>
                  <User class="w-4 h-4 text-st-muted" />
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
                  <Lock class="w-4 h-4 text-st-muted" />
                </template>
              </el-input>
            </el-form-item>

            <div class="flex items-center justify-between text-xs text-st-secondary">
              <el-checkbox v-model="rememberMe" label="记住账号" size="small" />
              <span class="text-st-primary hover:underline cursor-pointer">忘记密码？</span>
            </div>

            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="w-full !rounded-xl !h-11 !text-sm !font-bold !mt-2 shadow-md shadow-blue-500/20"
              @click="handleFormLogin"
            >
              登 录 系 统
            </el-button>
          </el-form>
        </div>

        <!-- 分割线 -->
        <div class="my-5 relative text-center">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-st-border"></div>
          </div>
          <span class="relative px-3 bg-white text-[11px] text-st-muted tracking-wider">
            一键体验不同岗位账号
          </span>
        </div>

        <!-- 快捷角色体验卡片 (重点满足用户测试老师账号需求) -->
        <div class="space-y-2">
          <!-- 1. 授课老师 (张老师) -->
          <el-button
            class="!w-full !p-3 !h-auto !rounded-xl !border-blue-200 !bg-blue-50/70 hover:!bg-blue-100/80 transition-all !text-left !flex !items-center !justify-between group cursor-pointer"
            @click="handleQuickLogin('zhangls')"
          >
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                张
              </div>
              <div class="text-left">
                <div class="text-xs font-bold text-st-title group-hover:text-blue-700 flex items-center gap-1.5">
                  <span>张老师</span>
                  <span class="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-normal">
                    授课老师
                  </span>
                </div>
                <div class="text-[10px] text-st-muted">少儿编程主讲 · 直通教学讲台</div>
              </div>
            </div>
            <span class="text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              进入 <ArrowRight class="w-3.5 h-3.5 inline-block" />
            </span>
          </el-button>

          <!-- 2. 超级管理员 (冬海潮) -->
          <el-button
            class="!w-full !p-3 !h-auto !rounded-xl !border-indigo-200 !bg-indigo-50/50 hover:!bg-indigo-100/70 transition-all !text-left !flex !items-center !justify-between group cursor-pointer"
            @click="handleQuickLogin('donghaichao')"
          >
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                海
              </div>
              <div class="text-left">
                <div class="text-xs font-bold text-st-title group-hover:text-indigo-700 flex items-center gap-1.5">
                  <span>冬海潮</span>
                  <span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-normal">
                    超级管理员
                  </span>
                </div>
                <div class="text-[10px] text-st-muted">集团总部 · 统管全校区全流程</div>
              </div>
            </div>
            <span class="text-xs text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              进入 <ArrowRight class="w-3.5 h-3.5 inline-block" />
            </span>
          </el-button>

          <!-- 3. 执行校长 (张建华) -->
          <el-button
            class="!w-full !p-2.5 !h-auto !rounded-lg !border-st-border !bg-slate-50/70 hover:!bg-slate-100 transition-all !text-left !flex !items-center !justify-between group cursor-pointer"
            @click="handleQuickLogin('zhangjh')"
          >
            <div class="flex items-center space-x-2">
              <Briefcase class="w-4 h-4 text-slate-600" />
              <span class="text-xs font-medium text-st-regular">张建华 (执行校长)</span>
            </div>
            <span class="text-[11px] text-st-muted group-hover:text-st-title flex items-center gap-0.5">
              切换 <ArrowRight class="w-3 h-3 inline-block" />
            </span>
          </el-button>

          <!-- 4. 校区财务 (王财务) -->
          <el-button
            class="!w-full !p-2.5 !h-auto !rounded-lg !border-st-border !bg-slate-50/70 hover:!bg-slate-100 transition-all !text-left !flex !items-center !justify-between group cursor-pointer"
            @click="handleQuickLogin('wangcw')"
          >
            <div class="flex items-center space-x-2">
              <Coins class="w-4 h-4 text-amber-600" />
              <span class="text-xs font-medium text-st-regular">王财务 (校区出纳)</span>
            </div>
            <span class="text-[11px] text-st-muted group-hover:text-st-title flex items-center gap-0.5">
              切换 <ArrowRight class="w-3 h-3 inline-block" />
            </span>
          </el-button>
        </div>
      </div>
    </main>

    <!-- 底部版权信息 -->
    <footer class="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-st-muted border-t border-st-border z-10">
      北京拓视未来教育科技股份有限公司 (SZ: 002599) · 一校智慧教培一体化平台 · 讲台与教学服务中枢
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Rocket,
  Monitor,
  Zap,
  Sparkles,
  Shield,
  User,
  Lock,
  ArrowRight,
  Briefcase,
  Coins
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const loading = ref(false)
const rememberMe = ref(true)

const loginForm = reactive({
  account: 'zhangls',
  password: '123456'
})

async function executeLogin(account: string, password?: string) {
  loading.value = true
  try {
    const res = await authStore.loginAsync(account, password || '123456')

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
  } catch (err: any) {
    ElMessage.error(err.message || '登录失败，请检查用户名与密码是否正确')
  } finally {
    loading.value = false
  }
}

function handleFormLogin() {
  if (!loginForm.account) {
    ElMessage.warning('请输入用户名、工号或手机号')
    return
  }
  executeLogin(loginForm.account, loginForm.password)
}

function handleQuickLogin(account: string) {
  loginForm.account = account
  loginForm.password = '123456'
  executeLogin(account, '123456')
}
</script>

<style scoped>
:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--st-border-color, #E2E8F0) inset;
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--st-primary, #2563EB) inset !important;
}
</style>
