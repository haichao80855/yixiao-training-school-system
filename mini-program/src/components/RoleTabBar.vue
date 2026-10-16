<template>
  <view class="role-tabs-bar">
    <view
      class="role-tab-item"
      v-for="tab in tabList"
      :key="tab.id"
      :class="{ active: currentActive === tab.id }"
      @click="handleSelect(tab.id)"
    >
      <text class="tab-title">{{ tab.name }}</text>
      <view class="active-indicator" v-if="currentActive === tab.id"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface RoleTabOption {
  id: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    tabs?: RoleTabOption[];
  }>(),
  {
    modelValue: 'admin',
    tabs: () => [
      { id: 'admin', name: '管理员' },
      { id: 'edu', name: '教学教务' },
      { id: 'finance', name: '财务' },
      { id: 'sales', name: '销售' },
    ],
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'change', val: string): void;
}>();

const tabList = computed(() => props.tabs);
const currentActive = computed(() => props.modelValue || 'admin');

function handleSelect(id: string) {
  emit('update:modelValue', id);
  emit('change', id);
}
</script>

<style lang="scss" scoped>
.role-tabs-bar {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  padding: 0 16rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  height: 92rpx;
  box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.02);

  .role-tab-item {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform;

    &:active {
      transform: scale(0.95);
    }

    .tab-title {
      font-size: 28rpx;
      color: #64748B;
      font-weight: 500;
      letter-spacing: 0.2rpx;
      transition: color 0.22s cubic-bezier(0.2, 0, 0, 1);
    }

    &.active {
      .tab-title {
        color: #2F54EB;
        font-weight: 700;
      }
    }

    .active-indicator {
      position: absolute;
      bottom: 0;
      width: 56rpx;
      height: 6rpx;
      background: #2F54EB;
      border-radius: 9999rpx;
      box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.35);
      animation: m3IndicatorScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
  }
}

@keyframes m3IndicatorScale {
  0% {
    transform: scaleX(0.4);
    opacity: 0.5;
  }
  100% {
    transform: scaleX(1);
    opacity: 1;
  }
}
</style>
