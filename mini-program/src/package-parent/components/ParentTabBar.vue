<template>
  <view class="tab-dock">
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: tab.key === current }"
        @click="go(tab)"
      >
        <view class="icon-pill">
          <AppIcon
            :name="tab.icon"
            size="40rpx"
            :stroke-width="tab.key === current ? 2.2 : 1.8"
            :color="tab.key === current ? '#2F54EB' : '#6B7280'"
          />
          <view v-if="tab.key === 'evaluations' && unread > 0" class="badge">{{ unread > 9 ? '9+' : unread }}</view>
        </view>
        <text class="tab-label">{{ tab.label }}</text>
      </view>
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

// 家长端标签页位于分包 (非原生 tabBar 页面)，用 redirectTo 切换以免页面栈增长
const go = (tab: (typeof tabs)[number]) => {
  if (tab.key === props.current) return;
  uni.redirectTo({ url: tab.url });
};
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

/* 与教职工端 CustomTabBar 一致：底部通栏、细分隔线、品牌色选中态 */
.tab-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  background: rgba(255, 255, 255, 0.98);
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 -4rpx 20rpx rgba(15, 23, 42, 0.04);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-bar {
  height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6rpx 12rpx 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;

  .tab-label {
    font-size: 21rpx;
    color: #6B7280;
    transition: color 0.2s ease;
  }

  &.active .tab-label {
    color: $p-brand;
    font-weight: 600;
  }
}

.icon-pill {
  position: relative;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge {
  position: absolute;
  top: -8rpx;
  left: 28rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: $p-rose;
  color: #FFFFFF;
  font-size: 19rpx;
  font-weight: 700;
  line-height: 28rpx;
  text-align: center;
  border: 2rpx solid #FFFFFF;
}
</style>
