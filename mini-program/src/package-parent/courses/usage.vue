<template>
  <ParentPage title="课时明细" :show-back="true" :show-child-switcher="false">
    <view v-if="loading" class="hint">加载中…</view>
    <template v-else-if="usage">
      <text class="course-name">{{ usage.courseName }}</text>
      <EmptyState v-if="usage.entries.length === 0" icon="clock" title="还没有消耗课时" />
      <view v-else class="entries">
        <view v-for="(e, idx) in usage.entries" :key="idx" class="entry" :class="{ returned: e.returned }">
          <view class="entry-main">
            <text class="entry-date">{{ formatDateCn(e.date) }} <text class="slot">{{ e.timeSlot }}</text></text>
            <text v-if="e.lessonTitle" class="entry-title">{{ e.lessonTitle }}</text>
            <text class="entry-att">{{ ATTENDANCE_LABEL[e.attendance] || e.attendance }}</text>
          </view>
          <view class="entry-hours">
            <text class="delta">{{ e.returned ? '+' : '−' }}{{ e.hours }}</text>
            <text v-if="e.returned" class="returned-label">已退回</text>
          </view>
        </view>
      </view>
    </template>
  </ParentPage>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import { parentApi, type CourseUsage } from '../../api/parent';
import { formatDateCn, ATTENDANCE_LABEL } from '../utils/format';

const usage = ref<CourseUsage | null>(null);
const loading = ref(true);

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
.hint {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #94A3B8;
}

.course-name {
  display: block;
  margin: 8rpx 4rpx 24rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #0F172A;
}

.entries {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 0 28rpx;
}

.entry {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 0;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);

  &:last-child {
    border-bottom: none;
  }
}

.entry-main {
  flex: 1;
  min-width: 0;

  .entry-date {
    display: block;
    font-size: 28rpx;
    color: #0F172A;

    .slot {
      color: #94A3B8;
      font-size: 24rpx;
    }
  }

  .entry-title {
    display: block;
    margin-top: 6rpx;
    font-size: 26rpx;
    color: #334155;
  }

  .entry-att {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: #64748B;
  }
}

.entry-hours {
  text-align: right;

  .delta {
    display: block;
    font-size: 32rpx;
    font-weight: 600;
    color: #0F172A;
    font-variant-numeric: tabular-nums;
  }

  .returned-label {
    font-size: 22rpx;
    color: #15803D;
  }
}

.returned .delta {
  color: #15803D;
}
</style>
