<template>
  <ParentPage title="课表" :overline="monthText" tab="schedule">
    <EmptyState
      v-if="parentStore.isReadOnly"
      icon="calendar"
      title="课表已停止更新"
      description="孩子已离校，可以在「课评」和「成长」里回看历史记录"
    />

    <template v-else>
      <!-- 下一节课 -->
      <view v-if="nextLesson" class="next-card" @click="jumpTo(nextLesson.date)">
        <view class="next-glow" />
        <text class="next-label">下一节课</text>
        <text class="next-course">{{ nextLesson.courseName || '课程' }}</text>
        <text class="next-meta">
          {{ formatDateCn(nextLesson.date) }} · {{ nextLesson.startTime }}<text v-if="nextLesson.classroomName"> · {{ nextLesson.classroomName }}</text>
        </text>
        <view class="next-countdown">
          <template v-if="nextDays > 0">
            <text class="cd-num">{{ nextDays }}</text>
            <text class="cd-unit">天后</text>
          </template>
          <text v-else class="cd-today">今天</text>
        </view>
      </view>

      <!-- 周切换 -->
      <view class="week-head">
        <text class="week-label">{{ weekLabel }}</text>
        <view class="week-nav">
          <text v-if="weekStart !== thisWeek" class="today-link" @click="goToday">本周</text>
          <view class="nav-btn" @click="shiftWeek(-7)">
            <view class="rot-left"><AppIcon name="chevron-down" size="28rpx" color="#5C5751" /></view>
          </view>
          <view class="nav-btn" @click="shiftWeek(7)">
            <view class="rot-right"><AppIcon name="chevron-down" size="28rpx" color="#5C5751" /></view>
          </view>
        </view>
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

      <view v-if="loading" class="tl-skeleton">
        <view v-for="i in 2" :key="i" class="sk-row" />
      </view>
      <EmptyState v-else-if="dayLessons.length === 0" icon="calendar" title="这一天没有课" description="选择带圆点的日期查看课程" />
      <view v-else class="timeline">
        <view
          v-for="(lesson, idx) in dayLessons"
          :key="lesson.scheduleEventId"
          class="tl-item"
          :class="['st-' + lesson.status]"
          :style="enterDelay(idx)"
        >
          <view class="tl-time">
            <text class="t-start">{{ lesson.startTime }}</text>
            <text class="t-end">{{ lesson.endTime }}</text>
          </view>
          <view class="tl-rail">
            <view class="knot" />
          </view>
          <view class="tl-card" @click="openLesson(lesson)">
            <text class="course">{{ lesson.courseName || '课程' }}</text>
            <text class="sub">{{ [lesson.classroomName, lesson.teacherName].filter(Boolean).join(' · ') }}</text>
            <view class="card-foot">
              <view class="chips">
                <text class="chip" :class="'c-' + lesson.status">{{ statusText(lesson) }}</text>
                <text v-if="lesson.classType === 'make_up'" class="chip c-info">补课</text>
                <text v-if="lesson.classType === 'trial'" class="chip c-info">试听</text>
              </view>
              <view v-if="lesson.evaluationReady" class="eval-link">
                <text>看课评</text>
                <AppIcon name="chevron-right" size="24rpx" color="#2F54EB" />
              </view>
            </view>
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
import { addDaysIso, todayIso, weekStartIso, formatDateCn, daysFromToday, ATTENDANCE_LABEL } from '../utils/format';
import { enterDelay } from '../utils/visual';

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'];

const parentStore = useParentStore();
const today = todayIso();
const thisWeek = weekStartIso(today);
const weekStart = ref(thisWeek);
const selected = ref(today);
const lessons = ref<ScheduleLesson[]>([]);
const nextLesson = ref<ScheduleLesson | null>(null);
const loading = ref(false);

const monthText = computed(() => {
  const [y, m] = selected.value.split('-');
  return `${y}年${Number(m)}月`;
});

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart.value, i);
    return { date, weekday: WEEKDAY[i], num: Number(date.slice(8)), count: lessons.value.filter((l) => l.date === date).length };
  }),
);

const weekLabel = computed(() => {
  const end = addDaysIso(weekStart.value, 6);
  const fmt = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
  return `${fmt(weekStart.value)} – ${fmt(end)}`;
});

const dayLessons = computed(() => lessons.value.filter((l) => l.date === selected.value));
const nextDays = computed(() => (nextLesson.value ? daysFromToday(nextLesson.value.date) : 0));

async function loadWeek() {
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

/** 未来 4 周内的下一节课 (顶部卡片) */
async function loadNext() {
  const sid = parentStore.currentStudentId;
  if (!sid || parentStore.isReadOnly) return;
  try {
    const res = await parentApi.schedule(sid, today, addDaysIso(today, 27));
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    nextLesson.value =
      res.lessons.find((l) => l.status === 'upcoming' && (l.date > today || l.startTime >= hhmm)) || null;
  } catch {
    nextLesson.value = null;
  }
}

function shiftWeek(delta: number) {
  weekStart.value = addDaysIso(weekStart.value, delta);
  selected.value = weekStart.value;
  loadWeek().then(() => {
    selected.value = lessons.value[0]?.date || weekStart.value;
  });
}

function goToday() {
  weekStart.value = thisWeek;
  selected.value = today;
  loadWeek();
}

function jumpTo(date: string) {
  const start = weekStartIso(date);
  selected.value = date;
  if (start !== weekStart.value) {
    weekStart.value = start;
    loadWeek();
  }
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

function reload() {
  loadWeek();
  loadNext();
}

onShow(reload);
watch(() => parentStore.currentStudentId, reload);
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

/* 下一节课 */
.next-card {
  @include p-pressable;
  position: relative;
  overflow: hidden;
  padding: 32rpx 32rpx 36rpx;
  margin-bottom: 40rpx;
  border-radius: $p-r-card;
  background: #1D1B18;
  color: #FFFFFF;
  box-shadow: 0 24rpx 48rpx -24rpx rgba(29, 27, 24, 0.55);
  animation: p-fade-up 0.45s $p-ease-out both;
}

.next-glow {
  position: absolute;
  right: -80rpx;
  top: -100rpx;
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(91, 123, 255, 0.6) 0%, rgba(91, 123, 255, 0) 70%);
}

.next-label {
  display: block;
  font-size: 22rpx;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
}

.next-course {
  display: block;
  margin-top: 12rpx;
  padding-right: 150rpx;
  font-size: 38rpx;
  font-weight: 650;
  line-height: 1.3;
}

.next-meta {
  display: block;
  margin-top: 8rpx;
  padding-right: 150rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.7);
}

.next-countdown {
  position: absolute;
  right: 32rpx;
  bottom: 30rpx;
  display: flex;
  align-items: baseline;
  gap: 4rpx;

  .cd-num {
    @include p-num;
    font-size: 72rpx;
    font-weight: 700;
    line-height: 1;
  }

  .cd-unit {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.7);
  }

  .cd-today {
    padding: 8rpx 20rpx;
    border-radius: 9999rpx;
    background: rgba(255, 255, 255, 0.16);
    font-size: 26rpx;
    font-weight: 600;
  }
}

/* 周切换 */
.week-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4rpx 16rpx;
}

.week-label {
  font-size: 28rpx;
  font-weight: 650;
  color: $p-ink;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.today-link {
  margin-right: 8rpx;
  font-size: 25rpx;
  color: $p-brand;
}

.nav-btn {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: $p-surface;
  box-shadow: $p-shadow;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    transform: scale(0.92);
  }
}

.rot-left,
.rot-right {
  display: flex;
}

.rot-left {
  transform: rotate(90deg);
}

.rot-right {
  transform: rotate(-90deg);
}

.week-strip {
  @include p-card;
  display: flex;
  justify-content: space-between;
  padding: 16rpx 12rpx;
  margin-bottom: 40rpx;
}

.day {
  width: 84rpx;
  padding: 16rpx 0 14rpx;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  transition: background-color 0.24s $p-ease-out;

  .weekday {
    font-size: 22rpx;
    color: $p-ink-3;
  }

  .day-num {
    @include p-num;
    font-size: 34rpx;
    font-weight: 650;
    color: $p-ink;
  }

  &.today .day-num {
    color: $p-brand;
  }

  &.selected {
    background: $p-ink;
    animation: day-pick 0.3s $p-ease-spring both;

    .weekday {
      color: rgba(255, 255, 255, 0.6);
    }

    .day-num {
      color: #FFFFFF;
    }

    .day-dot.visible {
      background: #FFFFFF;
    }
  }
}

@keyframes day-pick {
  from {
    transform: scale(0.9);
  }
  to {
    transform: scale(1);
  }
}

.day-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;

  &.visible {
    background: $p-brand;
  }
}

/* 时间轴 */
.timeline {
  display: flex;
  flex-direction: column;
}

.tl-item {
  @include p-enter;
  display: flex;
  align-items: stretch;
}

.tl-time {
  width: 88rpx;
  padding-top: 26rpx;
  text-align: right;
  flex-shrink: 0;

  .t-start {
    @include p-num;
    display: block;
    font-size: 28rpx;
    font-weight: 700;
    color: $p-ink;
  }

  .t-end {
    @include p-num;
    display: block;
    font-size: 22rpx;
    color: $p-ink-3;
  }
}

.tl-rail {
  position: relative;
  width: 44rpx;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    left: 21rpx;
    top: 0;
    bottom: 0;
    width: 2rpx;
    background: repeating-linear-gradient(180deg, rgba(29, 27, 24, 0.14) 0 8rpx, transparent 8rpx 16rpx);
  }

  .knot {
    position: absolute;
    left: 13rpx;
    top: 34rpx;
    width: 18rpx;
    height: 18rpx;
    border-radius: 50%;
    background: $p-surface;
    border: 4rpx solid $p-brand;
    box-sizing: border-box;
  }
}

.tl-item.st-cancelled .knot,
.tl-item.st-not_recorded .knot {
  border-color: #CFC8BE;
}

.tl-item.st-present .knot {
  background: $p-mint;
  border-color: $p-mint;
}

.tl-card {
  @include p-card;
  @include p-pressable;
  flex: 1;
  min-width: 0;
  padding: 26rpx 28rpx;
  margin-bottom: 24rpx;

  .course {
    display: block;
    font-size: 30rpx;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    display: block;
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $p-ink-3;
  }
}

.st-cancelled .tl-card {
  opacity: 0.55;

  .course {
    text-decoration: line-through;
  }
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
}

.chips {
  display: flex;
  gap: 10rpx;
}

.chip {
  @include p-chip;
  height: 40rpx;
  font-size: 21rpx;
  background: $p-fill;
  color: $p-ink-2;

  &.c-present {
    background: $p-mint-50;
    color: $p-mint;
  }

  &.c-leave {
    background: $p-peach-50;
    color: #B4501F;
  }

  &.c-absent {
    background: $p-rose-50;
    color: $p-rose;
  }

  &.c-upcoming,
  &.c-info {
    background: $p-brand-50;
    color: $p-brand;
  }
}

.eval-link {
  display: flex;
  align-items: center;
  gap: 2rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: $p-brand;
}

.tl-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-left: 132rpx;
}

.sk-row {
  @include p-skeleton;
  height: 180rpx;
  border-radius: $p-r-card;
}
</style>
