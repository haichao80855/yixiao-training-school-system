<template>
  <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-content">
      <!-- 品牌标识与校区选择 -->
      <view class="brand-area" @click="handleCampusClick">
        <view class="brand-logo">
          <text class="logo-text">一校</text>
        </view>
        <view class="campus-picker">
          <text class="campus-name">{{ campusStore.currentCampusName }}</text>
          <AppIcon name="chevron-down" size="24rpx" color="#1D39C4" />
        </view>
      </view>

      <!-- 消息通知铃铛 -->
      <view class="action-area" :style="{ marginRight: capsuleRightMargin + 'px' }">
        <view class="bell-box" @click="handleNotificationClick">
          <AppIcon name="bell" size="36rpx" color="#2F54EB" />
          <view class="badge-dot" v-if="unreadCount > 0"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCampusStore } from '../stores/campusStore';
import AppIcon from './AppIcon.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightMargin = ref(90);
const unreadCount = ref(3);

onMounted(() => {
  // 获取微信胶囊按钮与状态栏高度
  try {
    const systemInfo = uni.getSystemInfoSync();
    statusBarHeight.value = systemInfo.statusBarHeight || 20;

    // #ifdef MP-WEIXIN
    const menuButton = uni.getMenuButtonBoundingClientRect();
    if (menuButton) {
      capsuleRightMargin.value = (systemInfo.windowWidth - menuButton.left) + 8;
    }
    // #endif
  } catch (e) {
    // 降级使用默认值
  }
});

const handleCampusClick = () => {
  const list = campusStore.campuses.length > 0 
    ? campusStore.campuses.map(c => c.name) 
    : ['拓视未来-原阳校区'];
  uni.showActionSheet({
    itemList: list,
    success: (res) => {
      if (campusStore.campuses[res.tapIndex]) {
        campusStore.setCampus(campusStore.campuses[res.tapIndex]);
      } else {
        campusStore.currentCampusName = list[res.tapIndex];
      }
    }
  });
};

const handleNotificationClick = () => {
  uni.switchTab({
    url: '/pages/todo/index',
    fail: () => {
      uni.navigateTo({
        url: '/pages/todo/index',
        fail: () => {
          uni.reLaunch({ url: '/pages/todo/index' });
        }
      });
    }
  });
};
</script>

<style lang="scss" scoped>
.custom-nav-bar {
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.96) 0%, rgba(246, 248, 252, 0.98) 100%);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.05);
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.brand-logo {
  display: flex;
  align-items: center;

  .logo-text {
    font-size: 38rpx;
    font-weight: 900;
    font-style: italic;
    color: #1D39C4;
    letter-spacing: -2rpx;
    text-shadow: 0 2rpx 8rpx rgba(29, 57, 196, 0.15);
  }
}

.campus-picker {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background: #EEF2FF;
  padding: 8rpx 20rpx;
  border-radius: 9999rpx;
  border: 1rpx solid rgba(47, 84, 235, 0.16);
  box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.05);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
  cursor: pointer;
  will-change: transform;

  &:active {
    transform: scale(0.95);
    background: #E0EAFF;
  }

  .campus-name {
    font-size: 26rpx;
    font-weight: 600;
    color: #1E293B;
    max-width: 240rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.2rpx;
  }
}

.action-area {
  display: flex;
  align-items: center;
}

.bell-box {
  position: relative;
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #EEF2FF;
  border: 1rpx solid rgba(47, 84, 235, 0.16);
  box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.05);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
  cursor: pointer;
  will-change: transform;

  &:active {
    transform: scale(0.9);
    background: #DBEAFE;
  }

  .bell-icon {
    font-size: 34rpx;
    line-height: 1;
  }

  .badge-dot {
    position: absolute;
    top: 12rpx;
    right: 12rpx;
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background-color: #DC2626;
    border: 2rpx solid #FFFFFF;
    box-shadow: 0 0 6rpx rgba(220, 38, 38, 0.6);
  }
}
</style>
