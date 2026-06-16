import { createApp } from 'vue'
import VueTippy from 'vue-tippy'
import { createPinia } from 'pinia'
import './style.css'
import 'tippy.js/dist/tippy.css' // 基础样式
import 'tippy.js/themes/material.css';
import 'vue-color/style.css';
import App from './App.vue'
import i18n, { initI18n } from './i18n'

async function bootstrap() {
  await initI18n()

  // 创建 Pinia 实例
  const pinia = createPinia()
  const app = createApp(App)

  // 挂载中间件
  app.use(pinia)
  app.use(i18n)
  app.use(VueTippy)

  // 开发环境下将 pinia 挂载到 window，方便测试脚本访问
  if (import.meta.env.DEV) {
    (window as any).__pinia = pinia;
  }

  app.mount('#app')
}

void bootstrap()
