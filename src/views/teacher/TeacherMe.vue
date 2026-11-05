<template>
  <div class="grid gap-3">
    <section class="tp-card flex items-center gap-3">
      <span class="w-12 h-12 rounded-full bg-st-primary-light text-st-primary flex items-center justify-center shrink-0">
        <UserRound class="w-6 h-6" />
      </span>
      <div class="min-w-0">
        <p class="m-0 text-[16px] font-semibold text-st-title break-words">{{ authStore.user?.realName }}</p>
        <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">{{ authStore.user?.roleName }} · {{ authStore.user?.account }}</p>
      </div>
    </section>

    <section class="tp-card !p-0 overflow-hidden">
      <label v-if="tenantStore.canSwitchCampus" class="menu-row">
        <Building2 class="w-5 h-5 text-st-muted shrink-0" />
        <span class="flex-1">当前校区</span>
        <select class="campus-select" :value="tenantStore.currentCampusId" aria-label="切换校区" @change="onCampusChange">
          <option v-for="c in tenantStore.campuses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <div v-else class="menu-row">
        <Building2 class="w-5 h-5 text-st-muted shrink-0" />
        <span class="flex-1">当前校区</span>
        <span class="text-[14px] text-st-muted break-words text-right">{{ authStore.user?.campusName }}</span>
      </div>
      <button type="button" class="menu-row" @click="passwordVisible = true">
        <KeyRound class="w-5 h-5 text-st-muted shrink-0" />
        <span class="flex-1 text-left">修改密码</span>
        <ChevronRight class="w-4 h-4 text-st-placeholder" />
      </button>
      <RouterLink to="/educational/workbench" class="menu-row no-underline">
        <Monitor class="w-5 h-5 text-st-muted shrink-0" />
        <span class="flex-1 text-left">进入电脑版后台</span>
        <ChevronRight class="w-4 h-4 text-st-placeholder" />
      </RouterLink>
    </section>

    <button type="button" class="tp-btn tp-btn-secondary w-full !text-st-danger-deep" @click="handleLogout">退出登录</button>

    <el-dialog v-model="passwordVisible" title="修改密码" width="min(92vw, 420px)" top="6vh" append-to-body @closed="resetPasswordForm">
      <form class="grid gap-3" @submit.prevent="submitPassword">
        <label class="grid gap-1 text-[14px] text-st-title">
          原密码
          <input v-model="passwordForm.oldPassword" class="tp-input" type="password" autocomplete="current-password" />
        </label>
        <label class="grid gap-1 text-[14px] text-st-title">
          新密码
          <input v-model="passwordForm.newPassword" class="tp-input" type="password" autocomplete="new-password" />
          <span class="text-[12px] text-st-muted">8-20 位，包含大小写字母和数字</span>
        </label>
        <label class="grid gap-1 text-[14px] text-st-title">
          确认新密码
          <input v-model="passwordForm.confirmPassword" class="tp-input" type="password" autocomplete="new-password" />
        </label>
        <p v-if="passwordError" class="m-0 text-[13px] text-st-danger" role="alert">{{ passwordError }}</p>
        <button type="submit" class="tp-btn tp-btn-primary w-full" :disabled="passwordSubmitting">
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
.menu-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 8px 14px;
  border: 0;
  border-bottom: 1px solid var(--st-color-border);
  background: transparent;
  color: var(--st-color-title);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;
}
.menu-row:last-child {
  border-bottom: 0;
}
.campus-select {
  max-width: 55%;
  border: 0;
  background: transparent;
  color: var(--st-color-muted);
  font-size: 16px;
  font-family: inherit;
  text-align: right;
}
</style>
