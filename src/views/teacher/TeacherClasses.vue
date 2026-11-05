<template>
  <div>
    <RosterTabs class="mb-3" />
    <SearchBox v-model="keyword" class="mb-3" placeholder="搜索班级名称" @search="classes.load" />

    <LoadState
      :loading="classes.loading.value"
      :error="classes.error.value"
      :has-data="!!classes.data.value"
      :is-empty="classes.data.value?.length === 0"
      :empty-text="keyword ? '没有匹配的班级' : '你还没有授课班级'"
      @retry="classes.load"
    >
      <div class="grid gap-2.5">
        <RouterLink
          v-for="c in classes.data.value"
          :key="c.id"
          :to="`/teacher/classes/${c.id}`"
          class="tp-card block no-underline text-inherit active:bg-st-header"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-[15px] font-medium text-st-title break-words min-w-0">{{ c.name }}</span>
            <span class="tp-tag" :class="c.status === 'completed' ? 'tp-tag-muted' : 'tp-tag-primary'">{{ classStatusLabel(c.status) }}</span>
          </div>
          <p class="m-0 mt-1 text-[13px] text-st-muted break-words">{{ c.courseName }} · {{ c.classroomName }} · {{ c.myRole }}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-st-secondary tabular-nums">
            <span>学员 {{ c.studentCount }}/{{ c.capacity }}</span>
            <span>结课 {{ c.completedLessons }}/{{ c.totalLessons }}</span>
            <span v-if="c.nextLesson">下节 {{ friendlyDate(c.nextLesson.date) }} {{ shortTime(c.nextLesson.startTime) }}</span>
          </div>
        </RouterLink>
      </div>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { teacherPortalApi } from '@/api'
import LoadState from './components/LoadState.vue'
import RosterTabs from './components/RosterTabs.vue'
import SearchBox from './components/SearchBox.vue'
import { usePageRefresh } from './utils/pageRefresh'
import { classStatusLabel, friendlyDate, shortTime } from './utils/format'
import { useLoad } from './utils/useLoad'

const keyword = ref('')

const classes = useLoad(async () => (await teacherPortalApi.getClasses({ keyword: keyword.value.trim() || undefined })).data)

usePageRefresh(classes.load)
onActivated(classes.load)
</script>
