<template>
  <div class="tp-stack tp-stack--loose">
    <PageTitle title="我的" />

    <section class="tp-card profile">
      <TpAvatar :name="authStore.user?.realName" :seed="authStore.user?.id" size="lg" />
      <div class="tp-grow">
        <h2 class="profile__name">{{ authStore.user?.realName }}</h2>
        <p class="tp-text-meta tp-m-0">{{ authStore.user?.roleName }} · 工号 {{ authStore.user?.account }}</p>
        <p class="tp-text-meta tp-m-0">{{ authStore.user?.campusName }}</p>
      </div>
    </section>

    <section class="tp-list">
      <label v-if="tenantStore.canSwitchCampus" class="tp-row">
        <span class="tp-icon-tile tp-icon-tile--warning"><Building2 aria-hidden="true" /></span>
        <span class="tp-row__body">当前校区</span>
        <select class="campus-select" :value="tenantStore.currentCampusId" aria-label="切换校区" @change="onCampusChange">
          <option v-for="c in tenantStore.campuses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <button type="button" class="tp-row menu-button" @click="passwordVisible = true">
        <span class="tp-icon-tile"><KeyRound aria-hidden="true" /></span>
        <span class="tp-row__body">修改密码</span>
        <ChevronRight class="tp-row__chevron" aria-hidden="true" />
      </button>
      <RouterLink to="/educational/workbench" class="tp-row">
        <span class="tp-icon-tile tp-icon-tile--info"><Monitor aria-hidden="true" /></span>
        <span class="tp-row__body">进入电脑版后台</span>
        <ChevronRight class="tp-row__chevron" aria-hidden="true" />
      </RouterLink>
    </section>

    <button type="button" class="tp-btn tp-btn-danger tp-btn-block" @click="handleLogout">退出登录</button>

    <TpSheet :open="passwordVisible" title="修改密码" @close="closePassword">
      <form @submit.prevent="submitPassword">
        <label class="tp-field">
          <span class="tp-label">原密码</span>
          <input v-model="passwordForm.oldPassword" class="tp-input" type="password" autocomplete="current-password" />
        </label>
        <label class="tp-field">
          <span class="tp-label">新密码</span>
          <input v-model="passwordForm.newPassword" class="tp-input" type="password" autocomplete="new-password" />
          <span class="tp-help">8-20 位，包含大小写字母和数字</span>
        </label>
        <label class="tp-field">
          <span class="tp-label">确认新密码</span>
          <input v-model="passwordForm.confirmPassword" class="tp-input" type="password" autocomplete="new-password" />
        </label>
        <p v-if="passwordError" class="tp-text-small tp-m-0 tp-mt-3 tp-text-danger" role="alert">{{ passwordError }}</p>
        <button type="submit" class="tp-btn tp-btn-primary tp-btn-block tp-mt-4" :disabled="passwordSubmitting">
          {{ passwordSubmitting ? '提交中…' : '确认修改' }}
        </button>
      </form>
    </TpSheet>
  </div>
</template>

<script setup lang="ts">
import TpAvatar from './components/TpAvatar.vue'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { tpConfirm, tpToast } from './utils/feedback'
import TpSheet from './components/TpSheet.vue'
import { Building2, ChevronRight, KeyRound, Monitor, UserRound } from 'lucide-vue-next'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import PageTitle from './components/PageTitle.vue'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const passwordVisible = ref(false)
const passwordSubmitting = ref(false)
const passwordError = ref('')
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

function closePassword() {
  passwordVisible.value = false
  resetPasswordForm()
}

function resetPasswordForm() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordError.value = ''
}

async function submitPassword() {
  passwordError.value = ''
  if (!passwordForm.oldPassword) {
    passwordError.value = '请输入原密码'
    return
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/.test(passwordForm.newPassword)) {
    passwordError.value = '新密码需为 8-20 位，并包含大小写字母和数字'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  passwordSubmitting.value = true
  try {
    await authApi.changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
    tpToast.success('密码已修改，请重新登录')
    passwordVisible.value = false
    logoutToLogin()
  } catch (err: any) {
    passwordError.value = err?.message || '修改失败，请重试'
  } finally {
    passwordSubmitting.value = false
  }
}

function onCampusChange(event: Event) {
  tenantStore.setCampus((event.target as HTMLSelectElement).value)
  tpToast.success('已切换校区')
}

async function handleLogout() {
  const ok = await tpConfirm({ title: '退出登录', message: '退出后需要重新输入账号和密码。', confirmText: '退出', danger: true })
  if (!ok) return
  logoutToLogin()
}

/** 从教师端退出后重新登录仍回到教师端：校长等兼任账号的默认首页是管理后台，不带回跳地址会进电脑版 */
function logoutToLogin() {
  authStore.logout()
  router.replace({ path: '/login', query: { redirect: '/teacher' } })
}

onMounted(() => {
  tenantStore.loadCampuses()
})
</script>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
}
.profile__name {
  margin: 0 0 2px;
  font-size: var(--tp-fs-heading);
  font-weight: 700;
  line-height: var(--tp-lh-tight);
  letter-spacing: var(--tp-tracking-tight);
  overflow-wrap: anywhere;
}
.menu-button {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--tp-motion);
}
@media (hover: hover) {
  .menu-button:hover {
    background: var(--tp-surface-hover);
  }
}
.menu-button:active {
  background: var(--tp-surface-sunken);
}
.campus-select {
  max-width: 55%;
  border: 0;
  background: transparent;
  color: var(--tp-text-2);
  font-size: var(--tp-fs-input);
  font-family: inherit;
  text-align: right;
}
</style>
