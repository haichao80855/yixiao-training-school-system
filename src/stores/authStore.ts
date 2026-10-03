import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

export interface UserProfile {
  id: string
  account: string
  realName: string
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
const LOGOUT_FLAG_KEY = 'yixiao_auth_has_logged_out'

export const PRESET_USERS: Record<string, UserProfile & { password?: string; description?: string }> = {
  // 1. 授课老师 (张老师)
  zhangls: {
    id: 'u-zhangls',
    account: 'zhangls',
    password: '123',
    realName: '张老师',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    roles: ['teacher'],
    roleName: '少儿编程专职主讲教师',
    departmentName: '少儿编程教学组',
    postName: '高级编程讲师',
    dataScope: 'self',
    description: '信奥金牌讲师，主讲 Scratch / Python，教学讲台核心执教人',
    permissions: [
      'curriculum:view',
      'curriculum:courseManage',
      'educational:workbench',
      'educational:workbench:attend',
      'educational:schedule:view',
      'educational:classManagement',
      'student:view'
    ]
  },
  teacher: {
    id: 'u-zhangls',
    account: 'teacher',
    password: '123',
    realName: '张老师',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-001',
    roles: ['teacher'],
    roleName: '少儿编程专职主讲教师',
    departmentName: '少儿编程教学组',
    postName: '高级编程讲师',
    dataScope: 'self',
    description: '快捷授课教师账号（同张老师）',
    permissions: [
      'curriculum:view',
      'curriculum:courseManage',
      'educational:workbench',
      'educational:workbench:attend',
      'educational:schedule:view',
      'educational:classManagement',
      'student:view'
    ]
  },
  // 2. 超级管理员 (冬海潮)
  donghaichao: {
    id: 'u-01',
    account: 'donghaichao',
    password: '123',
    realName: '冬海潮',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    roles: ['super_admin'],
    roleName: '超级管理员 (集团总部)',
    departmentName: '教务教学部',
    postName: '总系统管理员',
    dataScope: 'all',
    description: '系统最高权限，统管全集团校区、财务审批与组织架构',
    permissions: ['*']
  },
  admin: {
    id: 'u-01',
    account: 'admin',
    password: '123',
    realName: '冬海潮',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    roles: ['super_admin'],
    roleName: '超级管理员 (集团总部)',
    departmentName: '教务教学部',
    postName: '总系统管理员',
    dataScope: 'all',
    description: '快捷管理员账号（同冬海潮）',
    permissions: ['*']
  },
  // 3. 硬件创客导师 (赵老师 / 赵立鹏)
  zhaolp: {
    id: 'u-05',
    account: 'zhaolp',
    password: '123',
    realName: '赵立鹏',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    teacherId: 't-005',
    roles: ['teacher'],
    roleName: 'EV3/单片机硬件导师',
    departmentName: '创客工程组',
    postName: '硬件主讲教师',
    dataScope: 'self',
    description: 'EV3机器人与开源硬件导师',
    permissions: [
      'curriculum:view',
      'educational:workbench',
      'educational:workbench:attend',
      'educational:schedule:view'
    ]
  },
  // 4. 分校区执行校长 (张建华)
  zhangjh: {
    id: 'u-02',
    account: 'zhangjh',
    password: '123',
    realName: '张建华',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    roles: ['principal'],
    roleName: '分校区执行校长',
    departmentName: '校长办公室',
    postName: '执行校长',
    dataScope: 'campus',
    description: '校区日常运营、教务调度与大额退费审批',
    permissions: [
      'curriculum:view',
      'student:view',
      'educational:schedule:view',
      'educational:workbench:attend',
      'financial:approval:process'
    ]
  },
  // 5. 校区财务 (王财务)
  wangcw: {
    id: 'u-04',
    account: 'wangcw',
    password: '123',
    realName: '王财务',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    roles: ['cashier', 'finance'],
    roleName: '校区出纳与财务',
    departmentName: '校区财务处',
    postName: '校区总出纳',
    dataScope: 'campus',
    description: '收费核销、出纳流水与财务终审入账',
    permissions: [
      'financial:order:view',
      'financial:approval:process',
      'financial:ledger:view'
    ]
  }
}

export const useAuthStore = defineStore('auth', () => {
  // 检查是否主动退出过
  const hasLoggedOut = typeof window !== 'undefined' && localStorage.getItem(LOGOUT_FLAG_KEY) === '1'

  // 读取现有状态；若未退出且无状态则默认初始化为冬海潮管理员
  const initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || '' : ''
  const initialUserStr = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null

  let defaultUser: UserProfile | null = null
  let defaultToken = ''

  if (initialToken && initialUserStr) {
    try {
      defaultUser = JSON.parse(initialUserStr)
      defaultToken = initialToken
    } catch {
      defaultUser = null
    }
  } else if (!hasLoggedOut) {
    // 首次进入系统默认预置冬海潮身份
    defaultUser = { ...PRESET_USERS.donghaichao }
    defaultToken = 'mock-st-token-donghaichao'
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
      localStorage.removeItem(LOGOUT_FLAG_KEY)
    }
  }

  function login(account: string, _password?: string): { success: boolean; user: UserProfile } {
    const key = (account || '').toLowerCase().trim()
    const preset = PRESET_USERS[key]

    let targetUser: UserProfile
    if (preset) {
      const { password: _, description: __, ...u } = preset
      targetUser = u
    } else {
      // 允许任意自定义账号登录
      const isTeacherRole = key.includes('teacher') || key.includes('ls') || key.includes('教')
      targetUser = {
        id: `u-${Date.now()}`,
        account: key,
        realName: isTeacherRole ? '张老师' : key,
        campusId: 'campus-bj-hq',
        campusName: '总部校区',
        teacherId: isTeacherRole ? 't-001' : undefined,
        roles: isTeacherRole ? ['teacher'] : ['super_admin'],
        roleName: isTeacherRole ? '少儿编程专职主讲教师' : '普通用户',
        departmentName: '教学教务中心',
        postName: isTeacherRole ? '授课教师' : '运营人员',
        permissions: ['*'],
        dataScope: isTeacherRole ? 'self' : 'all'
      }
    }

    const newToken = `st-token-${targetUser.account}-${Date.now()}`
    setLoginSession(newToken, targetUser)
    return { success: true, user: targetUser }
  }

  function logout() {
    token.value = ''
    user.value = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.setItem(LOGOUT_FLAG_KEY, '1')
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

  async function loginAsync(account: string, password = '123456'): Promise<{ success: boolean; user: UserProfile }> {
    try {
      const res = await authApi.login({ account, password })
      if (res && res.success && res.data?.token && res.data?.user) {
        const u = res.data.user
        const mappedUser: UserProfile = {
          id: u.id,
          account: u.account,
          realName: u.realName,
          campusId: u.campusId,
          campusName: u.campusName,
          roles: u.roles?.map((r: any) => typeof r === 'string' ? r : (r.code || r.name)) || ['staff'],
          roleName: u.roles?.[0]?.name || (u.roles?.includes('super_admin') ? '超级管理员' : '系统员工'),
          departmentName: u.departmentName || '教务中心',
          postName: u.postName || '运营人员',
          permissions: u.permissions || ['*'],
          dataScope: u.dataScope || 'campus'
        }
        setLoginSession(res.data.token, mappedUser)
        return { success: true, user: mappedUser }
      }
    } catch (e) {
      console.warn('[AuthStore] 远程后端认证未就绪，使用本地双轨模式登录:', e)
    }
    return login(account, password)
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

  if (typeof window !== 'undefined') {
    if (!token.value || token.value.startsWith('mock-')) {
      loginAsync('donghaichao', '123456')
    } else {
      refreshProfile()
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isSuperAdmin,
    isTeacher,
    setLoginSession,
    login,
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
