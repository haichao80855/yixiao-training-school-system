<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';

onLaunch(() => {
  console.log('App Launch: 一校教培移动端启动');
  // 检查本地 Token
  const token = uni.getStorageSync('token');
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1]?.route || '';
  if (!token) {
    if (currentPage !== 'pages/login/index') {
      uni.reLaunch({ url: '/pages/login/index' });
    }
    return;
  }
  // 家长账号进入家长端首页 (教职工工作台页面对家长不可见)
  if (uni.getStorageSync('accountType') === 'parent' && !currentPage.startsWith('package-parent/')) {
    uni.reLaunch({ url: '/package-parent/evaluations/index' });
  }
});

onShow(() => {
  console.log('App Show: 移动端切至前台');
});

onHide(() => {
  console.log('App Hide: 移动端切至后台');
});
</script>

<style lang="scss">
/* ==========================================================================
   一校云 移动端 M3 / Material 3 Expressive 全局样式与动效基座
   ========================================================================== */

page {
  background-color: #F6F8FC;
  color: #0F172A;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -webkit-tap-highlight-color: transparent;

  /* CSS Custom Properties (M3 Tokens) */
  --md-sys-color-primary: #2F54EB;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EEF2FF;
  --md-sys-color-on-primary-container: #0F267A;

  --md-sys-color-secondary: #475569;
  --md-sys-color-on-secondary: #FFFFFF;
  --md-sys-color-secondary-container: #F1F5F9;
  --md-sys-color-on-secondary-container: #1E293B;

  --md-sys-color-tertiary: #0284C7;
  --md-sys-color-on-tertiary: #FFFFFF;
  --md-sys-color-tertiary-container: #E0F2FE;
  --md-sys-color-on-tertiary-container: #075985;

  --md-sys-color-error: #DC2626;
  --md-sys-color-on-error: #FFFFFF;
  --md-sys-color-error-container: #FEE2E2;
  --md-sys-color-on-error-container: #7F1D1D;

  --md-sys-color-surface: #FFFFFF;
  --md-sys-color-surface-dim: #DDE2EC;
  --md-sys-color-surface-bright: #F8FAFD;
  --md-sys-color-surface-container-low: #F6F8FC;
  --md-sys-color-surface-container: #EFF2F8;
  --md-sys-color-surface-container-high: #E8ECF4;
  --md-sys-color-surface-container-highest: #DFE4EE;

  --md-sys-color-outline: #74777F;
  --md-sys-color-outline-variant: rgba(15, 23, 42, 0.08);

  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (prefers-color-scheme: dark) {
  page {
    --md-sys-color-surface: #1E293B;
    --md-sys-color-surface-dim: #0F172A;
    --md-sys-color-surface-bright: #334155;
    --md-sys-color-surface-container-low: #0F172A;
    --md-sys-color-surface-container: #1E293B;
    --md-sys-color-surface-container-high: #334155;
    --md-sys-color-surface-container-highest: #475569;
  }
}

view, text, image, input, button, scroll-view {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* 底部防遮挡垫高通用类 (iPhone Safe Area Insets) */
.tabbar-pad {
  height: calc(140rpx + constant(safe-area-inset-bottom));
  height: calc(140rpx + env(safe-area-inset-bottom));
}

.bottom-safe-space {
  height: calc(80rpx + constant(safe-area-inset-bottom));
  height: calc(80rpx + env(safe-area-inset-bottom));
}

/* Material Motion 硬件加速微交互通用类 (Hardware-Accelerated 60fps Micro-interactions) */
.m3-pressable,
.m3-touch-feedback {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  &:active,
  &.m3-pressable-active,
  &.m3-touch-active {
    transform: scale(0.97);
    opacity: 0.92;
  }
}

.m3-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  &:active,
  &.m3-card-active {
    transform: scale(0.985);
    box-shadow: 0 2rpx 10rpx rgba(15, 23, 42, 0.02);
  }
}

.m3-btn {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.18s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  &:active,
  &.m3-btn-active {
    transform: scale(0.95);
  }
}

.m3-chip,
.m3-pill {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1), color 0.2s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  &:active,
  &.m3-chip-active {
    transform: scale(0.94);
  }
}

/* 优雅平滑出现动画 */
@keyframes m3FadeSlideUp {
  0% {
    opacity: 0;
    transform: translateY(16rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.m3-animate-slide-up {
  animation: m3FadeSlideUp 0.35s cubic-bezier(0.05, 0.7, 0.1, 1) both;
}
</style>
