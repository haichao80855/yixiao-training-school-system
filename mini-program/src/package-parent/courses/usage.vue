<template>
  <ParentPage title="课时明细" :show-back="true" :show-child-switcher="false">
    <view v-if="loading" class="sk">
      <view class="sk-head" />
      <view class="sk-list" />
    </view>
    <template v-else-if="usage">
      <view class="summary">
        <text class="sum-course">{{ usage.courseName }}</text>
        <view class="sum-row">
          <view class="sum-item">
            <text class="sum-num">{{ usedHours }}</text>
            <text class="sum-label">已消耗课时</text>
          </view>
          <view class="sum-divider" />
          <view class="sum-item">
            <text class="sum-num">{{ lessonCount }}</text>
            <text class="sum-label">上课次数</text>
          </view>
          <view v-if="returnedHours" class="sum-divider" />
          <view v-if="returnedHours" class="sum-item">
            <text class="sum-num mint">{{ returnedHours }}</text>
            <text class="sum-label">已退回</text>
          </view>
        </view>
      </view>

      <EmptyState v-if="usage.entries.length === 0" icon="clock" title="还没有消耗课时" />
      <view v-else class="entries">
        <view
          v-for="(e, idx) in usage.entries"
          :key="idx"
          class="entry"
          :class="{ returned: e.returned }"
          :style="enterDelay(idx)"
        >
          <view class="entry-date">
            <text class="d-day">{{ e.date ? Number(e.date.slice(8)) : '–' }}</text>
            <text class="d-month">{{ e.date ? Number(e.date.slice(5, 7)) + '月' : '' }}</text>
          </view>
          <view class="entry-main">
            <text class="entry-title">{{ e.lessonTitle || usage.courseName }}</text>
            <text class="entry-sub">
              {{ e.timeSlot }} · {{ ATTENDANCE_LABEL[e.attendance] || e.attendance }}<text v-if="e.returned"> · 课时已退回</text>
            </text>
          </view>
          <text class="delta">{{ e.returned ? '+' : '−' }}{{ e.hours }}</text>
        </view>
      </view>
    </template>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import { parentApi, type CourseUsage } from '../../api/parent';
import { ATTENDANCE_LABEL } from '../utils/format';
import { enterDelay } from '../utils/visual';

const usage = ref<CourseUsage | null>(null);
const loading = ref(true);

const usedHours = computed(() => (usage.value?.entries || []).filter((e) => !e.returned).reduce((s, e) => s + e.hours, 0));
const returnedHours = computed(() => (usage.value?.entries || []).filter((e) => e.returned).reduce((s, e) => s + e.hours, 0));
const lessonCount = computed(() => (usage.value?.entries || []).filter((e) => !e.returned && e.hours > 0).length);

onLoad(async (query: any) => {
  try {
    usage.value = await parentApi.courseUsage(decodeURIComponent(query?.sid || ''), decodeURIComponent(query?.pid || ''));
  } catch {
    usage.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.summary {
  @include p-card;
  padding: 32rpx;
  margin: 8rpx 0 28rpx;
  animation: p-fade-up 0.4s $p-ease-out both;
}

.sum-course {
  display: block;
  font-size: 30rpx;
  font-weight: 650;
}

.sum-row {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
}

.sum-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.sum-num {
  @include p-num;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.1;

  &.mint {
    color: $p-mint;
  }
}

.sum-label {
  font-size: 22rpx;
  color: $p-ink-3;
}

.sum-divider {
  width: 2rpx;
  height: 56rpx;
  margin: 0 28rpx;
  background: $p-line;
}

.entries {
  @include p-card;
  padding: 0 28rpx;
}

.entry {
  @include p-enter;
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 26rpx 0;
  border-bottom: 2rpx solid $p-line;

  &:last-child {
    border-bottom: none;
  }
}

.entry-date {
  width: 76rpx;
  height: 84rpx;
  border-radius: 20rpx;
  background: $p-canvas;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .d-day {
    @include p-num;
    font-size: 32rpx;
    font-weight: 700;
    line-height: 1.1;
  }

  .d-month {
    font-size: 19rpx;
    color: $p-ink-3;
  }
}

.entry-main {
  flex: 1;
  min-width: 0;
}

.entry-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 23rpx;
  color: $p-ink-3;
}

.delta {
  @include p-num;
  font-size: 34rpx;
  font-weight: 700;
  color: $p-ink;
}

.returned {
  .delta {
    color: $p-mint;
  }

  .d-day {
    color: $p-mint;
  }
}

.sk-head {
  @include p-skeleton;
  height: 220rpx;
  border-radius: $p-r-card;
  margin: 8rpx 0 28rpx;
}

.sk-list {
  @include p-skeleton;
  height: 520rpx;
  border-radius: $p-r-card;
}
</style>
