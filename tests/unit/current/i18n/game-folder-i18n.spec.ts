/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('i18n game folder loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    document.cookie = 'user_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it.each([
    ['zh-TW', '帝國名稱'],
    ['ja', '帝国名']
  ])('loads %s UI and game messages for both game versions', async (locale, name) => {
    const mod = await import('@/i18n')
    for (const folder of ['8.0-Diplomacy', '9.0-Empire']) {
      mod.setGameFolderName(folder)
      await mod.changeLanguage(locale)
      expect(mod.default.global.locale.value).toBe(locale)
      expect(mod.default.global.t('empire.empire_name')).toBe(name)
      expect(mod.default.global.t('{1001,11000}')).not.toBe('{1001,11000}')
    }
  })

  it.each([
    ['zh-TW', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['zh-CN', 'zh-CN'],
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['en-US', 'en']
  ])('selects %s browser language as %s', async (browserLocale, expected) => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLocale)
    const mod = await import('@/i18n')
    await mod.initI18n()
    expect(mod.default.global.locale.value).toBe(expected)
  })

  it('keeps the saved language ahead of the browser language', async () => {
    document.cookie = 'user_locale=zh-TW; path=/'
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP')
    const mod = await import('@/i18n')
    await mod.initI18n()
    expect(mod.default.global.locale.value).toBe('zh-TW')
  })

  it('切到 9.0 后会重新载入英文游戏语言包', async () => {
    const mod = await import('@/i18n')

    mod.setGameFolderName('9.0-Empire')
    await mod.loadLanguageAsync('en')

    expect(mod.default.global.t('{20201,7601}')).toBe('Allographyne')
    expect(mod.default.global.t('{20104,120201}')).toBe('Allographyne Scrap Processor')
    expect(mod.default.global.t('common.others')).toBe('Others')

    await mod.loadLanguageAsync('zh-CN')
    expect(mod.default.global.t('common.others')).toBe('其他')
  })
})
