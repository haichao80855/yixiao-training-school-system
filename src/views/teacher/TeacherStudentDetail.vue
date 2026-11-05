<template>
  <LoadState :loading="detail.loading.value" :error="detail.error.value" :has-data="!!stu" @retry="detail.load">
    <template v-if="stu">
      <section class="tp-card">
        <div class="flex items-center justify-between gap-2">
          <p class="m-0 text-[17px] font-semibold text-st-title break-words min-w-0">{{ stu.name }}</p>
          <span class="tp-tag" :class="stu.status === 'normal' ? 'tp-tag-success' : 'tp-tag-muted'">{{ studentStatusLabel(stu.status) }}</span>
        </div>
        <dl class="info-list">
          <dt>学号</dt><dd class="tabular-nums">{{ stu.studentNo }}</dd>
          <template v-if="stu.parentName"><dt>家长</dt><dd>{{ stu.parentName }}</dd></template>
          <template v-if="stu.school"><dt>学校</dt><dd>{{ stu.school }}</dd></template>
          <template v-if="stu.birthday"><dt>生日</dt><dd class="tabular-nums">{{ dateOnly(stu.birthday) }}</dd></template>
        </dl>
        <a :href="`tel:${stu.phone}`" class="tp-btn tp-btn-secondary w-full mt-3"><Phone class="w-4 h-4" />联系家长 {{ stu.phone }}</a>
      </section>

      <h2 class="tp-section-title">在读课程</h2>
      <p v-if="stu.courses.length === 0" class="tp-card m-0 text-center text-st-muted text-[14px]">暂无课程</p>
      <div class="grid gap-2">
        <component
          :is="c.classId ? RouterLink : 'div'"
          v-for="c in stu.courses"
          :key="c.id"
          :to="c.classId ? `/teacher/classes/${c.classId}` : undefined"
          class="tp-card block no-underline text-inherit"
        >
          <p class="m-0 text-[15px] font-medium text-st-title break-words">{{ c.courseName }}</p>
          <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">{{ c.className }}</p>
          <p class="m-0 mt-1.5 text-[13px] text-st-secondary tabular-nums">
            剩余 {{ c.remainingLessons }} · 已上 {{ c.consumedLessons }} · 共 {{ c.totalLessons }} 课时
          </p>
        </component>
      </div>

      <h2 class="tp-section-title">我的上课记录</h2>
      <p v-if="stu.attendances.length === 0" class="tp-card m-0 text-center text-st-muted text-[14px]">暂无上课记录</p>
      <div class="grid gap-2">
        <RouterLink
          v-for="a in stu.attendances"
          :key="a.id"
          :to="`/teacher/lessons/${a.scheduleId}/${a.isEvaluated ? 'review' : 'evaluate'}/${stu.id}`"
          class="tp-card flex items-center gap-3 no-underline text-inherit"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-[14px] font-medium text-st-title tabular-nums">{{ friendlyDate(a.date) }} {{ shortTime(a.startTime) }}</p>
            <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">
              {{ a.className }} · 扣 {{ a.deductLessons }} 课时 · {{ a.isEvaluated ? '已推送课评' : '未写课评' }}
            </p>
          </div>
          <span class="tp-tag" :class="attendanceClass(a.status)">{{ attendanceLabel(a.status) }}</span>
        </RouterLink>
      </div>
    </template>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Phone } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import LoadState from './components/LoadState.vue'
import { attendanceLabel, dateOnly, friendlyDate, shortTime, studentStatusLabel } from './utils/format'
import { useLoad } from './utils/useLoad'

const route = useRoute()
const detail = useLoad(async () => (await teacherPortalApi.getStudentDetail(route.params.id as string)).data)
const stu = computed(() => detail.data.value)

function attendanceClass(status: string) {
  if (status === 'present') return 'tp-tag-success'
  if (status === 'absent') return 'tp-tag-danger'
  if (status === 'late') return 'tp-tag-warning'
  return 'tp-tag-muted'
}

onMounted(detail.load)
</script>

<style scoped>
.info-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 10px 0 0;
  font-size: 14px;
}
.info-list dt {
  color: var(--st-color-muted);
}
.info-list dd {
  margin: 0;
  color: var(--st-color-regular);
  word-break: break-word;
}
</style>
