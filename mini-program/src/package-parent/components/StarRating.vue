<template>
  <view class="stars" :aria-label="`${value} 星`">
    <AppIcon
      v-for="i in 5"
      :key="i"
      name="star"
      :size="size"
      :filled="i <= Math.round(value)"
      :color="i <= Math.round(value) ? '#F59E0B' : '#CBD5E1'"
    />
    <text v-if="showValue" class="value">{{ value.toFixed(1) }}</text>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

withDefaults(defineProps<{ value: number; size?: string; showValue?: boolean }>(), {
  size: '28rpx',
  showValue: false,
});
</script>

<style lang="scss" scoped>
.stars {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;

  .value {
    margin-left: 8rpx;
    font-size: 24rpx;
    font-weight: 600;
    color: #B45309;
  }
}
</style>
