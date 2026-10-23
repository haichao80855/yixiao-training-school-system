<template>
  <view v-if="thumbs.length" class="mosaic" :class="'n' + layout">
    <view v-for="(thumb, idx) in thumbs.slice(0, 3)" :key="idx" class="tile">
      <image class="img" :src="thumb" mode="aspectFill" lazy-load />
      <view v-if="idx === thumbs.slice(0, 3).length - 1 && extra > 0" class="more">+{{ extra }}</view>
      <view v-if="idx === thumbs.slice(0, 3).length - 1 && hasVideo" class="video-badge">
        <AppIcon name="play-circle" size="24rpx" color="#FFFFFF" />
        <text>视频</text>
      </view>
    </view>
  </view>
  <view v-else-if="hasVideo" class="video-only">
    <AppIcon name="play-circle" size="40rpx" color="#FFFFFF" />
    <text>课堂视频</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../../components/AppIcon.vue';

const props = withDefaults(defineProps<{ thumbs: string[]; total?: number; hasVideo?: boolean }>(), {
  total: 0,
  hasVideo: false,
});

const layout = computed(() => Math.min(props.thumbs.length, 3));
const extra = computed(() => Math.max(0, (props.total || props.thumbs.length) - 3));
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.mosaic {
  display: grid;
  gap: 8rpx;
  border-radius: $p-r-inner;
  overflow: hidden;

  &.n1 {
    grid-template-columns: 1fr;
    grid-template-rows: 340rpx;
  }

  &.n2 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 260rpx;
  }

  &.n3 {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 168rpx 168rpx;

    .tile:first-child {
      grid-row: span 2;
    }
  }
}

.tile {
  position: relative;
  background: #E9EDF3;
  overflow: hidden;

  .img {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.more {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.42);
  color: #FFFFFF;
  font-size: 36rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-badge {
  position: absolute;
  right: 12rpx;
  bottom: 12rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  height: 44rpx;
  padding: 0 16rpx;
  border-radius: 22rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #FFFFFF;
  font-size: 22rpx;
}

.video-only {
  height: 200rpx;
  border-radius: $p-r-inner;
  background: linear-gradient(135deg, #1E293B, #0F172A);
  color: rgba(255, 255, 255, 0.85);
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
</style>
