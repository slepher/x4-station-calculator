import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path' // 需引入 path 模块

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/x4-station-calculator/', // 你的 GitHub 仓库名
  preview: {
    port: 4173,
    strictPort: true,
  },
  resolve: {
    alias: {
      // 关键配置：让 Vite 知道 @ 代表 src 目录
      '@': path.resolve(__dirname, './src') 
    }
  },
  server: {
    watch: {
      // 排除 openspec, tests 文件夹
      ignored: ['openspec/**', 'tests/**']
    }
  }
})