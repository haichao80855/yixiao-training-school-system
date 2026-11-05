<template>
  <div>
    <RosterTabs class="mb-3" />

    <LoadState :loading="warnings.loading.value" :error="warnings.error.value" :has-data="!!warnings.data.value" @retry="warnings.load">
      <template v-if="warnings.data.value">
        <div class="flex gap-2 overflow-x-auto pb-1 mb-2" role="group" aria-label="预警类型筛选">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            class="tp-btn tp-btn-sm shrink-0"
            :class="filter === f.key ? 'tp-btn-primary' : 'tp-btn-secondary'"
            :aria-pressed="filter === f.key"
            @click="filter = f.key"
          >
            {{ f.label }} {{ f.count }}
          </button>
        </div>

        <div v-if="visibleItems.length === 0" class="py-12 text-center text-st-muted text-[14px]">暂无需要关注的学员</div>
        <div class="grid gap-2.5">
          <article v-for="item in visibleItems" :key="item.id" class="tp-card">
            <div class="flex items-center justify-between gap-2">
              <RouterLink :to="`/teacher/students/${item.studentId}`" class="min-h-[44px] py-2.5 -my-2.5 flex-1 text-[15px] font-medium text-st-title no-underline break-words min-w-0">
                {{ item.studentName }}
                <span class="text-[12px] font-normal text-st-muted tabular-nums">{{ item.studentNo }}</span>
              </RouterLink>
              <span class="tp-tag" :class="item.level === 'urgent' ? 'tp-tag-danger' : 'tp-tag-warning'">{{ TYPE_LABELS[item.type] }}</span>
            </div>
            <p class="m-0 mt-1.5 text-[14px] text-st-regular">{{ item.reason }}</p>
            <p class="m-0 mt-0.5 text-[13px] text-st-muted break-words">{{ item.classNames.join('、') }}</p>
            <a :href="`tel:${item.phone}`" class="tp-btn tp-btn-secondary tp-btn-sm mt-2.5">
              <Phone class="w-4 h-4" />联系{{ item.parentName || '家长' }}
            </a>
          </article>
        </div>
      </template>
    </LoadState>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { Phone } from 'lucide-vue-next'
import { teacherPortalApi, type WarningType } from '@/api'
import LoadState from './components/LoadState.vue'
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
