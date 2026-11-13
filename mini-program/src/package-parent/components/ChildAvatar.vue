<template>
  <view
    class="child-avatar"
    :style="{ width: size, height: size, fontSize: fontSize, background: palette.background, color: palette.color, boxShadow: ring ? '0 0 0 4rpx #FFFFFF' : 'none' }"
  >
    {{ initial }}
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { childPalette } from '../utils/visual';

const props = withDefaults(defineProps<{ name: string; index?: number; size?: string; ring?: boolean }>(), {
  index: 0,
  size: '60rpx',
  ring: false,
});

const palette = computed(() => childPalette(props.index));
// 中文名取最后一个字，更亲切 (张子豪 → 豪)
const initial = computed(() => (props.name || '?').trim().slice(-1));
// 头像里的字至少 12px：窄屏上 rpx 会缩小，家长端不能双指放大
const fontSize = computed(() => `max(12px, calc(${props.size} * 0.42))`);
</script>

<style lang="scss" scoped>
.child-avatar {
  flex-shrink: 0;
  border-radius: 50%;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
