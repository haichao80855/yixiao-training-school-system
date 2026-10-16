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
          <text class="arrow-down">▼</text>
        </view>
      </view>

      <!-- 消息通知铃铛 -->
      <view class="action-area" :style="{ marginRight: capsuleRightMargin + 'px' }">
        <view class="bell-box" @click="handleNotificationClick">
          <text class="bell-icon">🔔</text>
          <view class="badge-dot" v-if="unreadCount > 0"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCampusStore } from '../stores/campusStore';

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
  uni.showActionSheet({
    itemList: campusStore.campuses.length > 0 
      ? campusStore.campuses.map(c => c.name) 
      : ['总部乐博旗舰校区', '远洋校区', '朝阳大悦城校区'],
    success: (res) => {
      if (campusStore.campuses[res.tapIndex]) {
        campusStore.setCampus(campusStore.campuses[res.tapIndex]);
      } else {
        campusStore.currentCampusName = ['总部乐博旗舰校区', '远洋校区', '朝阳大悦城校区'][res.tapIndex];
      }
    }
  });
};

const handleNotificationClick = () => {
  uni.navigateTo({ url: '/pages/todo/index' });
};
</script>

<style lang="scss" scoped>
.custom-nav-bar {
  background: linear-gradient(180deg, #E6F0FF 0%, #F8FAFC 100%);
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
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
  .logo-text {
    font-size: 38rpx;
    font-weight: 900;
    font-style: italic;
    color: #1D39C4;
    letter-spacing: -2rpx;
  }
}

.campus-picker {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  padding: 6rpx 16rpx;
  border-radius: 32rpx;
  border: 1rpx solid rgba(47, 84, 235, 0.15);

  .campus-name {
    font-size: 26rpx;
    font-weight: 600;
    color: #1F2937;
    max-width: 200rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow-down {
    font-size: 16rpx;
    color: #6B7280;
    margin-left: 8rpx;
    transform: scale(0.8);
  }
}

.action-area {
  display: flex;
  align-items: center;
}

.bell-box {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .bell-icon {
    font-size: 34rpx;
  }

  .badge-dot {
    position: absolute;
    top: 10rpx;
    right: 10rpx;
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background-color: #F5222D;
    border: 2rpx solid #FFFFFF;
  }
}
</style>
