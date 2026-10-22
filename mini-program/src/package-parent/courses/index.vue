<template>
  <ParentPage title="课程" :overline="overline" tab="courses">
    <EmptyState
      v-if="parentStore.isReadOnly"
      icon="book-open"
      title="课程信息已停止更新"
      description="孩子已离校，可以在「课评」和「成长」里回看历史记录"
    />
    <view v-else-if="loading && courses.length === 0" class="sk-list">
      <view v-for="i in 2" :key="i" class="sk-card" />
    </view>
    <EmptyState v-else-if="courses.length === 0" icon="book-open" title="还没有课程" description="报名后，课程与课时会显示在这里" />

    <view v-else class="course-list">
      <view
        v-for="(c, idx) in courses"
        :key="c.packageId"
        class="course-card"
        :class="{ inactive: c.status !== 'active' }"
        :style="enterDelay(idx)"
        @click="openUsage(c)"
      >
        <view class="top">
          <view class="ring">
            <image class="ring-img" :src="ringFor(c)" />
            <view class="ring-center">
              <text class="ring-num">{{ c.remainingLessons }}</text>
              <text class="ring-label">剩余课时</text>
            </view>
          </view>
          <view class="names">
            <text class="course-name">{{ c.courseName || '课程' }}</text>
            <text v-if="c.className" class="class-name">{{ c.className }}</text>
            <text class="status" :class="'st-' + c.status">{{ statusLabel[c.status] || c.status }}</text>
          </view>
        </view>

        <view class="kv">
          <view class="kv-item">
            <text class="kv-num">{{ c.totalLessons }}</text>
            <text class="kv-label">总课时</text>
          </view>
          <view class="kv-item">
            <text class="kv-num">{{ c.consumedLessons }}</text>
            <text class="kv-label">已上</text>
          </view>
          <view class="kv-item">
            <text class="kv-num">{{ c.bonusLessons }}</text>
            <text class="kv-label">赠送</text>
          </view>
          <view class="kv-item">
            <text class="kv-num small">{{ c.expiryDate ? c.expiryDate.slice(0, 7).replace('-', '.') : '—' }}</text>
            <text class="kv-label">有效期至</text>
          </view>
        </view>

        <view v-if="c.lowHours" class="warn">
          <AppIcon name="alert-triangle" size="28rpx" color="#8A4B0F" />
          <text>
            课时即将用完<text v-if="c.estimatedWeeksLeft">，按最近的上课频率约还能上 {{ c.estimatedWeeksLeft }} 周</text>。如需续课请联系校区。
          </text>
        </view>

        <view class="usage-link">
          <text>课时明细</text>
          <AppIcon name="chevron-right" size="26rpx" color="#958F88" />
        </view>
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, type CoursePackage } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { enterDelay, ringSvg } from '../utils/visual';

const statusLabel: Record<string, string> = {
  active: '上课中',
  frozen: '已冻结',
  completed: '已结课',
  refunded: '已退课',
};

const parentStore = useParentStore();
const courses = ref<CoursePackage[]>([]);
const loading = ref(false);

const overline = computed(() => {
  const active = courses.value.filter((c) => c.status === 'active').length;
  return courses.value.length ? `${active} 门课程上课中` : '';
});

function ringFor(c: CoursePackage) {
  const percent = c.totalLessons > 0 ? c.remainingLessons / c.totalLessons : 0;
  const color = c.status !== 'active' ? '#B9B2A8' : c.lowHours ? '#F0A33A' : '#2F54EB';
  return ringSvg(percent, color);
}

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

function openUsage(c: CoursePackage) {
  uni.navigateTo({
    url: `/package-parent/courses/usage?sid=${encodeURIComponent(parentStore.currentStudentId)}&pid=${encodeURIComponent(c.packageId)}`,
  });
}

onShow(load);
watch(() => parentStore.currentStudentId, load);
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.course-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.course-card {
  @include p-card;
  @include p-pressable;
  @include p-enter;
  padding: 32rpx;

  &.inactive {
    opacity: 0.75;
  }
}

.top {
  display: flex;
  align-items: center;
  gap: 28rpx;
}

.ring {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  flex-shrink: 0;
}

.ring-img {
  width: 168rpx;
  height: 168rpx;
}

.ring-center {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-num {
  @include p-num;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1;
}

.ring-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: $p-ink-3;
}

.names {
  min-width: 0;
  flex: 1;
}

.course-name {
  display: block;
  font-size: 32rpx;
  font-weight: 650;
  line-height: 1.38;
}

.class-name {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $p-ink-3;
}

.status {
  @include p-chip;
  margin-top: 16rpx;
  height: 40rpx;
  font-size: 21rpx;
  background: $p-fill;
  color: $p-ink-2;

  &.st-active {
    background: $p-mint-50;
    color: $p-mint;
  }

  &.st-frozen {
    background: $p-brand-50;
    color: $p-brand;
  }
}

.kv {
  display: flex;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid $p-line;
}

.kv-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.kv-num {
  @include p-num;
  font-size: 32rpx;
  font-weight: 700;

  &.small {
    font-size: 28rpx;
  }
}

.kv-label {
  font-size: 21rpx;
  color: $p-ink-3;
}

.warn {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: $p-amber-50;
  font-size: 25rpx;
  line-height: 1.6;
  color: $p-amber-ink;
}

.usage-link {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4rpx;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: $p-ink-3;
}

.sk-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.sk-card {
  @include p-skeleton;
  height: 360rpx;
  border-radius: $p-r-card;
}
</style>
