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
            :color="tab.key === current ? '#2F54EB' : '#958F88'"
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

.tab-dock {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(16rpx + env(safe-area-inset-bottom));
  z-index: 900;
}

.tab-bar {
  height: 124rpx;
  border-radius: 62rpx;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 12rpx;
  background: rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: $p-shadow-float;
}

.tab-item {
  width: 124rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;

  .tab-label {
    font-size: 21rpx;
    color: $p-ink-3;
    transition: color 0.2s ease;
  }

  &.active {
    .tab-label {
      color: $p-brand;
      font-weight: 600;
    }

    .icon-pill {
      background: $p-brand-50;
      animation: tab-pop 0.36s $p-ease-spring both;
    }
  }
}

.icon-pill {
  position: relative;
  width: 80rpx;
  height: 56rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.badge {
  position: absolute;
  top: -6rpx;
  right: 2rpx;
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

@keyframes tab-pop {
  0% {
    transform: scale(0.86);
  }
  100% {
    transform: scale(1);
  }
}
</style>
