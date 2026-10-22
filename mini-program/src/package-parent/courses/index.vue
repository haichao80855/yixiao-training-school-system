<template>
  <ParentPage title="课程" tab="courses">
    <EmptyState
      v-if="parentStore.isReadOnly"
      icon="book-open"
      title="课程信息已停止更新"
      description="孩子已离校，可在「课评」和「成长」中查看历史记录"
    />
    <view v-else-if="loading && courses.length === 0" class="hint">加载中…</view>
    <EmptyState v-else-if="courses.length === 0" icon="book-open" title="还没有课程" description="报名后，课程与课时会显示在这里" />

    <view v-else class="course-list">
      <view v-for="c in courses" :key="c.packageId" class="course-card" @click="openUsage(c)">
        <view class="card-head">
          <view class="names">
            <text class="course-name">{{ c.courseName || '课程' }}</text>
            <text v-if="c.className" class="class-name">{{ c.className }}</text>
          </view>
          <text class="status" :class="'st-' + c.status">{{ statusLabel[c.status] || c.status }}</text>
        </view>

        <view class="hours">
          <text class="remaining">{{ c.remainingLessons }}</text>
          <text class="unit">课时剩余</text>
          <text class="total">共 {{ c.totalLessons }} 课时<text v-if="c.bonusLessons">（含赠送 {{ c.bonusLessons }}）</text></text>
        </view>

        <view class="bar">
          <view class="bar-fill" :style="{ width: usedPercent(c) + '%' }" />
        </view>
        <view class="bar-legend">
          <text>已上 {{ c.consumedLessons }} 课时</text>
          <text v-if="c.expiryDate">有效期至 {{ c.expiryDate }}</text>
        </view>

        <view v-if="c.lowHours" class="low-hours">
          <AppIcon name="alert-triangle" size="28rpx" color="#B45309" />
          <text>
            课时即将用完<text v-if="c.estimatedWeeksLeft">，按近期上课频率约还能上 {{ c.estimatedWeeksLeft }} 周</text>
          </text>
        </view>

        <view class="usage-link">
          <text>课时明细</text>
          <AppIcon name="chevron-right" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, type CoursePackage } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';

const statusLabel: Record<string, string> = {
  active: '上课中',
  frozen: '已冻结',
  completed: '已结课',
  refunded: '已退课',
};

const parentStore = useParentStore();
const courses = ref<CoursePackage[]>([]);
const loading = ref(false);

async function load() {
  const sid = parentStore.currentStudentId;
  if (!sid || parentStore.isReadOnly) return;
  loading.value = true;
  try {
    const res = await parentApi.courses(sid);
    if (sid === parentStore.currentStudentId) courses.value = res;
  } catch {
    courses.value = [];
  } finally {
    loading.value = false;
  }
}

function usedPercent(c: CoursePackage) {
  return c.totalLessons > 0 ? Math.min(100, Math.round((c.consumedLessons / c.totalLessons) * 100)) : 0;
}

function openUsage(c: CoursePackage) {
  uni.navigateTo({
    url: `/package-parent/courses/usage?sid=${encodeURIComponent(parentStore.currentStudentId)}&pid=${encodeURIComponent(c.packageId)}`,
  });
}

onShow(load);
watch(() => parentStore.currentStudentId, load);
</script>

<style lang="scss" scoped>
.hint {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #94A3B8;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.course-card {
  padding: 32rpx 28rpx 20rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.04);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.names {
  min-width: 0;

  .course-name {
    display: block;
    font-size: 32rpx;
    font-weight: 600;
    color: #0F172A;
    line-height: 1.4;
  }

  .class-name {
    display: block;
    margin-top: 4rpx;
    font-size: 24rpx;
    color: #64748B;
  }
}

.status {
  flex-shrink: 0;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  background: #F1F5F9;
  color: #475569;

  &.st-active {
    background: #ECFDF3;
    color: #15803D;
  }

  &.st-frozen {
    background: #EEF2FF;
    color: #3730A3;
  }
}

.hours {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 28rpx;

  .remaining {
    font-size: 64rpx;
    font-weight: 700;
    color: #0F172A;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    font-size: 26rpx;
    color: #334155;
  }

  .total {
    margin-left: auto;
    font-size: 24rpx;
    color: #64748B;
  }
}

.bar {
  height: 12rpx;
  margin-top: 20rpx;
  border-radius: 9999rpx;
  background: #EFF2F8;
  overflow: hidden;

  .bar-fill {
    height: 100%;
    border-radius: 9999rpx;
    background: #2F54EB;
  }
}

.bar-legend {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #64748B;
}

.low-hours {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: #FFF7E8;
  font-size: 24rpx;
  line-height: 1.6;
  color: #92400E;
}

.usage-link {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
  font-size: 24rpx;
  color: #64748B;
}
</style>
