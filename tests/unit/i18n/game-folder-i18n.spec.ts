/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('i18n game folder loading', () => {
  beforeEach(() => {
    vi.resetModules()
    document.cookie = 'user_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('切到 9.0 后会重新载入英文游戏语言包', async () => {
    const mod = await import('@/i18n')

    mod.setGameFolderName('9.0-Empire')
    await mod.loadLanguageAsync('en')

    expect(mod.default.global.t('{20201,7601}')).toBe('Allographyne')
    expect(mod.default.global.t('{20104,120201}')).toBe('Allographyne Scrap Processor')
  })
})
