import { createI18n } from 'vue-i18n'
import Cookies from 'js-cookie'

import uiEn from '@/locales/en.json'

const uiLocaleLoaders = import.meta.glob('/src/locales/!(en).json')

// Pre-load all game locale loaders at build time
const gameLocaleLoaders8 = import.meta.glob('/src/assets/x4_game_data/8.0-Diplomacy/locales/*.json')
const gameLocaleLoaders9 = import.meta.glob('/src/assets/x4_game_data/9.0-Empire/locales/*.json')

const gameLocaleLoadersMap: Record<string, Record<string, () => Promise<any>>> = {
  '8.0-Diplomacy': gameLocaleLoaders8,
  '9.0-Empire': gameLocaleLoaders9
}

let currentGameFolderName = '8.0-Diplomacy'
const loadedLanguages = new Set<string>()

function getGameLocaleLoaders(): Record<string, () => Promise<any>> {
  return gameLocaleLoadersMap[currentGameFolderName] || gameLocaleLoaders8
}

export function setGameFolderName(folderName: string) {
  const changed = currentGameFolderName !== folderName
  currentGameFolderName = folderName
  if (changed) {
    loadedLanguages.delete(i18n.global.locale.value)
  }
}

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
    en: {
      ...uiEn
    }
  }
})

const getUiLocaleLoader = (lang: string) => uiLocaleLoaders[`/src/locales/${lang}.json`]
const getGameLocaleLoader = (lang: string) => {
  const loaders = getGameLocaleLoaders()
  return loaders[`/src/assets/x4_game_data/${currentGameFolderName}/locales/${lang}.json`]
}

const loadLocaleMessages = async (lang: string) => {
  const gameLoader = getGameLocaleLoader(lang)
  if (!gameLoader) {
    throw new Error(`[i18n] Game locale '${lang}' not found`)
  }
  const gameMsg = await gameLoader() as { default: Record<string, any> }

  let uiMsg: Record<string, any> = {}
  if (lang === 'en') {
    uiMsg = uiEn
  } else {
    const uiLoader = getUiLocaleLoader(lang)
    if (uiLoader) {
      const uiModule = await uiLoader() as { default: Record<string, any> }
      uiMsg = uiModule.default
    } else {
      uiMsg = uiEn
      console.warn(`[i18n] UI translation for '${lang}' not found, falling back to English UI.`)
    }
  }

  ;(i18n.global as any).setLocaleMessage(lang, {
    ...uiMsg,
    ...gameMsg.default
  })
  loadedLanguages.add(lang)
}

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
  if (loadedLanguages.has(lang) && i18n.global.locale.value === lang) {
    return lang
  }

  // 2. 如果物理文件已加载但 locale 没对齐，直接执行物理切换
  if (loadedLanguages.has(lang)) {
    return setI18nLanguage(lang)
  }

  // 3. 动态加载文件
  try {
    await loadLocaleMessages(lang)
    return setI18nLanguage(lang)
  } catch (error) {
    console.error(`[i18n] Failed to load language: ${lang}`, error)
    if (lang !== 'en') {
      if (!loadedLanguages.has('en')) {
        await loadLocaleMessages('en')
      }
      return setI18nLanguage('en')
    }
  }
}

export async function initI18n() {
  const targetLocale = getInitialLocale()
  await loadLanguageAsync(targetLocale)
}

export default i18n
