<template>
  <div>
    <RosterTabs class="mb-3" />
    <SearchBox v-model="keyword" class="mb-3" placeholder="搜索姓名、学号、手机号" @search="load(1)" />

    <LoadState
      :loading="loading && students.length === 0"
      :error="students.length === 0 ? error : ''"
      :has-data="students.length > 0"
      :is-empty="!loading && students.length === 0"
      :empty-text="keyword ? '没有匹配的学员' : '你的班级还没有在读学员'"
      @retry="load(1)"
    >
      <p class="m-0 mb-2 text-[13px] text-st-muted tabular-nums">共 {{ total }} 位学员</p>
      <div class="grid gap-2">
        <RouterLink
          v-for="stu in students"
          :key="stu.id"
          :to="`/teacher/students/${stu.id}`"
          class="tp-card block no-underline text-inherit active:bg-st-header"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[15px] font-medium text-st-title break-words min-w-0">
              {{ stu.name }}
              <span class="text-[12px] font-normal text-st-muted tabular-nums">{{ stu.studentNo }}</span>
            </span>
            <span class="tp-tag" :class="stu.isLowLessons ? 'tp-tag-danger' : 'tp-tag-muted'">剩 {{ stu.remainingLessons }} 课时</span>
          </div>
          <p class="m-0 mt-1 text-[13px] text-st-muted break-words">{{ stu.classes.map((c) => c.name).join('、') }}</p>
        </RouterLink>
      </div>
      <button v-if="students.length < total" type="button" class="tp-btn tp-btn-secondary w-full mt-3" :disabled="loading" @click="load(page + 1)">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
      <p v-if="error" class="mt-2 mb-0 text-center text-[13px] text-st-danger" role="alert">{{ error }}</p>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { teacherPortalApi, type TeacherStudentItem } from '@/api'
import LoadState from './components/LoadState.vue'
import RosterTabs from './components/RosterTabs.vue'
import SearchBox from './components/SearchBox.vue'
import { usePageRefresh } from './utils/pageRefresh'

const keyword = ref('')
const students = ref<TeacherStudentItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
let requestId = 0
const PAGE_SIZE = 20
const MAX_REFRESH_SIZE = 50

async function load(targetPage: number) {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const { data } = await teacherPortalApi.getStudents({
      keyword: keyword.value.trim() || undefined,
      page: targetPage,
      pageSize: PAGE_SIZE,
    })
    if (id !== requestId) return
    students.value = targetPage === 1 ? data.list : [...students.value, ...data.list]
    total.value = data.total
    page.value = targetPage
  } catch (err: any) {
    if (id === requestId) error.value = err?.message || '加载失败，请重试'
  } finally {
    if (id === requestId) loading.value = false
  }
}

/** 刷新时保留已加载的条数和滚动位置，不退回第一页 */
async function refresh() {
  const loaded = students.value.length
  if (loaded <= PAGE_SIZE) return load(1)
  if (loaded > MAX_REFRESH_SIZE) return
  const id = ++requestId
  try {
    const { data } = await teacherPortalApi.getStudents({
      keyword: keyword.value.trim() || undefined,
      page: 1,
      pageSize: loaded,
    })
    if (id !== requestId) return
    students.value = data.list
    total.value = data.total
    page.value = Math.ceil(data.list.length / PAGE_SIZE)
    error.value = ''
  } catch (err: any) {
    if (id === requestId) error.value = err?.message || '刷新失败，请重试'
  }
}

usePageRefresh(refresh)
onActivated(refresh)
</script>
