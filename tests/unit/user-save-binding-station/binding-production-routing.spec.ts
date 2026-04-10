/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/StationStateMap'
import type { SaveArchive } from '@/types/saveArchive'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' },
      t: (key: string) => key
    }),
    createI18n: actual.createI18n
  }
})

vi.mock('@/store/useGameDataStore', async () => {
  const { defineStore } = await import('pinia')
  const { ref } = await import('vue')
  const useGameDataStore = defineStore('gameData', () => {
    const isReady = ref(true)
    const waresMap = ref({})
    const modulesMap = ref({
      prod_test_macro: { id: 'prod_test_macro', inputs: {}, outputs: {}, buildCost: {}, workforce: { needed: 0, capacity: 0 } },
      prod_other_macro: { id: 'prod_other_macro', inputs: {}, outputs: {}, buildCost: {}, workforce: { needed: 0, capacity: 0 } }
    })
    const localizedModulesMap = ref({})
    const localizedModuleGroupsMap = ref({})
    const medicalConsumptionMap = ref({})
    const searchQuery = ref('')
    const currentLocale = ref('en')
    const activeDlcs = ref<string[]>([])
    const enforceDlcActivation = ref(false)
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      isReady,
      getStorageKey: (kind: string) => kind === 'save_archives' ? 'x4_save_archives' : `x4_${kind}_data`,
      waresMap,
      modulesMap,
      localizedModulesMap,
      localizedModuleGroupsMap,
      medicalConsumptionMap,
      searchQuery,
      currentLocale,
      activeDlcs,
      enforceDlcActivation,
      isDlcActive: vi.fn(() => true)
    }
  })
  return {
    useGameDataStore
  }
})

import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useStationStore } from '@/store/useStationStore'

function makeArchive(): SaveArchive {
  return {
    meta: {
      guid: 'game-1',
      seed: 1,
      time: 100,
      playerName: 'Player',
      version: '8.0',
      filename: 'save.xml',
      parser_version: 'v3',
      source: 'imported'
    },
    isCompatible: true,
    isValid: true,
    sectors: {
      sector_macro_a: {
        name: 'Sector A',
        is_known: true,
        clusterGates: [],
        superhighwayGates: [],
        highways: [],
        player_stations: {
          save_alpha: {
            code: 'save_alpha',
            macro: 'station_macro',
            owner: 'player',
            relative_position: { x: 0, y: 0, z: 0 },
            position: { x: 0, y: 0, z: 0 }
          }
        }
      } as any
    }
  }
}

function loadBindingFixture() {
  const saveStore = useSaveStore()
  saveStore.selectedArchive = makeArchive()

  const bindingStore = useSaveBindingStore()
  bindingStore.loadData({
    version: 1,
    activeGameGuid: 'game-1',
    list: [{
      gameGuid: 'game-1',
      selectedArchiveTime: 100,
      groups: [{
        id: 'group-a',
        name: 'Group A',
        order: 0,
        sectorMacro: 'sector_macro_a',
        jumpRange: 0,
        coverageSectorMacros: [{ ref: 'sector_macro_a', name: 'Sector A' }],
        connectedGroupIds: []
      }],
      stationPlans: [{
        id: 'plan-alpha',
        saveStationCode: 'save_alpha',
        groupId: 'group-a',
        name: 'Alpha Plan',
        type: 'industrial',
        modules: [],
        settings: { ...DEFAULT_STATION_SETTINGS }
      }],
      updatedAt: 1
    }]
  })
  bindingStore.createOrOpenBinding('game-1', 100)
}

describe('user-save-binding-station production routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('routes module and settings edits into the binding draft and exposes binding dirty state', async () => {
    loadBindingFixture()
    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')

    const derivedStationId = empire.orderedStationsBySector[0]?.id
    expect(derivedStationId).toBe('__save_binding__game-1__plan-alpha')
    empire.selectStation(derivedStationId)

    const station = useStationStore()
    station.addModule('prod_test_macro', 2)
    station.updateSetting('racePreference', 'terran')

    const binding = useSaveBindingStore()
    const plan = binding.activeBinding?.stationPlans.find((item) => item.id === 'plan-alpha')
    expect(plan?.modules).toEqual([{ id: 'prod_test_macro', count: 2 }])
    expect(plan?.settings.racePreference).toBe('terran')
    expect(binding.isDirty).toBe(true)
    expect(empire.isDirty).toBe(true)
  })

  it('saveCurrentSource persists binding drafts and clears dirty state in binding mode', async () => {
    loadBindingFixture()
    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')
    empire.selectStation(empire.orderedStationsBySector[0]!.id)

    const station = useStationStore()
    station.addModule('prod_test_macro', 1)

    expect(useSaveBindingStore().isDirty).toBe(true)
    expect((empire as any).saveCurrentSource()).toBe(true)
    expect(useSaveBindingStore().isDirty).toBe(false)

    const persisted = JSON.parse(localStorage.getItem('x4_save_bindings') || '{}')
    expect(persisted.list[0].stationPlans[0].modules).toEqual([{ id: 'prod_test_macro', count: 1 }])
  })

  it('renames and deletes binding station plans using derived station ids', async () => {
    loadBindingFixture()
    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')
    const derivedStationId = empire.orderedStationsBySector[0]!.id

    expect(empire.renameStation(derivedStationId, 'Renamed Alpha')).toBe(true)
    expect(useSaveBindingStore().activeBinding?.stationPlans[0].name).toBe('Renamed Alpha')

    empire.deleteStation(derivedStationId)
    expect(useSaveBindingStore().activeBinding?.stationPlans).toEqual([])
    expect(empire.activeStationId).toBe(null)
  })

  it('selects newly created binding virtual stations by their derived production id', async () => {
    loadBindingFixture()
    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')

    const created = empire.createStation('Virtual', 'industrial')

    expect(created?.id).toMatch(/^__save_binding__game-1__/)
    expect(empire.activeStationId).toBe(created?.id)
    expect(empire.activeStation?.name).toBe('Virtual')
  })

  it('shows explicit save station plans in their binding group even when the save station is not covered by the archive', async () => {
    loadBindingFixture()
    const binding = useSaveBindingStore()
    binding.activeBinding!.stationPlans.push({
      id: 'plan-outside',
      saveStationCode: 'save_outside',
      groupId: 'group-a',
      name: 'Outside Plan',
      type: 'industrial',
      modules: [],
      settings: { ...DEFAULT_STATION_SETTINGS }
    })

    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')

    const outside = empire.orderedStationsBySector.find((station) => station.id === '__save_binding__game-1__plan-outside')
    expect(outside?.sectorId).toBe('group-a')
    expect(outside?.name).toBe('Outside Plan')
  })

  it('derives unplanned save stations from the binding anchor sector even when coverage excludes the anchor', async () => {
    loadBindingFixture()
    const binding = useSaveBindingStore()
    binding.activeBinding!.groups[0].coverageSectorMacros = []
    binding.activeBinding!.stationPlans = []

    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')

    const anchorStation = empire.orderedStationsBySector.find(
      (station) => station.id === '__save_binding_derived__game-1__save_alpha'
    )
    expect(anchorStation?.sectorId).toBe('group-a')
    expect(anchorStation?.name).toBe('save_alpha')
  })

  it('opens binding group transit tabs by binding group id', async () => {
    loadBindingFixture()
    const empire = useEmpireStore()
    await empire.initialize()
    await vi.waitFor(() => expect(empire.isReady).toBe(true), { timeout: 3000 })
    empire.switchToBinding('game-1')

    empire.selectTransitSector('group-a')

    expect(empire.activeStationId).toBe('transit:group-a')
    expect(empire.activeTransitSectorId).toBe('group-a')
    expect(empire.activeStation).toBe(null)
  })
})
