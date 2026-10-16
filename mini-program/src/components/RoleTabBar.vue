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
  border-bottom: 1rpx solid #F0F2F5;
  height: 88rpx;

  .role-tab-item {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;

    .tab-title {
      font-size: 28rpx;
      color: #6B7280;
      transition: all 0.2s ease;
    }

    &.active {
      .tab-title {
        color: #2F54EB;
        font-weight: 700;
        font-size: 30rpx;
      }
    }

    .active-indicator {
      position: absolute;
      bottom: 0;
      width: 48rpx;
      height: 6rpx;
      background: #2F54EB;
      border-radius: 3rpx;
    }
  }
}
</style>
