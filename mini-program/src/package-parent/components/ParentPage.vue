<template>
  <view class="parent-page" :class="{ 'has-tab-bar': !!tab }">
    <view class="parent-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-row" :style="{ paddingRight: capsuleWidth + 'px' }">
        <view v-if="showBack" class="back-btn" @click="goBack">
          <AppIcon name="arrow-left" size="40rpx" color="#0F172A" />
        </view>
        <text class="header-title">{{ title }}</text>
        <view v-if="showChildSwitcher && parentStore.currentChild" class="child-pill" @click="pickChild">
          <view class="child-avatar">{{ parentStore.currentChild.name.slice(-1) }}</view>
          <text class="child-name">{{ parentStore.currentChild.name }}</text>
          <AppIcon v-if="parentStore.children.length > 1" name="chevron-down" size="24rpx" color="#475569" />
        </view>
      </view>
    </view>

    <view v-if="showChildSwitcher && parentStore.isReadOnly" class="readonly-banner">
      <AppIcon name="lock" size="28rpx" color="#B45309" />
      <text>{{ parentStore.currentChild?.name }}已离校，可查看历史课评与相册至 {{ readOnlyUntilText }}</text>
    </view>

    <view class="page-body">
      <slot />
    </view>

    <ParentTabBar v-if="tab" :current="tab" :unread="unread" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import ParentTabBar, { type ParentTabKey } from './ParentTabBar.vue';
import { useParentStore } from '../../stores/parentStore';

withDefaults(
  defineProps<{
    title: string;
    tab?: ParentTabKey;
    showBack?: boolean;
    showChildSwitcher?: boolean;
    unread?: number;
  }>(),
  { showBack: false, showChildSwitcher: true, unread: 0 },
);

const parentStore = useParentStore();
const statusBarHeight = ref(20);
const capsuleWidth = ref(96);

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync();
    statusBarHeight.value = sys.statusBarHeight || 20;
    // #ifdef MP-WEIXIN
    const menu = uni.getMenuButtonBoundingClientRect();
    if (menu) capsuleWidth.value = sys.windowWidth - menu.left + 8;
    // #endif
  } catch {}
});

const readOnlyUntilText = computed(() => {
  const until = parentStore.currentChild?.readOnlyUntil;
  if (!until) return '';
  const d = new Date(until);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
});

const pickChild = () => {
  if (parentStore.children.length <= 1) return;
  const list = parentStore.children;
  uni.showActionSheet({
    itemList: list.map((c) => (c.access === 'read_only' ? `${c.name}（已离校）` : `${c.name} · ${c.campusName}`)),
    success: (res) => {
      const child = list[res.tapIndex];
      if (child) parentStore.switchChild(child.studentId);
    },
  });
};

const goBack = () => {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-parent/evaluations/index' });
  }
};

</script>

<style lang="scss" scoped>
.parent-page {
  min-height: 100vh;
  background: #F6F8FC;

  &.has-tab-bar {
    padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
  }
}

.parent-header {
  position: sticky;
  top: 0;
  z-index: 800;
  background: rgba(246, 248, 252, 0.96);
}

.header-row {
  height: 88rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-left: 32rpx;
}

.back-btn {
  width: 56rpx;
  height: 56rpx;
  margin-left: -12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0F172A;
  white-space: nowrap;
}

.child-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  max-width: 300rpx;
  padding: 6rpx 18rpx 6rpx 6rpx;
  background: #FFFFFF;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 9999rpx;

  &:active {
    background: #EEF2FF;
  }
}

.child-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #EEF2FF;
  color: #2F54EB;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.child-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #1E293B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.readonly-banner {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin: 8rpx 32rpx 0;
  padding: 18rpx 24rpx;
  background: #FFF7E8;
  border-radius: 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #92400E;
}

.page-body {
  padding: 16rpx 32rpx 32rpx;
}
</style>
