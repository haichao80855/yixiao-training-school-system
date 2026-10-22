<template>
  <view class="parent-page" :class="{ 'has-tab-bar': !!tab, immersive }">
    <!-- 沉浸式页面 (详情)：内容自绘顶部，仅保留悬浮返回按钮 -->
    <view v-if="immersive" class="float-back" :style="{ top: statusBarHeight + 6 + 'px' }" @click="goBack">
      <AppIcon name="arrow-left" size="36rpx" color="#1D1B18" />
    </view>

    <view v-else class="parent-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="bar" :style="{ paddingRight: capsuleWidth + 'px' }">
        <view v-if="showBack" class="back-btn" @click="goBack">
          <AppIcon name="arrow-left" size="36rpx" color="#1D1B18" />
        </view>
        <text v-if="showBack" class="bar-title">{{ title }}</text>
      </view>
      <view v-if="!showBack" class="large-title">
        <view class="titles">
          <text v-if="overline" class="overline">{{ overline }}</text>
          <text class="title">{{ title }}</text>
        </view>
        <view v-if="showChildSwitcher && currentChild" class="child-pill" @click="pickChild">
          <ChildAvatar :name="currentChild.name" :index="currentIndex" size="56rpx" :ring="true" />
          <text class="child-name">{{ currentChild.name }}</text>
          <AppIcon v-if="parentStore.children.length > 1" name="chevron-down" size="24rpx" color="#5C5751" />
        </view>
      </view>
    </view>

    <view v-if="showChildSwitcher && !immersive && parentStore.isReadOnly" class="readonly-banner">
      <AppIcon name="lock" size="28rpx" color="#8A4B0F" />
      <text>{{ currentChild?.name }} 已离校，历史课评与相册可查看至 {{ readOnlyUntilText }}</text>
    </view>

    <view class="page-body" :class="{ flush: immersive }">
      <slot />
    </view>

    <ParentTabBar v-if="tab" :current="tab" :unread="unread" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import ParentTabBar, { type ParentTabKey } from './ParentTabBar.vue';
import ChildAvatar from './ChildAvatar.vue';
import { useParentStore } from '../../stores/parentStore';

withDefaults(
  defineProps<{
    title: string;
    overline?: string;
    tab?: ParentTabKey;
    showBack?: boolean;
    showChildSwitcher?: boolean;
    immersive?: boolean;
    unread?: number;
  }>(),
  { overline: '', showBack: false, showChildSwitcher: true, immersive: false, unread: 0 },
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

const currentChild = computed(() => parentStore.currentChild);
const currentIndex = computed(() =>
  Math.max(0, parentStore.children.findIndex((c) => c.studentId === currentChild.value?.studentId)),
);

const readOnlyUntilText = computed(() => {
  const until = currentChild.value?.readOnlyUntil;
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
@import '../styles/tokens.scss';

.parent-page {
  min-height: 100vh;
  background: $p-canvas;
  color: $p-ink;

  &.has-tab-bar {
    padding-bottom: calc(176rpx + env(safe-area-inset-bottom));
  }
}

.parent-header {
  background: $p-canvas;
}

.bar {
  height: 88rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-left: 20rpx;
}

.back-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: $p-fill;
  }
}

.bar-title {
  font-size: 32rpx;
  font-weight: 600;
}

.large-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
  padding: 4rpx 36rpx 28rpx;
  animation: p-fade-in 0.35s ease both;
}

.titles {
  min-width: 0;
}

.overline {
  display: block;
  font-size: 24rpx;
  color: $p-ink-3;
  letter-spacing: 0.04em;
}

.title {
  display: block;
  margin-top: 4rpx;
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.child-pill {
  @include p-pressable;
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  max-width: 320rpx;
  padding: 8rpx 20rpx 8rpx 8rpx;
  border-radius: 9999rpx;
  background: $p-surface;
  box-shadow: $p-shadow;
  flex-shrink: 0;
}

.child-name {
  font-size: 26rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.readonly-banner {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin: 0 32rpx 20rpx;
  padding: 20rpx 24rpx;
  border-radius: $p-r-sm;
  background: $p-amber-50;
  font-size: 24rpx;
  line-height: 1.6;
  color: $p-amber-ink;
}

.page-body {
  padding: 0 32rpx 32rpx;

  &.flush {
    padding: 0;
  }
}

.float-back {
  position: fixed;
  left: 24rpx;
  z-index: 950;
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    transform: scale(0.94);
  }
}
</style>
