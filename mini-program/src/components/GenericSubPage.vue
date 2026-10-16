<template>
  <view class="subpage-container">
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: (44 + statusBarHeight) + 'px' }">
      <text class="back-btn" @click="handleBack">‹ 返回</text>
      <text class="page-title">{{ title }}</text>
      <view class="placeholder-box" :style="{ width: capsuleRightWidth + 'px' }"></view>
    </view>
    <view class="content-body">
      <slot>
        <view class="placeholder-card">
          <view class="placeholder-icon">
            <AppIcon :name="icon || 'folder'" size="96rpx" color="#2F54EB" />
          </view>
          <text class="card-title">{{ title }} 模块就绪</text>
          <text class="card-desc">阶段一基础路由与数据拦截已挂载，业务逻辑将于阶段二/三无缝集成。</text>
        </view>
      </slot>
      <view class="bottom-safe-space"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppIcon from './AppIcon.vue';

defineProps<{
  title?: string;
  icon?: string;
}>();

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(80);

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync();
    if (sys.statusBarHeight) {
      statusBarHeight.value = sys.statusBarHeight;
    }
    // #ifdef MP-WEIXIN
    const menuBtn = uni.getMenuButtonBoundingClientRect();
    if (menuBtn) {
      capsuleRightWidth.value = sys.windowWidth - menuBtn.left + 8;
    }
    // #endif
  } catch (e) {}
});

const handleBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack({
      fail: () => {
        uni.reLaunch({ url: '/pages/workbench/index' });
      }
    });
  } else {
    uni.reLaunch({ url: '/pages/workbench/index' });
  }
};
</script>

<style lang="scss" scoped>
.subpage-container {
  min-height: 100vh;
  background-color: #F6F8FC;
  display: flex;
  flex-direction: column;
}

.nav-header {
  box-sizing: border-box;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.02);
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;

  .back-btn {
    font-size: 30rpx;
    color: #2F54EB;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

    &:active {
      transform: scale(0.92);
    }
  }

  .page-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: 0.2rpx;
  }

  .placeholder-box {
    width: 60rpx;
  }
}

.content-body {
  padding: 32rpx 24rpx;

  .placeholder-card {
    background: #FFFFFF;
    border-radius: 28rpx;
    padding: 64rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    border: 1rpx solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);
    transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1);

    .placeholder-icon {
      margin-bottom: 24rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 14rpx;
    }

    .card-desc {
      font-size: 24rpx;
      color: #64748B;
      line-height: 1.6;
    }
  }

  .bottom-safe-space {
    height: calc(80rpx + constant(safe-area-inset-bottom));
    height: calc(80rpx + env(safe-area-inset-bottom));
  }
}
</style>
