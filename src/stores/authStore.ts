import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

export interface UserProfile {
  id: string
  account: string
  realName: string
  phone?: string
  campusId: string
  campusName: string
  roles: string[]
  roleName?: string
  teacherId?: string
  departmentName?: string
  postName?: string
  permissions: string[]
  dataScope?: 'all' | 'campus' | 'department' | 'self'
}

const TOKEN_KEY = 'yixiao_auth_token'
const USER_KEY = 'yixiao_auth_user'

export const useAuthStore = defineStore('auth', () => {
  // 只恢复本人上次登录保存的会话；没有会话就是未登录 (由路由守卫送回登录页)。
  // 原实现在无会话时默认预置超级管理员身份，打开任意内部页面即以超管身份进入
  const initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || '' : ''
  const initialUserStr = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null

  let defaultUser: UserProfile | null = null
  let defaultToken = ''

  // 遗留的本地演示令牌 (mock-* / 本地登录产生的 st-token-*) 不是有效会话，一并清除
  if ((initialToken.startsWith('mock-') || initialToken.startsWith('st-token-')) && typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } else if (initialToken && initialUserStr) {
    try {
      defaultUser = JSON.parse(initialUserStr)
      defaultToken = initialToken
    } catch {
      defaultUser = null
    }
  }

  const token = ref<string>(defaultToken)
  const user = ref<UserProfile | null>(defaultUser)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isSuperAdmin = computed(() => {
    const u = user.value
    if (!u) return false
    return (
      u.roles?.includes('super_admin') ||
      u.roles?.includes('admin') ||
      u.roles?.includes('r1') ||
      !!(u.roleName && u.roleName.includes('超级管理员')) ||
      u.permissions?.includes('*') ||
      false
    )
  })
  const isTeacher = computed(() => user.value?.roles.includes('teacher') || !!user.value?.teacherId)

  function setLoginSession(newToken: string, userInfo: UserProfile) {
    token.value = newToken
    user.value = userInfo
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }

  function hasPermission(permCode: string): boolean {
    if (!user.value) return false
    if (user.value.permissions.includes('*')) return true
    return user.value.permissions.includes(permCode)
  }

  const dataScope = computed<'all' | 'campus' | 'department' | 'self'>(() => user.value?.dataScope || 'self')
  const isDataScopeSelf = computed(() => dataScope.value === 'self')
  const isDataScopeCampus = computed(() => dataScope.value === 'campus')
  const isDataScopeAll = computed(() => dataScope.value === 'all')

  function updateUserDataScope(newScope: 'all' | 'campus' | 'department' | 'self') {
    if (user.value) {
      user.value.dataScope = newScope
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      }
    }
  }

  async function loginAsync(accountOrPhone: string, password: string): Promise<{ success: boolean; user: UserProfile }> {
    // 只认服务端认证结果：任何失败都如实抛出，绝不降级为本地登录
    // (原实现在服务端不可达或返回非预期错误时，会以任意账号、不校验密码在本地登录)
    let res: Awaited<ReturnType<typeof authApi.login>>
    try {
      res = await authApi.login({ account: accountOrPhone, password })
    } catch (e: any) {
      const errMsg: string = e?.message || ''
      if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(errMsg)) {
        throw new Error('无法连接服务器，请检查网络后重试')
      }
      throw new Error(errMsg || '登录失败，请检查账号与密码')
    }

    const rawToken = res?.data?.accessToken || res?.data?.token
    if (!res?.success || !rawToken || !res.data?.user) {
      throw new Error('登录失败：服务器返回的登录信息不完整，请稍后重试')
    }

    const u = res.data.user
    const mappedUser: UserProfile = {
      id: u.id,
      account: u.account,
      realName: u.realName,
      phone: u.phone,
      campusId: u.campusId,
      campusName: u.campusName,
      roles: u.roles?.map((r: any) => typeof r === 'string' ? r : (r.code || r.name)) || ['staff'],
      roleName: u.roles?.[0]?.name || (u.roles?.includes('super_admin') ? '超级管理员' : '系统员工'),
      departmentName: u.departmentName || '教务中心',
      postName: u.postName || '运营人员',
      permissions: u.permissions || ['*'],
      dataScope: u.dataScope || 'campus'
    }
    setLoginSession(rawToken, mappedUser)
    return { success: true, user: mappedUser }
  }

  async function refreshProfile(): Promise<void> {
    try {
      if (!token.value) return
      const res = await authApi.getProfile()
      if (res && res.success && res.data) {
        const u = res.data
        if (user.value) {
          user.value.realName = u.realName || user.value.realName
          user.value.campusId = u.campusId || user.value.campusId
          user.value.campusName = u.campusName || user.value.campusName
          if (u.dataScope) user.value.dataScope = u.dataScope
          if (typeof window !== 'undefined') {
            localStorage.setItem(USER_KEY, JSON.stringify(user.value))
          }
        }
      }
    } catch {
      // 保持本地状态
    }
  }

  // 启动时不再自动登录任何账号；已有会话则向服务端核验 (令牌失效时 request 会清除会话并回到登录页)
  if (typeof window !== 'undefined' && token.value) {
    refreshProfile()
  }

  return {
    token,
    user,
    isAuthenticated,
    isSuperAdmin,
    isTeacher,
    setLoginSession,
    loginAsync,
    refreshProfile,
    logout,
    hasPermission,
    dataScope,
    isDataScopeSelf,
    isDataScopeCampus,
    isDataScopeAll,
    updateUserDataScope
  }
})
