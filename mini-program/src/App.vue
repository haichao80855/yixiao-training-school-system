<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';

onLaunch(() => {
  console.log('App Launch: 一校教培移动端启动');
  // 检查本地 Token
  const token = uni.getStorageSync('token');
  if (!token) {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1]?.route;
    if (currentPage !== 'pages/login/index') {
      uni.reLaunch({ url: '/pages/login/index' });
    }
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
/* 全局页面公共样式 */
page {
  background-color: #F8FAFC;
  color: #1F2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
}

view, text, image, input, button {
  box-sizing: border-box;
}
</style>
