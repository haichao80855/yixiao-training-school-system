<template>
  <div class="tp-stack">
    <RosterTabs />
    <SearchBox v-model="keyword" placeholder="搜索班级名称" @search="classes.load" />

    <LoadState
      :loading="classes.loading.value"
      :error="classes.error.value"
      :has-data="!!classes.data.value"
      :is-empty="classes.data.value?.length === 0"
      :empty-text="keyword ? '没有匹配的班级' : '你还没有授课班级'"
      @retry="classes.load"
    >
      <div class="tp-list">
        <RouterLink v-for="c in classes.data.value" :key="c.id" :to="`/teacher/classes/${c.id}`" class="tp-row">
          <span class="tp-row__body">
            <p class="tp-row__title">{{ c.name }}</p>
            <p class="tp-row__meta">
              {{ c.courseName }} · {{ c.myRole }} · {{ c.studentCount }}/{{ c.capacity }} 人
            </p>
            <div class="class-progress">
              <span
                class="tp-progress"
                role="progressbar"
                :aria-valuenow="c.completedLessons"
                :aria-valuemax="c.totalLessons"
                aria-label="课次进度"
              >
                <i :style="{ width: c.totalLessons ? `${(c.completedLessons / c.totalLessons) * 100}%` : '0' }" />
              </span>
              <span class="tp-text-meta tp-num">{{ c.completedLessons }}/{{ c.totalLessons }} 节</span>
            </div>
            <p v-if="c.nextLesson" class="tp-row__meta tp-num">下节 {{ friendlyDate(c.nextLesson.date) }} {{ shortTime(c.nextLesson.startTime) }}</p>
          </span>
          <span v-if="c.status === 'completed'" class="tp-tag tp-tag-muted">{{ classStatusLabel(c.status) }}</span>
          <ChevronRight class="tp-row__chevron" aria-hidden="true" />
        </RouterLink>
      </div>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
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

<style scoped>
.class-progress {
  display: flex;
  align-items: center;
  gap: var(--tp-space-2);
  margin-top: var(--tp-space-2);
}
.class-progress .tp-progress {
  flex: 1;
  max-width: 200px;
}
</style>
