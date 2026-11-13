<template>
  <view class="error-state" role="alert">
    <view class="art">
      <view class="blob" />
      <view class="icon-wrap">
        <AppIcon name="alert-triangle" size="52rpx" :color="P_COLORS.roseInk" />
      </view>
    </view>
    <text class="title">{{ title }}</text>
    <text class="desc">{{ message }}</text>
    <view class="retry" role="button" tabindex="0" @click="emit('retry')">
      <AppIcon name="rotate-ccw" size="30rpx" :color="P_COLORS.white" />
      <text>重新加载</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/** 加载失败：说明原因 + 「重新加载」按钮。和「没有数据」的 EmptyState 区分开。 */
import AppIcon from '../../components/AppIcon.vue';
import { P_COLORS } from '../styles/colors';

withDefaults(defineProps<{ message: string; title?: string }>(), { title: '没能加载出来' });
const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 56rpx 120rpx;
  text-align: center;
  animation: p-fade-in 0.3s $p-ease-out both;
}

.art {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  margin-bottom: 32rpx;
}

.blob {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: $p-rose-50;
}

.icon-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: p-fs(32);
  font-weight: $p-fw-bold;
  color: $p-ink;
}

.desc {
  margin-top: 12rpx;
  font-size: p-fs(28);
  line-height: 1.6;
  color: $p-ink-3;
}

.retry {
  @include p-pressable;
  margin-top: 40rpx;
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  height: 88rpx;
  min-height: 44px;
  padding: 0 48rpx;
  border-radius: $p-r-pill;
  background: $p-brand;
  color: $p-surface;
  font-size: p-fs(30);
  font-weight: $p-fw-bold;
}
</style>
