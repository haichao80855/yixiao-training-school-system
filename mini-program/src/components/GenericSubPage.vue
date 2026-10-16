<template>
  <view class="subpage-container">
    <view class="nav-header">
      <text class="back-btn" @click="handleBack">‹ 返回</text>
      <text class="page-title">{{ title }}</text>
      <view class="placeholder-box"></view>
    </view>
    <view class="content-body">
      <slot>
        <view class="placeholder-card">
          <text class="placeholder-icon">{{ icon }}</text>
          <text class="card-title">{{ title }} 模块就绪</text>
          <text class="card-desc">阶段一基础路由与数据拦截已挂载，业务逻辑将于阶段二/三无缝集成。</text>
        </view>
      </slot>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  icon?: string;
}>();

const handleBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/pages/workbench/index' });
    }
  });
};
</script>

<style lang="scss" scoped>
.subpage-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
}

.nav-header {
  height: 88rpx;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #E5E7EB;

  .back-btn {
    font-size: 32rpx;
    color: #2F54EB;
    font-weight: 500;
  }

  .page-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #111827;
  }

  .placeholder-box {
    width: 60rpx;
  }
}

.content-body {
  padding: 32rpx 24rpx;

  .placeholder-card {
    background: #FFFFFF;
    border-radius: 20rpx;
    padding: 60rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);

    .placeholder-icon {
      font-size: 64rpx;
      margin-bottom: 20rpx;
    }

    .card-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 12rpx;
    }

    .card-desc {
      font-size: 24rpx;
      color: #6B7280;
      line-height: 1.6;
    }
  }
}
</style>
