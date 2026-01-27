import { createI18n } from 'vue-i18n'

// 1. 批量导入所有 locales/*.json 文件
// eager: true 表示直接打包进来，如果文件很多很大，可以去掉 eager 改为异步加载
const modules = import.meta.glob('@/assets/locales/*.json', { eager: true })

// 2. 构建 messages 对象
const messages: Record<string, any> = {}

for (const path in modules) {
  // 从路径 "/src/assets/locales/zh-CN.json" 提取 "zh-CN"
  const matched = path.match(/([a-zA-Z0-9-_]+)\.json$/)
  if (matched && matched[1]) {
    const locale = matched[1]
    messages[locale] = (modules[path] as any).default
  }
}

// 3. 创建 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN', // 默认语言
  fallbackLocale: 'en',
  messages: messages // 动态填入
})

export default i18n