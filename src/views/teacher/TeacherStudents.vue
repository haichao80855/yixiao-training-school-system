<template>
  <div>
    <RosterTabs class="mb-3" />
    <div class="tp-search mb-3">
      <Search />
      <input v-model="keyword" class="tp-input" type="search" placeholder="搜索姓名、学号、手机号" aria-label="搜索学员" @input="onKeywordInput" />
    </div>

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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { teacherPortalApi, type TeacherStudentItem } from '@/api'
import LoadState from './components/LoadState.vue'
import RosterTabs from './components/RosterTabs.vue'

const keyword = ref('')
const students = ref<TeacherStudentItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
let requestId = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function load(targetPage: number) {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const { data } = await teacherPortalApi.getStudents({
      keyword: keyword.value.trim() || undefined,
      page: targetPage,
      pageSize: 20,
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

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(1), 300)
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(() => load(1))
</script>
