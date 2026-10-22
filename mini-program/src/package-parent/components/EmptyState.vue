<template>
  <view class="empty-state">
    <view class="icon-circle">
      <AppIcon :name="icon" size="56rpx" color="#94A3B8" />
    </view>
    <text class="title">{{ title }}</text>
    <text v-if="description" class="desc">{{ description }}</text>
  </view>
</template>

<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), { icon: 'inbox' });
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 48rpx;
  text-align: center;
}

.icon-circle {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #EFF2F8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 600;
  color: #334155;
}

.desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #64748B;
}
</style>
