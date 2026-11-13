<template>
  <view class="tab-dock">
    <view class="tab-bar">
      <view role="button" tabindex="0"
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
          <view v-if="tab.key === 'evaluations' && unreadCount > 0" class="badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</view>
        </view>
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { useParentStore } from '../../stores/parentStore';

export type ParentTabKey = 'evaluations' | 'schedule' | 'courses' | 'growth' | 'me';

const props = withDefaults(defineProps<{ current: ParentTabKey; unread?: number }>(), { unread: 0 });

// 未读角标用后端返回的总数 (存在 parentStore)，五个标签页都能看到；以前只有课评页传了本页的未读数
const parentStore = useParentStore();
const unreadCount = computed(() => parentStore.currentUnread);
onMounted(() => {
  parentStore.ensureUnread();
});

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
  /* #ifdef H5 */
  max-width: 480px;
  margin: 0 auto;
  /* #endif */
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
  justify-content: center;
  gap: 4rpx;
  min-height: 44px; // 整个标签格都能点，窄屏上也不小于 44px
  align-self: stretch;

  .tab-label {
    font-size: p-fs(24);
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
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  border-radius: 18rpx;
  background: $p-rose;
  color: #FFFFFF;
  font-size: p-fs(24);
  font-weight: 600;
  line-height: 32rpx;
  text-align: center;
  border: 2rpx solid #FFFFFF;
}
</style>
