<template>
  <LoadState :loading="detail.loading.value" :error="detail.error.value" :has-data="!!stu" @retry="detail.load">
    <div v-if="stu" class="tp-stack tp-stack--loose">
      <section class="tp-card">
        <div class="profile">
          <span class="tp-avatar profile__avatar" aria-hidden="true">{{ stu.name.slice(0, 1) }}</span>
          <div style="flex: 1; min-width: 0">
            <h2 class="profile__name">{{ stu.name }}</h2>
            <p class="tp-text-meta tp-num" style="margin: 2px 0 0">{{ stu.studentNo }}</p>
          </div>
          <span class="tp-tag" :class="stu.status === 'normal' ? 'tp-tag-success' : 'tp-tag-muted'">{{ studentStatusLabel(stu.status) }}</span>
        </div>
        <dl class="info-list">
          <template v-if="stu.parentName"><dt>家长</dt><dd>{{ stu.parentName }}</dd></template>
          <template v-if="stu.school"><dt>学校</dt><dd>{{ stu.school }}</dd></template>
          <template v-if="stu.birthday"><dt>生日</dt><dd class="tp-num">{{ dateOnly(stu.birthday) }}</dd></template>
        </dl>
        <a :href="`tel:${stu.phone}`" class="tp-btn tp-btn-secondary tp-btn-block" style="margin-top: 12px">
          <Phone aria-hidden="true" />联系家长 <span class="tp-num">{{ stu.phone }}</span>
        </a>
      </section>

      <section>
        <div class="tp-section-head"><h2 class="tp-section-title">在读课程</h2></div>
        <p v-if="stu.courses.length === 0" class="tp-state">暂无课程</p>
        <div v-else class="tp-list">
          <component
            :is="c.classId ? RouterLink : 'div'"
            v-for="c in stu.courses"
            :key="c.id"
            :to="c.classId ? `/teacher/classes/${c.classId}` : undefined"
            class="tp-row"
          >
            <span class="tp-row__body">
              <p class="tp-row__title">{{ c.courseName }}</p>
              <p class="tp-row__meta">{{ c.className }}</p>
              <p class="tp-row__meta tp-num">剩余 {{ c.remainingLessons }} · 已上 {{ c.consumedLessons }} · 共 {{ c.totalLessons }} 课时</p>
            </span>
            <ChevronRight v-if="c.classId" class="tp-row__chevron" aria-hidden="true" />
          </component>
        </div>
      </section>

      <section>
        <div class="tp-section-head"><h2 class="tp-section-title">我的上课记录</h2></div>
        <p v-if="stu.attendances.length === 0" class="tp-state">暂无上课记录</p>
        <div v-else class="tp-list">
          <RouterLink
            v-for="a in stu.attendances"
            :key="a.id"
            :to="`/teacher/lessons/${a.scheduleId}/${a.isEvaluated ? 'review' : 'evaluate'}/${stu.id}`"
            class="tp-row"
          >
            <span class="tp-row__body">
              <p class="tp-row__title tp-num">{{ friendlyDate(a.date) }} {{ shortTime(a.startTime) }}</p>
              <p class="tp-row__meta">{{ a.className }} · {{ a.isEvaluated ? '已推送课评' : '未写课评' }}</p>
            </span>
            <span class="tp-tag" :class="attendanceClass(a.status)">{{ attendanceLabel(a.status) }}</span>
            <ChevronRight class="tp-row__chevron" aria-hidden="true" />
          </RouterLink>
        </div>
      </section>
    </div>
  </LoadState>
</template>

<script setup lang="ts">
import { computed, onActivated } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight, Phone } from 'lucide-vue-next'
import { teacherPortalApi } from '@/api'
import LoadState from './components/LoadState.vue'
import { attendanceLabel, dateOnly, friendlyDate, shortTime, studentStatusLabel } from './utils/format'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const route = useRoute()
// 页面被缓存时 useRoute 会跟着后续路由变化，id 只在创建时读取一次
const studentId = route.params.id as string
const detail = useLoad(async () => (await teacherPortalApi.getStudentDetail(studentId)).data)
const stu = computed(() => detail.data.value)

function attendanceClass(status: string) {
  if (status === 'present') return 'tp-tag-muted'
  if (status === 'absent') return 'tp-tag-danger'
  if (status === 'late') return 'tp-tag-warning'
  return 'tp-tag-primary'
}

usePageRefresh(detail.load)
onActivated(detail.load)
</script>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
}
.profile__avatar {
  width: 44px;
  height: 44px;
  font-size: var(--tp-fs-title);
}
.profile__name {
  margin: 0;
  font-size: var(--tp-fs-title);
  font-weight: 600;
  line-height: var(--tp-lh-tight);
  overflow-wrap: anywhere;
}
.info-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--tp-space-1) var(--tp-space-3);
  margin: var(--tp-space-3) 0 0;
  font-size: 14px;
}
.info-list:empty {
  display: none;
}
.info-list dt {
  color: var(--tp-text-3);
}
.info-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
