/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (value: { id?: string }) => value?.id || '',
    translateModuleGroup: (value: { id?: string }) => value?.id || '',
    translateWare: (value: { id?: string }) => value?.id || ''
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(undefined),
  setGameFolderName: vi.fn()
}))

vi.mock('@/store/logic/useGameData', () => ({
  loadGameDataFiles: vi.fn().mockResolvedValue({
    wares: [],
    modules: [],
    moduleGroups: [],
    consumption: {},
    ships: [],
    shipRaces: [],
    shipTypes: [],
    equipments: [],
    equipmentTypes: [],
    slotTags: [],
    consumables: [],
    drones: [],
    missiles: [],
    bullets: [],
    maps: { clusters: {} },
    regionyields: [],
    factions: [],
    defaultMaxes: {},
    shipSlots: {},
    languages: []
  }),
  buildWaresMap: vi.fn(() => ({})),
  buildModulesMap: vi.fn(() => ({})),
  buildModulesByMacroIdMap: vi.fn(() => ({})),
  buildModulesByOutputMap: vi.fn(() => ({})),
  buildMedicalConsumptionMap: vi.fn(() => ({})),
  buildLocalizedModulesMap: vi.fn(() => ({})),
  buildLocalizedModuleGroupsMap: vi.fn(() => ({})),
  findModuleForWare: vi.fn(() => null),
  precomputeCandidateWares: vi.fn(() => ({
    wareSetsByIndustrialRace: {},
    wareSetsByRace: {}
  }))
}))

import { useGameDataStore } from '@/store/useGameDataStore'

describe('useGameDataStore version validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('非法存储版本会回退到默认合法版本', async () => {
    localStorage.setItem('x4_game_version', JSON.stringify({ version: '9.0', beta: false }))

    const store = useGameDataStore()
    await store.initialize()

    expect(store.currentVersion).toBe('8.0')
    expect(store.isBeta).toBe(false)
    expect(store.folderName).toBe('8.0-Diplomacy')
    expect(store.hasStoredVersion).toBe(false)
  })

  it('统一输出完整版本和短版本显示文本', async () => {
    const store = useGameDataStore()
    await store.initialize()

    expect(store.displayVersion('9.0', true, 'Empire')).toBe('9.0-Empire-beta')
    expect(store.displayFullVersion('9.0', true)).toBe('9.0-beta')
    expect(store.displayFullVersion('8.0', false)).toBe('8.0')
    expect(store.versionOptions.map(option => option.label)).toEqual([
      '8.0-Diplomacy',
      '9.0-Empire-beta'
    ])
  })
})
