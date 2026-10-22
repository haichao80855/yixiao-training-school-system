<template>
  <view
    class="child-avatar"
    :style="{ width: size, height: size, fontSize: fontSize, background: palette.background, boxShadow: ring ? `0 0 0 4rpx #FFFFFF, 0 0 0 7rpx ${palette.ring}` : 'none' }"
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
const fontSize = computed(() => `calc(${props.size} * 0.42)`);
</script>

<style lang="scss" scoped>
.child-avatar {
  flex-shrink: 0;
  border-radius: 50%;
  color: #FFFFFF;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
