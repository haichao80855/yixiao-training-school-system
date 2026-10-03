import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Campus } from '@/types'
import { systemApi } from '@/api'

const DEFAULT_CAMPUSES: Campus[] = [
  {
    id: 'campus-bj-hq',
    code: 'HQ001',
    name: '总部校区',
    isHeadquarter: true,
    address: '北京市海淀区中关村南大街1号',
    phone: '010-88886666'
  },
  {
    id: 'campus-bj-yy',
    code: 'YY002',
    name: '远洋校区',
    isHeadquarter: false,
    address: '北京市朝阳区远洋国际商务中心B座',
    phone: '010-66668888'
  },
  {
    id: 'campus-bj-cy',
    code: 'CY003',
    name: '朝阳校区',
    isHeadquarter: false,
    address: '北京市朝阳区大望路现代城SOHO',
    phone: '010-65559999'
  },
  {
    id: 'campus-bj-hd',
    code: 'HD004',
    name: '海淀分校',
    isHeadquarter: false,
    address: '北京市海淀区万泉河路68号',
    phone: '010-82223333'
  },
  {
    id: 'campus-bj-wj',
    code: 'WJ005',
    name: '望京校区',
    isHeadquarter: false,
    address: '北京市朝阳区望京SOHO塔3',
    phone: '010-64771122'
  }
]

const LOCAL_STORAGE_CAMPUS_KEY = 'yixiao_current_campus_id'

export const useTenantStore = defineStore('tenant', () => {
  const companyId = ref('COMP-ST-002599')
  const companyName = ref('北京拓视未来教育科技集团股份有限公司')
  const stockCode = ref('002599')
  const campuses = ref<Campus[]>(DEFAULT_CAMPUSES)

  // 从 localStorage 读取上次选中的校区，无记录则默认总部校区
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
        campuses.value = res.data.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          isHeadquarter: c.isHeadquarter,
          address: c.address || '',
          phone: c.phone || ''
        }))
        if (!campuses.value.some(c => c.id === currentCampusId.value)) {
          currentCampusId.value = campuses.value[0].id
        }
      }
    } catch {
      // 保持默认校区列表
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
