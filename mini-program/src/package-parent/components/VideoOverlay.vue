<template>
  <!-- 网页版没有 previewMedia：全屏浮层播放视频 -->
  <view role="button" tabindex="0" v-if="url" class="video-overlay" @click="emit('close')">
    <video class="overlay-video" :src="url" autoplay controls object-fit="contain" @click.stop />
    <view role="button" tabindex="0" class="overlay-close" aria-label="关闭视频" @click.stop="emit('close')">
      <AppIcon name="x" size="40rpx" color="#FFFFFF" />
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

defineProps<{ url: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';
.video-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-video {
  width: 100%;
  max-width: 480px;
  height: 70vh;
}

.overlay-close {
  @include p-hit-min; // 可点区域至少 88rpx
  position: absolute;
  top: calc(24rpx + env(safe-area-inset-top));
  right: 24rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
