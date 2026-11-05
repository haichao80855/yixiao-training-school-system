import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Campus } from '@/types'
import { authApi } from '@/api'
import { useAuthStore } from './authStore'

const LOCAL_STORAGE_CAMPUS_KEY = 'yixiao_current_campus_id'

function persistCampusId(campusId: string) {
  if (typeof localStorage === 'undefined') return
  if (campusId) {
    localStorage.setItem(LOCAL_STORAGE_CAMPUS_KEY, campusId)
  } else {
    localStorage.removeItem(LOCAL_STORAGE_CAMPUS_KEY)
  }
}

export const useTenantStore = defineStore('tenant', () => {
  const authStore = useAuthStore()

  const companyId = ref('COMP-ST-002599')
  const companyName = ref('北京拓视未来教育科技集团股份有限公司')
  const stockCode = ref('002599')

  // 当前账号可切换的校区，由服务端按权限下发
  const campuses = ref<Campus[]>([])

  // 列表返回前先沿用上次的工作校区，加载完成后再按授权范围校验
  const savedCampusId = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_CAMPUS_KEY) : ''
  const currentCampusId = ref<string>(savedCampusId || authStore.user?.campusId || '')

  const currentCampus = computed<Campus>(() => {
    return (
      campuses.value.find(c => c.id === currentCampusId.value) || {
        id: currentCampusId.value,
        code: '',
        name: authStore.user?.campusId === currentCampusId.value ? authStore.user?.campusName || '' : '',
        isHeadquarter: false
      }
    )
  })

  const canSwitchCampus = computed(() => campuses.value.length > 1)

  function setCampus(campusId: string) {
    const target = campuses.value.find(c => c.id === campusId)
    if (target) {
      currentCampusId.value = campusId
      persistCampusId(campusId)
    }
  }

  async function loadCampuses() {
    if (!authStore.token) return
    try {
      const res = await authApi.getProfile()
      const list: Campus[] = res?.data?.authorizedCampuses
      if (!Array.isArray(list) || list.length === 0) return

      campuses.value = list
      if (!list.some(c => c.id === currentCampusId.value)) {
        const homeCampusId = res.data.campusId
        const fallback = list.find(c => c.id === homeCampusId) || list[0]
        setCampus(fallback.id)
      }
    } catch (err) {
      console.warn('[tenantStore] 校区列表加载失败', err)
    }
  }

  /** 登录成功后进入本人所属校区，避免沿用上一个账号的工作校区 */
  async function enterCampus(homeCampusId: string) {
    currentCampusId.value = homeCampusId
    persistCampusId(homeCampusId)
    await loadCampuses()
  }

  /** 退出登录时清除校区上下文 */
  function reset() {
    campuses.value = []
    currentCampusId.value = ''
    persistCampusId('')
  }

  if (typeof window !== 'undefined' && authStore.token) {
    loadCampuses()
  }

  return {
    companyId,
    companyName,
    stockCode,
    campuses,
    currentCampusId,
    currentCampus,
    canSwitchCampus,
    setCampus,
    loadCampuses,
    enterCampus,
    reset
  }
})
