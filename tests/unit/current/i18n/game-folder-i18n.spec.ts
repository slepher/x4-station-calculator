/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const uiMessages = import.meta.glob<Record<string, any>>('/src/locales/*.json', { eager: true, import: 'default' })
const gameMessages = import.meta.glob<Record<string, string>>('/src/assets/x4_game_data/*/locales/*.json', { eager: true, import: 'default' })
const locales = Object.keys(uiMessages).map(path => path.split('/').pop()!.replace('.json', ''))

describe('i18n game folder loading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    document.cookie = 'user_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it.each(locales)('loads %s UI and game messages across 8.0 → 9.0 → 8.0, including inactive caches', async (locale) => {
    const mod = await import('@/i18n')
    for (const folder of ['8.0-Diplomacy', '9.0-Empire', '8.0-Diplomacy']) {
      mod.setGameFolderName(folder)
      await mod.changeLanguage(locale)
      expect(mod.default.global.locale.value).toBe(locale)
      const ui = uiMessages[`/src/locales/${locale}.json`]!
      const game = gameMessages[`/src/assets/x4_game_data/${folder}/locales/${locale}.json`]!
      expect(game).toBeDefined()
      expect(Object.keys(game).filter(key => key in ui)).toEqual([])
      expect(mod.default.global.getLocaleMessage(locale)).toEqual({ ...ui, ...game })
      expect(mod.default.global.t('empire.empire_name')).toBe(ui.empire.empire_name)
      expect(mod.default.global.t('map.binding_button')).toBe(ui.map.binding_button)
      expect(mod.default.global.t('station.stats_time')).toBe(ui.station.stats_time)
      expect(mod.default.global.t('ui.total_volume')).toBe(ui.ui.total_volume)
      expect(mod.default.global.t('{1001,11000}')).toBe(game['{1001,11000}'])
      // Leave the tested locale inactive before switching game folders.
      await mod.changeLanguage('en')
    }
  })

  it.each(locales.filter(locale => locale !== 'en'))('falls back from missing %s UI and game keys to current-version English', async (locale) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mod = await import('@/i18n')
    for (const folder of ['8.0-Diplomacy', '9.0-Empire', '8.0-Diplomacy']) {
      mod.setGameFolderName(folder)
      await mod.changeLanguage(locale)
      const englishGame = gameMessages[`/src/assets/x4_game_data/${folder}/locales/en.json`]!
      const englishUi = uiMessages['/src/locales/en.json']!
      // Simulate a future missing translation without changing shipped dictionaries.
      const messages = { ...mod.default.global.getLocaleMessage(locale) }
      messages.common = { ...messages.common }
      delete messages.common.others
      delete messages['{1001,11000}']
      mod.default.global.setLocaleMessage(locale, messages)
      expect(mod.default.global.t('common.others')).toBe(englishUi.common.others)
      expect(mod.default.global.t('{1001,11000}')).toBe(englishGame['{1001,11000}'])
      expect(mod.default.global.getLocaleMessage('en')).toEqual({ ...englishUi, ...englishGame })
    }
  })

  it('keeps English selected when an unsupported language fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await import('@/i18n')
    mod.setGameFolderName('9.0-Empire')
    expect(await mod.changeLanguage('unsupported')).toBe('en')
    expect(mod.default.global.locale.value).toBe('en')
    expect(mod.default.global.t('{20201,7601}')).toBe('Allographyne')
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
