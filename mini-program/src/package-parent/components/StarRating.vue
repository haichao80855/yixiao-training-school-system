<template>
  <view class="stars" role="img" :aria-label="`评分 ${value.toFixed(1)} 分，满分 5 分`">
    <AppIcon
      v-for="i in 5"
      :key="i"
      name="star"
      :size="size"
      :filled="true"
      :color="i <= Math.round(value) ? P_COLORS.amber : P_COLORS.lineStrong"
    />
    <text v-if="showValue" class="value">{{ value.toFixed(1) }}</text>
  </view>
</template>

<script setup lang="ts">
import { P_COLORS } from '../styles/colors';
import AppIcon from '../../components/AppIcon.vue';

withDefaults(defineProps<{ value: number; size?: string; showValue?: boolean }>(), {
  size: '26rpx',
  // 默认在星星旁边显示分数：不只靠颜色表达评分 (色弱的家长也能看懂)
  showValue: true,
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
    font-size: p-fs($p-fs-body);
    font-weight: 600;
    color: $p-amber-ink;
  }
}
</style>
