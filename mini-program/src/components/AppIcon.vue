<template>
  <image
    class="app-icon"
    :class="customClass"
    mode="aspectFit"
    :src="svgUri"
    :style="computedStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getIconSvgUri } from '../utils/icons';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: string | number;
    color?: string;
    strokeWidth?: number;
    filled?: boolean;
    customClass?: string;
  }>(),
  {
    size: '40rpx',
    color: '#2563EB',
    strokeWidth: 2,
    filled: false,
    customClass: '',
  }
);

const formattedSize = computed(() => {
  if (props.size === undefined || props.size === null || props.size === '') {
    return '40rpx';
  }

  const raw = String(props.size).trim();

  // 1. 已自带合法 CSS 长度单位 (如 32rpx, 16px, 1.5rem, 100%, 20vw 等)
  if (/^[\d.]+(rpx|px|rem|em|%|vh|vw)$/i.test(raw)) {
    return raw;
  }

  // 2. 纯数字（如 16, "16", 24, "24.5" 等）
  if (/^[\d.]+$/.test(raw)) {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      // 在小程序 750rpx 设计稿标准下：
      // 若数值 <= 64，表示以 px 为基准（如 16px, 20px, 24px），转换为自适应的 2*num rpx（32rpx, 40rpx, 48rpx）
      // 若数值 > 64，本身即按 rpx 思考（如 80, 96），直接补上 rpx 单位
      if (num <= 64) {
        return `${num * 2}rpx`;
      }
      return `${num}rpx`;
    }
  }

  return '40rpx';
});

const svgUri = computed(() => {
  return getIconSvgUri(props.name, {
    color: props.color,
    strokeWidth: props.strokeWidth,
    filled: props.filled,
  });
});

const computedStyle = computed(() => {
  const sizeVal = formattedSize.value;
  return {
    width: sizeVal,
    height: sizeVal,
    maxWidth: sizeVal,
    maxHeight: sizeVal,
  };
});
</script>

<style scoped>
.app-icon {
  /* 强制覆盖微信小程序原生 <image> 标签的 320px * 240px 默认尺寸，杜绝任何巨化异常 */
  width: 40rpx;
  height: 40rpx;
  max-width: 100%;
  max-height: 100%;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  box-sizing: border-box;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
