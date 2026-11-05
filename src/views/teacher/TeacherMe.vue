<template>
  <div class="tp-stack tp-stack--loose">
    <PageTitle title="我的" :overline="authStore.user?.campusName" />

    <section class="tp-card profile">
      <span class="tp-avatar profile__avatar" aria-hidden="true">{{ authStore.user?.realName?.slice(0, 1) }}</span>
      <div style="min-width: 0">
        <h2 class="profile__name">{{ authStore.user?.realName }}</h2>
        <p class="tp-text-meta" style="margin: 2px 0 0">{{ authStore.user?.roleName }} · {{ authStore.user?.account }}</p>
      </div>
    </section>

    <section class="tp-list">
      <label v-if="tenantStore.canSwitchCampus" class="tp-row">
        <Building2 class="menu-icon" aria-hidden="true" />
        <span class="tp-row__body">当前校区</span>
        <select class="campus-select" :value="tenantStore.currentCampusId" aria-label="切换校区" @change="onCampusChange">
          <option v-for="c in tenantStore.campuses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <div v-else class="tp-row">
        <Building2 class="menu-icon" aria-hidden="true" />
        <span class="tp-row__body">当前校区</span>
        <span class="tp-text-meta" style="text-align: right">{{ authStore.user?.campusName }}</span>
      </div>
      <button type="button" class="tp-row menu-button" @click="passwordVisible = true">
        <KeyRound class="menu-icon" aria-hidden="true" />
        <span class="tp-row__body">修改密码</span>
        <ChevronRight class="tp-row__chevron" aria-hidden="true" />
      </button>
      <RouterLink to="/educational/workbench" class="tp-row">
        <Monitor class="menu-icon" aria-hidden="true" />
        <span class="tp-row__body">进入电脑版后台</span>
        <ChevronRight class="tp-row__chevron" aria-hidden="true" />
      </RouterLink>
    </section>

    <button type="button" class="tp-btn tp-btn-danger tp-btn-block" @click="handleLogout">退出登录</button>

    <el-dialog v-model="passwordVisible" title="修改密码" width="min(92vw, 420px)" top="6vh" append-to-body @closed="resetPasswordForm">
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
        <p v-if="passwordError" class="tp-text-small" style="margin: 12px 0 0; color: var(--tp-danger)" role="alert">{{ passwordError }}</p>
        <button type="submit" class="tp-btn tp-btn-primary tp-btn-block" style="margin-top: 16px" :disabled="passwordSubmitting">
          {{ passwordSubmitting ? '提交中…' : '确认修改' }}
        </button>
      </form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
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
    ElMessage.success('密码已修改，请重新登录')
    passwordVisible.value = false
    authStore.logout()
    router.replace('/login')
  } catch (err: any) {
    passwordError.value = err?.message || '修改失败，请重试'
  } finally {
    passwordSubmitting.value = false
  }
}

function onCampusChange(event: Event) {
  tenantStore.setCampus((event.target as HTMLSelectElement).value)
  ElMessage.success('已切换校区')
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录？', '退出登录', { confirmButtonText: '退出', cancelButtonText: '取消' })
  } catch {
    return
  }
  authStore.logout()
  router.replace('/login')
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
.profile__avatar {
  width: 48px;
  height: 48px;
  font-size: var(--tp-fs-title);
}
.profile__name {
  margin: 0;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  overflow-wrap: anywhere;
}
.menu-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: var(--tp-text-3);
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
  font-size: 16px;
  font-family: inherit;
  text-align: right;
}
</style>
