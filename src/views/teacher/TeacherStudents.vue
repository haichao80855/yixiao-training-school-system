<template>
  <div class="tp-stack">
    <PageTitle title="学员" :overline="students.length > 0 ? `共 ${total} 位学员` : ''" />
    <RosterTabs />
    <SearchBox v-model="keyword" placeholder="搜索姓名、学号、手机号" @search="load(1)" />

    <LoadState
      :loading="loading && students.length === 0"
      :error="students.length === 0 ? error : ''"
      :has-data="students.length > 0"
      :is-empty="!loading && students.length === 0"
      :empty-text="keyword ? '没有匹配的学员' : '你的班级还没有在读学员'"
      :empty-hint="keyword ? '换个姓名、学号或手机号试试' : '学员分到你的班级后会出现在这里'"
      @retry="load(1)"
    >
      <div class="tp-list">
        <RouterLink v-for="stu in students" :key="stu.id" :to="`/teacher/students/${stu.id}`" class="tp-row">
          <TpAvatar :name="stu.name" :seed="stu.id" />
          <span class="tp-row__body">
            <p class="tp-row__title">{{ stu.name }}</p>
            <p class="tp-row__meta">{{ stu.classes.map((c) => c.name).join('、') }}</p>
          </span>
          <span v-if="stu.isLowLessons" class="tp-tag tp-tag-danger tp-num">剩 {{ stu.remainingLessons }} 课时</span>
          <span v-else class="tp-text-meta tp-num tp-shrink-0">剩 {{ stu.remainingLessons }} 课时</span>
          <ChevronRight class="tp-row__chevron" aria-hidden="true" />
        </RouterLink>
      </div>
      <button v-if="students.length < total" type="button" class="tp-btn tp-btn-secondary tp-btn-block" :disabled="loading" @click="load(page + 1)">
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
      <p v-if="error" class="tp-text-small tp-m-0 tp-text-danger tp-text-center" role="alert">{{ error }}</p>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import TpAvatar from './components/TpAvatar.vue'
import { onActivated, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { teacherPortalApi, type TeacherStudentItem } from '@/api'
import LoadState from './components/LoadState.vue'
import PageTitle from './components/PageTitle.vue'
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
