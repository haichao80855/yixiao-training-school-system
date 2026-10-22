<template>
  <ParentPage title="课表" tab="schedule">
    <EmptyState
      v-if="parentStore.isReadOnly"
      icon="calendar"
      title="课表已停止更新"
      description="孩子已离校，可在「课评」和「成长」中查看历史记录"
    />

    <template v-else>
      <!-- 周切换 -->
      <view class="week-nav">
        <view class="nav-btn" @click="shiftWeek(-7)">
          <AppIcon name="chevron-down" size="32rpx" color="#475569" custom-class="rotate-left" />
        </view>
        <text class="week-label">{{ weekLabel }}</text>
        <view class="nav-btn" @click="shiftWeek(7)">
          <AppIcon name="chevron-down" size="32rpx" color="#475569" custom-class="rotate-right" />
        </view>
        <text v-if="weekStart !== thisWeek" class="today-btn" @click="goToday">回到本周</text>
      </view>

      <view class="week-strip">
        <view
          v-for="day in days"
          :key="day.date"
          class="day"
          :class="{ selected: day.date === selected, today: day.date === today }"
          @click="selected = day.date"
        >
          <text class="weekday">{{ day.weekday }}</text>
          <text class="day-num">{{ day.num }}</text>
          <view class="day-dot" :class="{ visible: day.count > 0 }" />
        </view>
      </view>

      <view v-if="loading" class="hint">加载中…</view>
      <EmptyState
        v-else-if="dayLessons.length === 0"
        icon="calendar"
        title="这一天没有课"
      />
      <view v-else class="lesson-list">
        <view
          v-for="lesson in dayLessons"
          :key="lesson.scheduleEventId"
          class="lesson"
          :class="{ cancelled: lesson.status === 'cancelled' }"
          @click="openLesson(lesson)"
        >
          <view class="time-col">
            <text class="start">{{ lesson.startTime }}</text>
            <text class="end">{{ lesson.endTime }}</text>
          </view>
          <view class="info-col">
            <text class="course">{{ lesson.courseName || '课程' }}</text>
            <text class="sub">{{ [lesson.classroomName, lesson.teacherName].filter(Boolean).join(' · ') }}</text>
            <view class="chips">
              <text class="chip" :class="'st-' + lesson.status">{{ statusText(lesson) }}</text>
              <text v-if="lesson.classType === 'make_up'" class="chip st-info">补课</text>
              <text v-if="lesson.classType === 'trial'" class="chip st-info">试听</text>
            </view>
          </view>
          <view v-if="lesson.evaluationReady" class="eval-link">
            <text>看课评</text>
            <AppIcon name="chevron-right" size="28rpx" color="#2F54EB" />
          </view>
        </view>
      </view>
    </template>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, type ScheduleLesson } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { addDaysIso, todayIso, weekStartIso, ATTENDANCE_LABEL } from '../utils/format';

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'];

const parentStore = useParentStore();
const today = todayIso();
const thisWeek = weekStartIso(today);
const weekStart = ref(thisWeek);
const selected = ref(today);
const lessons = ref<ScheduleLesson[]>([]);
const loading = ref(false);

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart.value, i);
    return {
      date,
      weekday: WEEKDAY[i],
      num: Number(date.slice(8)),
      count: lessons.value.filter((l) => l.date === date).length,
    };
  }),
);

const weekLabel = computed(() => {
  const end = addDaysIso(weekStart.value, 6);
  const fmt = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
  return `${fmt(weekStart.value)} – ${fmt(end)}`;
});

const dayLessons = computed(() => lessons.value.filter((l) => l.date === selected.value));

async function load() {
  const sid = parentStore.currentStudentId;
  if (!sid || parentStore.isReadOnly) return;
  loading.value = true;
  try {
    const res = await parentApi.schedule(sid, weekStart.value, addDaysIso(weekStart.value, 6));
    if (sid === parentStore.currentStudentId) lessons.value = res.lessons;
  } catch {
    lessons.value = [];
  } finally {
    loading.value = false;
  }
}

function shiftWeek(delta: number) {
  weekStart.value = addDaysIso(weekStart.value, delta);
  selected.value = weekStart.value;
  load().then(() => {
    // 切换周后默认选中该周第一个有课的日期
    selected.value = lessons.value[0]?.date || weekStart.value;
  });
}

function goToday() {
  weekStart.value = thisWeek;
  selected.value = today;
  load();
}

function statusText(lesson: ScheduleLesson) {
  if (lesson.status === 'present' && lesson.isLate) return '迟到';
  return ATTENDANCE_LABEL[lesson.status] || lesson.status;
}

function openLesson(lesson: ScheduleLesson) {
  if (!lesson.evaluationReady) return;
  uni.navigateTo({
    url: `/package-parent/evaluations/detail?sid=${encodeURIComponent(parentStore.currentStudentId)}&eid=${encodeURIComponent(lesson.scheduleEventId)}`,
  });
}

onShow(load);
watch(() => parentStore.currentStudentId, load);
</script>

<style lang="scss" scoped>
.week-nav {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;

  .week-label {
    font-size: 30rpx;
    font-weight: 600;
    color: #0F172A;
  }

  .today-btn {
    margin-left: auto;
    font-size: 26rpx;
    color: #2F54EB;
  }
}

.nav-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.rotate-left) {
  transform: rotate(90deg);
}

:deep(.rotate-right) {
  transform: rotate(-90deg);
}

.week-strip {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 8rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
}

.day {
  width: 84rpx;
  padding: 12rpx 0;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;

  .weekday {
    font-size: 22rpx;
    color: #64748B;
  }

  .day-num {
    font-size: 32rpx;
    font-weight: 600;
    color: #0F172A;
  }

  &.today .day-num {
    color: #2F54EB;
  }

  &.selected {
    background: #2F54EB;

    .weekday,
    .day-num {
      color: #FFFFFF;
    }

    .day-dot.visible {
      background: #FFFFFF;
    }
  }
}

.day-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: transparent;

  &.visible {
    background: #2F54EB;
  }
}

.hint {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #94A3B8;
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.lesson {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx;
  background: #FFFFFF;
  border-radius: 24rpx;

  &.cancelled {
    opacity: 0.55;

    .course {
      text-decoration: line-through;
    }
  }
}

.time-col {
  width: 96rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 24rpx;
  border-right: 1rpx solid rgba(15, 23, 42, 0.08);

  .start {
    font-size: 30rpx;
    font-weight: 700;
    color: #0F172A;
  }

  .end {
    font-size: 24rpx;
    color: #94A3B8;
  }
}

.info-col {
  flex: 1;
  min-width: 0;

  .course {
    display: block;
    font-size: 30rpx;
    font-weight: 600;
    color: #0F172A;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    display: block;
    margin-top: 6rpx;
    font-size: 24rpx;
    color: #64748B;
  }
}

.chips {
  display: flex;
  gap: 10rpx;
  margin-top: 12rpx;
}

.chip {
  padding: 2rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  background: #F1F5F9;
  color: #475569;

  &.st-present {
    background: #ECFDF3;
    color: #15803D;
  }

  &.st-leave {
    background: #FFF7E8;
    color: #B45309;
  }

  &.st-absent {
    background: #FEF2F2;
    color: #B91C1C;
  }

  &.st-upcoming,
  &.st-info {
    background: #EEF2FF;
    color: #2F54EB;
  }
}

.eval-link {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  color: #2F54EB;
  flex-shrink: 0;
}
</style>
