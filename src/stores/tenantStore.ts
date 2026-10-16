import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Campus } from '@/types'
import { systemApi } from '@/api'

const DEFAULT_CAMPUSES: Campus[] = [
  {
    id: 'campus-bj-hq',
    code: 'HQ001',
    name: '拓视未来-原阳校区',
    isHeadquarter: true,
    address: '河南省新乡市原阳县乐博学习中心',
    phone: '0373-7558888'
  }
]

const LOCAL_STORAGE_CAMPUS_KEY = 'yixiao_current_campus_id'

export const useTenantStore = defineStore('tenant', () => {
  const companyId = ref('COMP-ST-002599')
  const companyName = ref('北京拓视未来教育科技集团股份有限公司')
  const stockCode = ref('002599')
  const campuses = ref<Campus[]>(DEFAULT_CAMPUSES)

  // 默认拓视未来-原阳校区
  const savedCampusId = localStorage.getItem(LOCAL_STORAGE_CAMPUS_KEY)
  const initialCampusId = savedCampusId && DEFAULT_CAMPUSES.some(c => c.id === savedCampusId)
    ? savedCampusId
    : DEFAULT_CAMPUSES[0].id

  const currentCampusId = ref<string>(initialCampusId)

  const currentCampus = computed<Campus>(() => {
    return campuses.value.find(c => c.id === currentCampusId.value) || campuses.value[0]
  })

  function setCampus(campusId: string) {
    const target = campuses.value.find(c => c.id === campusId)
    if (target) {
      currentCampusId.value = campusId
      localStorage.setItem(LOCAL_STORAGE_CAMPUS_KEY, campusId)
    }
  }

  async function loadCampuses() {
    try {
      const res = await systemApi.getCampuses(DEFAULT_CAMPUSES)
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const found = res.data.find((c: any) => c.name?.includes('原阳') || c.id === 'campus-bj-hq')
        campuses.value = [
          {
            id: found?.id || 'campus-bj-hq',
            code: found?.code || 'HQ001',
            name: '拓视未来-原阳校区',
            isHeadquarter: true,
            address: found?.address || '河南省新乡市原阳县乐博学习中心',
            phone: found?.phone || '0373-7558888'
          }
        ]
        currentCampusId.value = campuses.value[0].id
      } else {
        campuses.value = DEFAULT_CAMPUSES
        currentCampusId.value = DEFAULT_CAMPUSES[0].id
      }
    } catch {
      campuses.value = DEFAULT_CAMPUSES
      currentCampusId.value = DEFAULT_CAMPUSES[0].id
    }
  }

  if (typeof window !== 'undefined') {
    loadCampuses()
  }

  return {
    companyId,
    companyName,
    stockCode,
    campuses,
    currentCampusId,
    currentCampus,
    setCampus,
    loadCampuses
  }
})
