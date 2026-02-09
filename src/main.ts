import { createApp } from 'vue'
import VueTippy from 'vue-tippy'
import { createPinia } from 'pinia'
import './style.css'
import 'tippy.js/dist/tippy.css' // 基础样式
import 'tippy.js/themes/material.css';
import App from './App.vue'
import i18n from './i18n'


// 创建 Pinia 实例
const pinia = createPinia()
const app = createApp(App)

// 挂载中间件
app.use(pinia)
app.use(i18n)
app.use(VueTippy)
app.mount('#app')