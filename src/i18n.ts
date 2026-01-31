import { createI18n } from 'vue-i18n'
import Cookies from 'js-cookie'

// 1. 默认导入英文作为 Fallback 基础包
import uiEn from '@/locales/en.json'
// 这里为了首屏速度，我们也可以先把默认的游戏英文包导进来
// 注意：路径里的版本号 'Timelines (7.10)' 最好提取为常量配置，这里暂时硬编码
import gameEn from '@/assets/game_data/Timelines (7.10)/locales/en.json'

// ★ 物理优先级：Cookie > 浏览器语言 > 默认 'en'
const getInitialLocale = () => {
  const saved = Cookies.get('user_locale')
  if (saved) return saved
  return navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
}

// 2. 初始化 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(), // 从持久化层读取
  fallbackLocale: 'en', // ★ 关键：UI 缺失时回退到这里
  globalInjection: true,
  messages: {
    'en': {
      ...uiEn,
      ...gameEn
    }
  }
})

// 记录已加载的语言，避免重复请求
const loadedLanguages = ['en']

/**
 * 切换语言并更新 HTML 属性
 */
function setI18nLanguage(lang: string) {
  if (i18n.global.locale.value !== lang) {
    // 支持 Composition API 模式下的 Ref 更新
    (i18n.global.locale as any).value = lang
    document.querySelector('html')?.setAttribute('lang', lang)
    // ★ 物理写入 Cookie，有效期 365 天
    Cookies.set('user_locale', lang, { expires: 365, path: '/' })
  }
  return lang
}

/**
 * ★ 外部调用的切换接口
 */
export async function changeLanguage(lang: string) {
  await loadLanguageAsync(lang)
  return setI18nLanguage(lang)
}

/**
 * 内部异步加载逻辑
 */
export async function loadLanguageAsync(lang: string) {
  // 1. 物理检查：只有当语言包已加载 且 locale 属性已对齐时才跳过
  if (loadedLanguages.includes(lang) && i18n.global.locale.value === lang) {
    return lang
  }

  // 2. 如果物理文件已加载但 locale 没对齐，直接执行物理切换
  if (loadedLanguages.includes(lang)) {
    return setI18nLanguage(lang)
  }

  // 3. 动态加载文件
  try {
    // A. 加载游戏数据 (Python 生成的，必然存在)
    // Vite 的 import 必须包含一部分静态路径以便静态分析
    const gameMsg = await import(`@/assets/game_data/Timelines (7.10)/locales/${lang}.json`)

    // B. 加载 UI 数据 (可能不存在，需要容错)
    let uiMsg = {}
    try {
      // 尝试加载对应的 UI 翻译
      const module = await import(`@/locales/${lang}.json`)
      uiMsg = module.default
    } catch (e) {
      // 捕获 "Module not found" 错误
      console.warn(`[i18n] UI translation for '${lang}' not found, falling back to English UI.`)
      // 这里不需要做任何事，因为 uiMsg 默认为空，
      // Vue I18n 会因为找不到 key 而自动去 fallbackLocale ('en') 里找
    }

    // C. 合并并设置
    i18n.global.setLocaleMessage(lang, {
      ...uiMsg,          // UI 部分 (如果没加载到就是空的)
      ...gameMsg.default // 游戏数据部分
    })

    loadedLanguages.push(lang)
    return setI18nLanguage(lang)
    
  } catch (error) {
    console.error(`[i18n] Failed to load language: ${lang}`, error)
  }
}

export default i18n