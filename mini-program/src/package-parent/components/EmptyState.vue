<template>
  <view class="empty-state">
    <view class="art">
      <view class="blob" />
      <view class="icon-wrap">
        <AppIcon :name="icon" size="52rpx" color="#958F88" />
      </view>
    </view>
    <text class="title">{{ title }}</text>
    <text v-if="description" class="desc">{{ description }}</text>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), { icon: 'inbox' });
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 56rpx 120rpx;
  text-align: center;
  animation: p-fade-in 0.4s $p-ease-out both;
}

.art {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  margin-bottom: 32rpx;
}

.blob {
  position: absolute;
  left: 0;
  top: 0;
  width: 168rpx;
  height: 168rpx;
  border-radius: 46% 54% 52% 48% / 52% 44% 56% 48%;
  background: linear-gradient(135deg, #EDE8E1, #F7F4EF);
}

.icon-wrap {
  position: absolute;
  left: 44rpx;
  top: 44rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  background: $p-surface;
  box-shadow: $p-shadow;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: $p-ink;
}

.desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.65;
  color: $p-ink-3;
}
</style>
