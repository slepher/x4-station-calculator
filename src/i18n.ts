import { createI18n } from 'vue-i18n'

// 1. 默认导入英文作为 Fallback 基础包
import uiEn from '@/locales/en.json'
// 这里为了首屏速度，我们也可以先把默认的游戏英文包导进来
// 注意：路径里的版本号 'Timelines (7.10)' 最好提取为常量配置，这里暂时硬编码
import gameEn from '@/assets/game_data/Timelines (7.10)/locales/en.json'

// 2. 初始化 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: 'en', // 默认语言
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
    i18n.global.locale.value = lang
    document.querySelector('html')?.setAttribute('lang', lang)
  }
  return lang
}

/**
 * ★ 异步加载语言包 (核心函数)
 */
export async function loadLanguageAsync(lang: string) {
  // 1. 如果是当前语言，直接返回
  console.log('loadLanguageAsync', lang)
  if (i18n.global.locale.value === lang) {
    return setI18nLanguage(lang)
  }

  // 2. 如果已经加载过，直接切换
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