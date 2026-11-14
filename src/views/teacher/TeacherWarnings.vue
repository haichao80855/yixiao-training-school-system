<template>
  <div class="tp-stack">
    <PageTitle title="学员" :overline="warnings.data.value?.summary.total ? `共 ${warnings.data.value.summary.total} 条预警` : ''" />
    <RosterTabs />

    <LoadState :loading="warnings.loading.value" :error="warnings.error.value" :has-data="!!warnings.data.value" @retry="warnings.load">
      <template v-if="warnings.data.value">
        <div class="tp-chips" role="group" aria-label="预警类型筛选">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            class="tp-chip"
            :class="{ 'is-active': filter === f.key }"
            :aria-pressed="filter === f.key"
            @click="filter = f.key"
          >
            {{ f.label }} <span class="tp-count">{{ f.count }}</span>
          </button>
        </div>

        <div v-if="visibleItems.length === 0" class="tp-state">
          <span class="tp-state__icon tp-state__icon--success"><CircleCheck aria-hidden="true" /></span>
          <p class="tp-state__title">暂无需要关注的学员</p>
          <p>课时不足、连续缺勤或长期未到课的学员会出现在这里</p>
        </div>
        <div v-else class="tp-list">
          <article v-for="item in visibleItems" :key="item.id" class="tp-row">
            <RouterLink :to="`/teacher/students/${item.studentId}`" class="warning-person">
              <TpAvatar :name="item.studentName" :seed="item.studentId" />
              <span class="tp-row__body">
                <span class="warning-title">
                  <span class="tp-row__title">{{ item.studentName }}</span>
                  <span class="tp-tag" :class="item.level === 'urgent' ? 'tp-tag-danger' : 'tp-tag-warning'">{{ TYPE_LABELS[item.type] }}</span>
                </span>
                <span class="tp-row__meta tp-block">{{ item.reason }} · {{ item.classNames.join('、') }}</span>
              </span>
            </RouterLink>
            <a :href="`tel:${item.phone}`" class="tp-icon-btn tp-icon-btn--accent" :aria-label="`联系${item.parentName || '家长'}`">
              <Phone aria-hidden="true" />
            </a>
          </article>
        </div>
      </template>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import TpAvatar from './components/TpAvatar.vue'
import { computed, onActivated, ref } from 'vue'
import { CircleCheck, Phone } from 'lucide-vue-next'
import { teacherPortalApi, type WarningType } from '@/api'
import LoadState from './components/LoadState.vue'
import PageTitle from './components/PageTitle.vue'
import RosterTabs from './components/RosterTabs.vue'
import { usePageRefresh } from './utils/pageRefresh'
import { useLoad } from './utils/useLoad'

const TYPE_LABELS: Record<WarningType, string> = {
  low_lessons: '课时不足',
  absence: '连续缺勤',
  inactive: '长期未到课',
}

const filter = ref<'all' | WarningType>('all')
const warnings = useLoad(async () => (await teacherPortalApi.getWarnings()).data)

const filters = computed(() => {
  const s = warnings.data.value?.summary
  return [
    { key: 'all' as const, label: '全部', count: s?.total ?? 0 },
    { key: 'low_lessons' as const, label: TYPE_LABELS.low_lessons, count: s?.low_lessons ?? 0 },
    { key: 'absence' as const, label: TYPE_LABELS.absence, count: s?.absence ?? 0 },
    { key: 'inactive' as const, label: TYPE_LABELS.inactive, count: s?.inactive ?? 0 },
  ]
})

const visibleItems = computed(() =>
  (warnings.data.value?.items || []).filter((i) => filter.value === 'all' || i.type === filter.value),
)

usePageRefresh(warnings.load)
onActivated(warnings.load)
</script>

<style scoped>
.warning-person {
  flex: 1;
  min-width: 0;
  min-height: var(--tp-control);
  display: flex;
  align-items: center;
  gap: var(--tp-space-3);
  color: inherit;
  text-decoration: none;
}
.warning-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tp-space-1) var(--tp-space-2);
}
</style>
