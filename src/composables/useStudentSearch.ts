import { shallowRef, ref } from 'vue'
import { studentApi } from '@/api'

/** 下拉框一次最多显示的学员数；更多的靠输入关键字在后端搜索 */
export const STUDENT_OPTION_LIMIT = 30

/**
 * 学员下拉框的后端搜索。
 *
 * 以前下拉框一次性取学员列表 (不传分页时后端只回 10 个，传了也有上限)，学员一多就选不到。
 * 现在打开时取最近的 30 个，输入关键字 (姓名 / 学号 / 手机号) 时去后端搜，结果只认最后一次输入。
 *
 * 用法：
 *   const studentSearch = useStudentSearch(() => tenantStore.currentCampusId)
 *   <el-select filterable remote :remote-method="studentSearch.search" :loading="studentSearch.loading.value">
 *     <el-option v-for="s in studentSearch.options.value" ... />
 */
export function useStudentSearch(campusId: () => string | undefined) {
  const options = shallowRef<any[]>([])
  const loading = ref(false)
  let seq = 0

  async function search(keyword = '') {
    const current = ++seq
    loading.value = true
    try {
      const target = campusId()
      const res = await studentApi.getStudents({
        campusId: target && target !== 'all' ? target : undefined,
        keyword: keyword.trim() || undefined,
        page: 1,
        pageSize: STUDENT_OPTION_LIMIT,
      })
      if (current !== seq) return
      const data: any = res?.data
      options.value = Array.isArray(data) ? data : data?.items || data?.list || []
    } catch {
      if (current === seq) options.value = []
    } finally {
      if (current === seq) loading.value = false
    }
  }

  return { options, loading, search }
}
