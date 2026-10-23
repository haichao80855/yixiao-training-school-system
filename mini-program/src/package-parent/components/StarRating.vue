<template>
  <view class="stars" :aria-label="`${value} 星`">
    <AppIcon
      v-for="i in 5"
      :key="i"
      name="star"
      :size="size"
      :filled="true"
      :color="i <= Math.round(value) ? '#E8A33D' : '#E2E8F0'"
    />
    <text v-if="showValue" class="value">{{ value.toFixed(1) }}</text>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

withDefaults(defineProps<{ value: number; size?: string; showValue?: boolean }>(), {
  size: '26rpx',
  showValue: false,
});
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.stars {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;

  .value {
    @include p-num;
    margin-left: 8rpx;
    font-size: 26rpx;
    font-weight: 700;
    color: $p-amber-ink;
  }
}
</style>
