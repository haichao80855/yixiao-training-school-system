<template>
  <view class="load-error-state">
    <AppIcon :name="kind === 'forbidden' ? 'lock' : 'help-circle'" size="112rpx" color="#CBD5E1" />
    <text class="load-error-title">{{ kind === 'forbidden' ? '暂无权限查看' : '加载失败' }}</text>
    <text class="load-error-desc">
      {{ kind === 'forbidden' ? `当前账号没有${subject}的查看权限，请联系管理员开通` : `${subject}未能加载，请检查网络后重试` }}
    </text>
    <view v-if="kind === 'failed'" class="load-error-retry" @click="emit('retry')">重新加载</view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { LoadErrorKind } from '../utils/loadError';

defineProps<{ kind: LoadErrorKind; subject: string }>();
const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<style scoped>
.load-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 48rpx;
}

.load-error-title {
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #475569;
}

.load-error-desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #94A3B8;
  text-align: center;
}

.load-error-retry {
  margin-top: 32rpx;
  padding: 16rpx 48rpx;
  border-radius: 40rpx;
  background: #2F54EB;
  color: #FFFFFF;
  font-size: 26rpx;
}
</style>
