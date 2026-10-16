<template>
  <view class="ai-page-container">
    <CustomNavBar />

    <view class="ai-header-card">
      <view class="ai-avatar-glow">
        <AppIcon name="sparkles" size="56rpx" color="#FFFFFF" />
      </view>
      <text class="ai-card-title">一校云 · 智能教务 Copilot</text>
      <text class="ai-card-desc">基于校区实时排课、学员消课与财务流水，回答教务问题</text>
    </view>

    <!-- 快捷提问推荐 -->
    <view class="suggest-box">
      <text class="suggest-title">您可以这样问我：</text>
      <view class="tag-row">
        <view class="suggest-tag" v-for="(tag, idx) in suggestQuestions" :key="idx" @click="handleSend(tag)">
          {{ tag }}
        </view>
      </view>
    </view>

    <!-- 问答流 -->
    <view class="chat-stream">
      <view class="chat-bubble bot-bubble">
        <view class="bubble-sender-row" style="display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx;">
          <AppIcon name="bot" size="32rpx" color="#2F54EB" />
          <text class="bubble-sender" style="margin-bottom: 0;">智能助手</text>
        </view>
        <text class="bubble-text">您好！我是您的智能教务助手。您可以向我询问今日待结课排课、本月课消金额，或查询低额课时预警学员。</text>
      </view>

      <view class="chat-bubble user-bubble" v-for="(msg, idx) in messageHistory" :key="idx">
        <text class="bubble-text">{{ msg }}</text>
      </view>
    </view>

    <!-- 底部输入框 -->
    <view class="input-bar">
      <input
        class="chat-input"
        type="text"
        v-model="inputQuery"
        placeholder="向 AI 提问校区业务数据..."
        confirm-type="send"
        @confirm="handleSend(inputQuery)"
      />
      <button class="send-btn" @click="handleSend(inputQuery)">发送</button>
    </view>

    <view class="tabbar-pad"></view>
    <CustomTabBar currentTab="ai" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CustomNavBar from '../../components/CustomNavBar.vue';
import CustomTabBar from '../../components/CustomTabBar.vue';
import AppIcon from '../../components/AppIcon.vue';

const suggestQuestions = [
  '今天我有几节课待点名？',
  '校区本月课消金额是多少？',
  '有哪些学员剩余课时不足3课时？',
  '启蒙英语-002班到课率如何？'
];

const inputQuery = ref('');
const messageHistory = ref<string[]>([]);

const handleSend = (text: string) => {
  const query = text.trim();
  if (!query) return;
  messageHistory.value.push(query);
  inputQuery.value = '';
  uni.showToast({ title: 'AI 思考中...', icon: 'loading', duration: 800 });
};
</script>

<style lang="scss" scoped>
.ai-page-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
}

.ai-header-card {
  margin: 20rpx 24rpx;
  background: linear-gradient(135deg, #2F54EB 0%, #722ED1 100%);
  border-radius: 24rpx;
  padding: 36rpx 28rpx;
  color: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 24rpx rgba(114, 46, 209, 0.25);

  .ai-avatar-glow {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16rpx;

    .ai-icon-glyph {
      font-size: 44rpx;
    }
  }

  .ai-card-title {
    font-size: 32rpx;
    font-weight: 700;
    margin-bottom: 8rpx;
  }

  .ai-card-desc {
    font-size: 22rpx;
    opacity: 0.85;
    text-align: center;
  }
}

.suggest-box {
  padding: 0 24rpx;
  margin-bottom: 20rpx;

  .suggest-title {
    font-size: 24rpx;
    color: #6B7280;
    margin-bottom: 12rpx;
    display: block;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;

    .suggest-tag {
      background: #FFFFFF;
      border: 1rpx solid #E5E7EB;
      color: #374151;
      font-size: 24rpx;
      padding: 10rpx 20rpx;
      border-radius: 30rpx;
    }
  }
}

.chat-stream {
  flex: 1;
  padding: 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;

  .chat-bubble {
    max-width: 80%;
    padding: 20rpx 24rpx;
    border-radius: 20rpx;
    font-size: 26rpx;
    line-height: 1.5;

    &.bot-bubble {
      align-self: flex-start;
      background: #FFFFFF;
      border: 1rpx solid #E5E7EB;
      color: #1F2937;

      .bubble-sender {
        font-size: 20rpx;
        color: #6B7280;
        margin-bottom: 8rpx;
        display: block;
      }
    }

    &.user-bubble {
      align-self: flex-end;
      background: #2F54EB;
      color: #FFFFFF;
    }
  }
}

.input-bar {
  margin: 20rpx 24rpx;
  display: flex;
  gap: 16rpx;

  .chat-input {
    flex: 1;
    height: 84rpx;
    background: #FFFFFF;
    border: 1rpx solid #D1D5DB;
    border-radius: 42rpx;
    padding: 0 32rpx;
    font-size: 26rpx;
  }

  .send-btn {
    width: 130rpx;
    height: 84rpx;
    background: #2F54EB;
    color: #FFFFFF;
    border-radius: 42rpx;
    font-size: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
  }
}

.tabbar-pad {
  height: calc(140rpx + constant(safe-area-inset-bottom));
  height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
