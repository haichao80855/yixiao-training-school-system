<template>
  <view class="custom-tab-bar">
    <view class="tab-bar-border"></view>
    <view class="tab-items-container">
      <!-- 1. 首页 -->
      <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home', '/pages/index/index')">
        <view class="icon-wrap">
          <AppIcon name="home" size="44rpx" :color="currentTab === 'home' ? '#2F54EB' : '#6B7280'" />
        </view>
        <text class="tab-label">首页</text>
      </view>

      <!-- 2. 工作台 -->
      <view class="tab-item" :class="{ active: currentTab === 'workbench' }" @click="switchTab('workbench', '/pages/workbench/index')">
        <view class="icon-wrap">
          <AppIcon name="briefcase" size="44rpx" :color="currentTab === 'workbench' ? '#2F54EB' : '#6B7280'" />
        </view>
        <text class="tab-label">工作台</text>
      </view>

      <!-- 3. AI问答 (中心凸起悬浮圆形) -->
      <view class="tab-item center-ai" :class="{ active: currentTab === 'ai' }" @click="switchTab('ai', '/pages/ai/index')">
        <view class="ai-button-glow">
          <view class="ai-button-inner">
            <AppIcon name="sparkles" size="36rpx" color="#FFFFFF" />
          </view>
        </view>
        <text class="tab-label ai-label">AI问答</text>
      </view>

      <!-- 4. 待办 -->
      <view class="tab-item" :class="{ active: currentTab === 'todo' }" @click="switchTab('todo', '/pages/todo/index')">
        <view class="icon-wrap">
          <AppIcon name="calendar-check" size="44rpx" :color="currentTab === 'todo' ? '#2F54EB' : '#6B7280'" />
          <view class="badge" v-if="todoCount > 0">{{ todoCount }}</view>
        </view>
        <text class="tab-label">待办</text>
      </view>

      <!-- 5. 我的 -->
      <view class="tab-item" :class="{ active: currentTab === 'my' }" @click="switchTab('my', '/pages/my/index')">
        <view class="icon-wrap">
          <AppIcon name="user" size="44rpx" :color="currentTab === 'my' ? '#2F54EB' : '#6B7280'" />
        </view>
        <text class="tab-label">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';

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
  box-sizing: content-box;
  height: 112rpx;
  background: rgba(255, 255, 255, 0.98);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  z-index: 999;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -4rpx 20rpx rgba(15, 23, 42, 0.05);
}

.tab-bar-border {
  height: 1rpx;
  background: rgba(15, 23, 42, 0.06);
  width: 100%;
}

.tab-items-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  position: relative;
  padding: 6rpx 12rpx 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;

  &:active {
    transform: scale(0.94);
  }

  .icon-wrap {
    position: relative;
    height: 52rpx;
    width: 68rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 26rpx;
    transition: background-color 0.25s cubic-bezier(0.2, 0, 0, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .tab-icon {
    font-size: 38rpx;
    line-height: 1;
  }

  .badge {
    position: absolute;
    top: -4rpx;
    right: -12rpx;
    background: #DC2626;
    color: #FFFFFF;
    font-size: 18rpx;
    padding: 0 10rpx;
    height: 28rpx;
    line-height: 28rpx;
    border-radius: 14rpx;
    font-weight: 700;
    box-shadow: 0 2rpx 6rpx rgba(220, 38, 38, 0.35);
    border: 2rpx solid #FFFFFF;
  }

  .tab-label {
    font-size: 20rpx;
    color: #64748B;
    margin-top: 4rpx;
    font-weight: 500;
    letter-spacing: 0.2rpx;
    transition: color 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  &.active {
    .icon-wrap {
      background-color: #EEF2FF;
      transform: scale(1.05);
    }

    .tab-label {
      color: #2F54EB;
      font-weight: 700;
    }
  }
}

/* 核心特色：AI问答悬浮凸起按钮 (M3 Expressive Floating Hero Action) */
.tab-item.center-ai {
  position: relative;
  overflow: visible;

  &:active {
    transform: scale(0.92);
  }

  .ai-button-glow {
    position: absolute;
    top: -38rpx;
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #818CF8 0%, #3730A3 100%);
    padding: 4rpx;
    box-shadow: 0 8rpx 24rpx rgba(47, 84, 235, 0.38), 0 2rpx 6rpx rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
  }

  .ai-button-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, #38BDF8 0%, #6366F1 100%);
    display: flex;
    align-items: center;
    justify-content: center;

    .ai-text {
      color: #FFFFFF;
      font-size: 38rpx;
      font-weight: 900;
      font-style: italic;
      text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.25);
      letter-spacing: -1rpx;
    }
  }

  .ai-label {
    margin-top: 58rpx;
    font-size: 20rpx;
    color: #2F54EB;
    font-weight: 700;
  }
}
</style>
