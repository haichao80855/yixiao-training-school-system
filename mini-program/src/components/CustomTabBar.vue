<template>
  <view class="custom-tab-bar">
    <view class="tab-bar-border"></view>
    <view class="tab-items-container">
      <!-- 1. 首页 -->
      <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home', '/pages/index/index')">
        <view class="icon-wrap">
          <text class="tab-icon">🏠</text>
        </view>
        <text class="tab-label">首页</text>
      </view>

      <!-- 2. 工作台 -->
      <view class="tab-item" :class="{ active: currentTab === 'workbench' }" @click="switchTab('workbench', '/pages/workbench/index')">
        <view class="icon-wrap">
          <text class="tab-icon">💼</text>
        </view>
        <text class="tab-label">工作台</text>
      </view>

      <!-- 3. AI问答 (中心凸起悬浮圆形) -->
      <view class="tab-item center-ai" :class="{ active: currentTab === 'ai' }" @click="switchTab('ai', '/pages/ai/index')">
        <view class="ai-button-glow">
          <view class="ai-button-inner">
            <text class="ai-text">Ai</text>
          </view>
        </view>
        <text class="tab-label ai-label">AI问答</text>
      </view>

      <!-- 4. 待办 -->
      <view class="tab-item" :class="{ active: currentTab === 'todo' }" @click="switchTab('todo', '/pages/todo/index')">
        <view class="icon-wrap">
          <text class="tab-icon">✈️</text>
          <view class="badge" v-if="todoCount > 0">{{ todoCount }}</view>
        </view>
        <text class="tab-label">待办</text>
      </view>

      <!-- 5. 我的 -->
      <view class="tab-item" :class="{ active: currentTab === 'my' }" @click="switchTab('my', '/pages/my/index')">
        <view class="icon-wrap">
          <text class="tab-icon">👤</text>
        </view>
        <text class="tab-label">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  currentTab: 'home' | 'workbench' | 'ai' | 'todo' | 'my';
}>();

const todoCount = ref(7);

const switchTab = (tab: string, url: string) => {
  if (props.currentTab === tab) return;
  uni.switchTab({
    url,
    fail: () => {
      uni.reLaunch({ url });
    }
  });
};
</script>

<style lang="scss" scoped>
.custom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  z-index: 999;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.tab-bar-border {
  height: 1rpx;
  background: #E5E7EB;
  width: 100%;
}

.tab-items-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  position: relative;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;

  .icon-wrap {
    position: relative;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-icon {
    font-size: 38rpx;
  }

  .badge {
    position: absolute;
    top: -6rpx;
    right: -20rpx;
    background: #F5222D;
    color: #FFFFFF;
    font-size: 18rpx;
    padding: 0 8rpx;
    height: 28rpx;
    line-height: 28rpx;
    border-radius: 14rpx;
    font-weight: 600;
  }

  .tab-label {
    font-size: 20rpx;
    color: #6B7280;
    margin-top: 4rpx;
  }

  &.active {
    .tab-label {
      color: #2F54EB;
      font-weight: 600;
    }
  }
}

/* 核心特色：AI问答悬浮凸起按钮 */
.tab-item.center-ai {
  position: relative;
  overflow: visible;

  .ai-button-glow {
    position: absolute;
    top: -36rpx;
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #A8C0FF 0%, #3F2B96 100%);
    padding: 4rpx;
    box-shadow: 0 6rpx 16rpx rgba(47, 84, 235, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ai-button-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, #74EBD5 0%, #9FACE6 100%);
    display: flex;
    align-items: center;
    justify-content: center;

    .ai-text {
      color: #FFFFFF;
      font-size: 38rpx;
      font-weight: 900;
      font-style: italic;
      text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
    }
  }

  .ai-label {
    margin-top: 56rpx;
    font-size: 20rpx;
    color: #2F54EB;
    font-weight: 600;
  }
}
</style>
