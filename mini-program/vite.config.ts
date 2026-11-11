import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import path from 'path';
import { precompress } from '../build/vite-precompress';

export default defineConfig({
  // H5 构建产物生成 .gz / .br 供 Nginx 直接发送 (小程序构建不受影响：只处理 js/css/html/svg/json 中 >1KB 的文件)
  plugins: [uni(), ...(process.env.UNI_PLATFORM === 'h5' ? [precompress()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
  },
});
