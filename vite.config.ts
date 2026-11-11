import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { precompress } from './build/vite-precompress'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
    precompress(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    // 超过 800 KB 的 chunk 给出警告 (视频压缩库 mediabunny 约 750 KB 且为按需加载)，避免再把大体积数据或整库打进首屏
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Element Plus 组件不再强制打成一个整包 (原 vendor-element 1 MB 且首屏预加载)，按页面实际用到的组件拆分；
        // 但所有组件共用的底层 (工具函数、hooks、弹层定位、lodash 等) 合成一个包，避免每页拆出几十个零碎小文件
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(vue|@vue|vue-router|pinia)\//.test(id)) return 'vendor-vue'
          if (id.includes('node_modules/lucide-vue-next/')) return 'vendor-lucide'
          // 组件和样式文件按页面拆分；样式若进了底层包，入口引入的消息框样式会把底层包拖进首屏
          if (id.includes('node_modules/element-plus/es/components/') || id.includes('node_modules/element-plus/theme-chalk/')) return undefined
          // 不能把 element-plus 的总入口 (es/index.mjs) 和图标库放进来：手动分包会让它们失去 tree-shaking，整库都被打包
          if (/node_modules\/element-plus\/es\/(index|component|plugin|defaults|make-installer)\.mjs/.test(id)) return undefined
          if (/node_modules\/(element-plus|lodash-es|@vueuse|@floating-ui|@popperjs|@ctrl|async-validator|dayjs|memoize-one|normalize-wheel-es)\//.test(id)) {
            return 'vendor-element-base'
          }
          return undefined
        },
      }
    }
  }
})
