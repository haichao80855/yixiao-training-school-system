<template>
  <view class="parent-tab-bar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: tab.key === current }"
      @click="go(tab)"
    >
      <view class="icon-wrap">
        <AppIcon :name="tab.icon" size="44rpx" :color="tab.key === current ? '#2F54EB' : '#64748B'" />
        <view v-if="tab.key === 'evaluations' && unread > 0" class="badge">{{ unread > 99 ? '99+' : unread }}</view>
      </view>
      <text class="tab-label">{{ tab.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

export type ParentTabKey = 'evaluations' | 'schedule' | 'courses' | 'growth' | 'me';

const props = withDefaults(defineProps<{ current: ParentTabKey; unread?: number }>(), { unread: 0 });

const tabs: Array<{ key: ParentTabKey; label: string; icon: string; url: string }> = [
  { key: 'evaluations', label: '课评', icon: 'message-square', url: '/package-parent/evaluations/index' },
  { key: 'schedule', label: '课表', icon: 'calendar', url: '/package-parent/schedule/index' },
  { key: 'courses', label: '课程', icon: 'book-open', url: '/package-parent/courses/index' },
  { key: 'growth', label: '成长', icon: 'sprout', url: '/package-parent/growth/index' },
  { key: 'me', label: '我的', icon: 'user', url: '/package-parent/me/index' },
];

// 家长端标签页不是原生 tabBar 页面 (位于分包)，用 redirectTo 切换以免页面栈增长
const go = (tab: (typeof tabs)[number]) => {
  if (tab.key === props.current) return;
  uni.redirectTo({ url: tab.url });
};
</script>

<style lang="scss" scoped>
.parent-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  display: flex;
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  height: 104rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;

  .tab-label {
    font-size: 22rpx;
    color: #64748B;
  }

  &.active .tab-label {
    color: #2F54EB;
    font-weight: 600;
  }
}

.icon-wrap {
  position: relative;
  height: 44rpx;

  .badge {
    position: absolute;
    top: -8rpx;
    left: 30rpx;
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    box-sizing: border-box;
    border-radius: 9999rpx;
    background: #DC2626;
    color: #FFFFFF;
    font-size: 20rpx;
    line-height: 32rpx;
    text-align: center;
    border: 2rpx solid #FFFFFF;
  }
}
</style>
