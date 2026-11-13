<template>
  <view class="segments" role="tablist">
    <view class="seg-thumb" :style="{ width: `calc(${100 / options.length}% - 6rpx)`, transform: `translateX(${activeIndex * 100}%)` }" />
    <view
      v-for="opt in options"
      :key="opt.value"
      class="segment"
      :class="{ active: opt.value === modelValue }"
      role="tab"
      tabindex="0"
      :aria-selected="opt.value === modelValue"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </view>
  </view>
</template>

<script setup lang="ts" generic="T extends string">
/**
 * 分段切换 (照片 / 视频 等)。成长页和历史档案页以前各写了一份一模一样的样式，统一成这个组件。
 */
import { computed } from 'vue';

const props = defineProps<{ modelValue: T; options: Array<{ value: T; label: string }> }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: T): void }>();
const activeIndex = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)));
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.segments {
  position: relative;
  display: flex;
  padding: 6rpx;
  margin-bottom: 36rpx;
  border-radius: $p-r-inner;
  background: $p-fill;
}

.seg-thumb {
  position: absolute;
  left: 6rpx;
  top: 6rpx;
  bottom: 6rpx;
  border-radius: $p-r-sm;
  background: $p-surface;
  box-shadow: $p-shadow;
  transition: transform 0.3s $p-ease-out;
}

.segment {
  @include p-hit-min; // 可点区域至少 88rpx
  position: relative;
  z-index: 1;
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  font-size: p-fs($p-fs-body);
  color: $p-ink-2;
  transition: color 0.2s ease;

  &.active {
    color: $p-ink;
    font-weight: $p-fw-bold;
  }
}
</style>
