<template>
  <!-- body 不滚动：横屏或键盘弹出时必须能滚到登录按钮 -->
  <div class="h-full overflow-y-auto w-full flex bg-st-bg text-st-title">
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
    <main class="flex-1 min-h-full h-fit my-auto flex flex-col items-center justify-center px-6 py-10">
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
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="next"
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
              enterkeyhint="go"
              @keyup.enter="handleFormLogin"
            >
              <template #prefix>
                <Lock class="w-4 h-4 text-st-placeholder" />
              </template>
            </el-input>
          </el-form-item>

          <div class="flex items-center justify-between text-[13px] text-st-secondary">
            <el-checkbox v-model="rememberMe" label="记住账号" />
            <span class="text-st-primary hover:underline cursor-pointer" @click="handleForgotPassword">忘记密码？</span>
          </div>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="w-full !h-[46px] !text-[15px] !mt-6"
            @click="handleFormLogin"
          >
            登录
          </el-button>
        </el-form>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Monitor, Zap, Shield, User, Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { safeLoginRedirect } from '@/utils/loginRedirect'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const loading = ref(false)

// 「记住账号」只记住账号本身，绝不保存密码
const REMEMBERED_ACCOUNT_KEY = 'yixiao_remembered_account'
function readRememberedAccount(): string {
  try {
    return localStorage.getItem(REMEMBERED_ACCOUNT_KEY) || ''
  } catch {
    return ''
  }
}
const rememberedAccount = readRememberedAccount()
const rememberMe = ref(Boolean(rememberedAccount))

// 不再预填任何账号或密码
const loginForm = reactive({
  account: rememberedAccount,
  password: ''
})

async function executeLogin(account: string, password: string) {
  // 手机上连按「前往」或弱网时会重复提交：后一次完成时路由已离开登录页，回跳地址读不到，
  // 校长等非纯教师账号会被送回仪表盘。因此只允许一个提交在途，并在提交时就锁定回跳地址
  if (loading.value) return
  loading.value = true
  const redirectTarget = safeLoginRedirect(route.query.redirect)
  try {
    const res = await authStore.loginAsync(account, password)

    try {
      if (rememberMe.value) {
        localStorage.setItem(REMEMBERED_ACCOUNT_KEY, account)
      } else {
        localStorage.removeItem(REMEMBERED_ACCOUNT_KEY)
      }
    } catch {
      // 存储不可用时忽略
    }

    // 联动校区
    if (res.user.campusId) {
      await tenantStore.enterCampus(res.user.campusId)
    }

    // 会话失效被送回登录页的，登录后回到原页面；否则老师进入教师端、其他角色进入仪表盘
    const target = redirectTarget || authStore.homePath
    // 教师端首页本身就有「上午好，某某」的问候，不再弹后台式的登录提示
    if (!target.startsWith('/teacher')) {
      ElMessage.success(`欢迎您，${res.user.realName}！已以【${res.user.roleName || '系统用户'}】身份成功登录`)
    }

    // 用 replace：登录页不留在浏览记录里，后退不会回到登录页，微信里也不会因此出现底部前进后退栏
    // 等导航结束才解除 loading，否则路由分片加载期间还能再次提交；分片加载失败由 router.onError 处理
    await router.replace(target).catch(() => {})
  } catch (err: any) {
    ElMessage.error(err.message || '登录失败，请检查用户名与密码是否正确')
  } finally {
    loading.value = false
  }
}

function handleFormLogin() {
  const account = loginForm.account.trim()
  if (!account) {
    ElMessage.warning('请输入用户名、工号或手机号')
    return
  }
  // 不再以默认密码兜底：密码为空直接拦截
  if (!loginForm.password) {
    ElMessage.warning('请输入密码')
    return
  }
  executeLogin(account, loginForm.password)
}

function handleForgotPassword() {
  ElMessage.info('请联系校区管理员在「系统设置 → 组织架构与机构」的员工列表中为你重置密码')
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
