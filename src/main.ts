import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus 组件与样式由 unplugin-vue-components 按需引入；
// 命令式组件 (ElMessage 等) 在 47 个文件里是显式 import 的，按需插件不会给它们带样式，这里统一补齐
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/loading/style/css'

import App from './App.vue'
import router from './router'
import '@/assets/styles/index.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
