<template>
  <div class="min-h-screen w-full flex bg-st-bg text-st-title">
    <!-- 左侧品牌面板（大屏显示） -->
    <aside class="login-brand hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-12 text-white relative overflow-hidden">
      <div class="flex items-center gap-3 relative z-10">
        <span class="w-9 h-9 rounded-lg bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </span>
        <span class="text-lg font-semibold tracking-tight">一校教培系统</span>
      </div>

      <div class="relative z-10 max-w-md">
        <h1 class="text-[34px] leading-tight font-semibold tracking-tight">
          让教务、教学与财务<br />在一处协同
        </h1>
        <p class="mt-4 text-[15px] leading-relaxed text-white/75">
          课程研发、排课点名、学员档案、收费与审批，一套系统覆盖培训学校的日常运营。
        </p>

        <ul class="mt-10 space-y-4 text-[14px]">
          <li class="flex items-start gap-3">
            <span class="feature-icon"><Monitor class="w-4 h-4" /></span>
            <span><span class="font-medium">教学讲台</span><span class="text-white/65"> · 课次、点名与课后点评</span></span>
          </li>
          <li class="flex items-start gap-3">
            <span class="feature-icon"><Zap class="w-4 h-4" /></span>
            <span><span class="font-medium">智能排课</span><span class="text-white/65"> · 教师、教室、学员三方冲突检测</span></span>
          </li>
          <li class="flex items-start gap-3">
            <span class="feature-icon"><Shield class="w-4 h-4" /></span>
            <span><span class="font-medium">多校区管理</span><span class="text-white/65"> · 校区数据隔离与分级权限</span></span>
          </li>
        </ul>
      </div>

      <div class="relative z-10 text-xs text-white/55">© 拓视未来教育 · 一校教培系统</div>
    </aside>

    <!-- 右侧登录区 -->
    <main class="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div class="w-full max-w-[380px]">
        <!-- 小屏品牌 -->
        <div class="flex lg:hidden items-center gap-2.5 mb-8">
          <span class="w-8 h-8 rounded-lg bg-st-primary flex items-center justify-center text-white">
            <svg class="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </span>
          <span class="text-base font-semibold">一校教培系统</span>
        </div>

        <h2 class="text-2xl font-semibold tracking-tight">登录</h2>
        <p class="text-[13px] text-st-muted mt-1.5">使用工号或手机号登录你的工作台</p>

        <!-- 表单区 -->
        <el-form :model="loginForm" class="mt-7" label-position="top" @submit.prevent="handleFormLogin">
          <el-form-item label="账号" class="!mb-4">
            <el-input
              v-model="loginForm.account"
              placeholder="用户名 / 工号 / 手机号"
              size="large"
              clearable
              autocomplete="username"
            >
              <template #prefix>
                <User class="w-4 h-4 text-st-placeholder" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" class="!mb-3">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
              size="large"
              autocomplete="current-password"
              @keyup.enter="handleFormLogin"
            >
              <template #prefix>
                <Lock class="w-4 h-4 text-st-placeholder" />
              </template>
            </el-input>
          </el-form-item>

          <div class="flex items-center justify-between text-[13px] text-st-secondary">
            <el-checkbox v-model="rememberMe" label="记住账号" />
            <span class="text-st-primary hover:underline cursor-pointer">忘记密码？</span>
          </div>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="w-full !h-11 !text-[15px] !mt-6"
            @click="handleFormLogin"
          >
            登录
          </el-button>
        </el-form>

        <!-- 演示账号 -->
        <div class="mt-9">
          <div class="flex items-center gap-3 text-xs text-st-muted">
            <span class="flex-1 h-px bg-st-border"></span>
            <span>演示账号快速体验</span>
            <span class="flex-1 h-px bg-st-border"></span>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="demo in demoAccounts"
              :key="demo.account"
              type="button"
              class="demo-account group"
              :disabled="loading"
              @click="handleQuickLogin(demo.account)"
            >
              <span :class="['w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0', demo.avatarClass]">
                {{ demo.name.charAt(0) }}
              </span>
              <span class="min-w-0 text-left">
                <span class="block text-[13px] font-medium text-st-title truncate">{{ demo.name }}</span>
                <span class="block text-xs text-st-muted truncate">{{ demo.role }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Monitor, Zap, Shield, User, Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const loading = ref(false)
const rememberMe = ref(true)

// 演示环境快捷登录账号
const demoAccounts = [
  { account: 'zhangls', name: '张老师', role: '授课老师', avatarClass: 'bg-emerald-50 text-emerald-700' },
  { account: 'donghaichao', name: '冬海潮', role: '超级管理员', avatarClass: 'bg-st-primary-light text-st-primary' },
  { account: 'zhangjh', name: '张建华', role: '执行校长', avatarClass: 'bg-violet-50 text-violet-700' },
  { account: 'wangcw', name: '王财务', role: '校区出纳', avatarClass: 'bg-amber-50 text-amber-700' }
]

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
.login-brand {
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(96, 165, 250, 0.35) 0%, rgba(96, 165, 250, 0) 55%),
    radial-gradient(90% 70% at 0% 100%, rgba(30, 64, 175, 0.6) 0%, rgba(30, 64, 175, 0) 60%),
    linear-gradient(160deg, #1D4ED8 0%, #1E3A8A 100%);
}
.feature-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  margin-top: -3px;
}
.demo-account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--st-color-border);
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.15s, background-color 0.15s;
}
.demo-account:hover {
  border-color: var(--st-color-primary-border);
  background: var(--st-color-primary-bg);
}
.demo-account:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
:deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  color: var(--st-color-regular);
  padding-bottom: 6px !important;
  line-height: 1.4 !important;
}
:deep(.el-input__wrapper) {
  border-radius: 8px;
}
</style>
