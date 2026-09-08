// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAssignmentResult,
  buildBridgePlanOptions,
  computeGroupGraph,
  groupCleanSlate,
  type AutoGroupResult,
  type GroupDraftInfo
} from '@/store/logic/autoGroup'
import { useAutoSectorGroupPresenter } from '@/components/empire/presenters/useAutoSectorGroupPresenter'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'
import type { SectorReachability, X4Module } from '@/types/x4'

const calls = vi.hoisted(() => ({
  clean: [] as unknown[][],
  incremental: [] as unknown[][],
  assignment: [] as unknown[][],
  enrich: [] as unknown[][]
}))

vi.mock('@/store/logic/autoGroup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/logic/autoGroup')>()
  return {
    ...actual,
    groupCleanSlate: (...args: Parameters<typeof actual.groupCleanSlate>) => {
      calls.clean.push(args)
      return actual.groupCleanSlate(...args)
    },
    groupIncremental: (...args: Parameters<typeof actual.groupIncremental>) => {
      calls.incremental.push(args)
      return actual.groupIncremental(...args)
    },
    buildAssignmentResult: (...args: Parameters<typeof actual.buildAssignmentResult>) => {
      calls.assignment.push(args)
      return actual.buildAssignmentResult(...args)
    },
    enrichAutoGroupResult: (...args: Parameters<typeof actual.enrichAutoGroupResult>) => {
      calls.enrich.push(args)
      return actual.enrichAutoGroupResult(...args)
    }
  }
})

const A = 'sector-a'
const B = 'sector-b'
const T = 'sector-target'
const X = 'sector-bridge'

const sectorReachability: SectorReachability = {
  [A]: { [A]: 0, [B]: 1, [T]: 1, [X]: 1 },
  [B]: { [B]: 0, [A]: 1, [T]: 2, [X]: 1 },
  [T]: { [T]: 0, [A]: 1, [B]: 2, [X]: 2 },
  [X]: { [X]: 0, [A]: 1, [B]: 1, [T]: 2 }
}

const modulesByMacroId: Record<string, X4Module> = {
  storage: {
    id: 'storage', macroId: 'storage', wareId: '', nameId: '', name: 'storage', dlc_tag: '',
    type: 'storage', method: 'default', group: '', race: '', isPlayerBlueprint: true,
    buildTime: 0, buildCost: {}, cycleTime: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {},
    dockingCount: 0, buildProcessorCount: 0, buildShipClasses: [], color: '', color_rgb: '', tier: 0,
    cargo: { type: 'container', capacity: 10_000_000 }
  },
  production: {
    id: 'production', macroId: 'production', wareId: '', nameId: '', name: 'production', dlc_tag: '',
    type: 'production', method: 'default', group: '', race: '', isPlayerBlueprint: true,
    buildTime: 0, buildCost: {}, cycleTime: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {},
    dockingCount: 0, buildProcessorCount: 0, buildShipClasses: [], color: '', color_rgb: '', tier: 0
  }
}

function station(code: string, module: 'storage' | 'production'): PlayerStationEntry {
  return {
    code,
    macro: 'station_macro',
    owner: 'player',
    relative_position: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    modules: [{ ref: module, amount: 1 }],
    constructions: []
  }
}

function archive(): SaveArchive {
  return {
    meta: {
      id: 'reachability', guid: 'reachability-guid', time: 10, playerName: '', version: '',
      filename: 'reachability', parser_version: '', source: 'json', createdAt: new Date(), sectorCount: 3
    },
    sectors: {
      [A]: { name: A, player_stations: { A1: station('A1', 'storage') } },
      [B]: { name: B, player_stations: { B1: station('B1', 'storage') } },
      [T]: { name: T, player_stations: { T1: station('T1', 'production') } }
    },
    isCompatible: true,
    isValid: true
  }
}

function group(id: string): GroupDraftInfo {
  return {
    id,
    name: id,
    sectorMacro: id,
    jumpRange: 2,
    originalJumpRange: 2,
    coverageSectorMacros: [],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true,
    tradeStationRetainEnabled: true
  }
}

function poisonGraph(label: string) {
  let reads = 0
  const graph = new Proxy({} as Record<string, string[]>, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined
      reads++
      throw new Error(`${label} read sectorGraph.${property}`)
    }
  })
  return { graph, readCount: () => reads }
}

const maps = {
  clusters: {},
  sectors: Object.fromEntries([A, B, T, X].map((macro, index) => [macro, {
    id: macro,
    macro,
    cluster_id: `cluster-${index}`,
    cluster_gates: {}
  }]))
}

const gameData = {
  maps,
  sectorReachability,
  modulesByMacroId,
  modulesMap: modulesByMacroId,
  waresMap: {},
  isReady: false,
  enforceDlcActivation: false
}

const activeView = {
  activeBinding: 'reachability-guid',
  activeBindingStation: null,
  activeBindingWorkbench: 'overview'
}

const useBinding = defineStore('reachability-binding', {
  state: () => ({
    activeBinding: {
      gameGuid: 'reachability-guid',
      bindingName: 'Reachability',
      selectedArchiveTime: 10,
      groups: [],
      stationPlans: [],
      updatedAt: 1
    } as any,
    stationPlans: [] as any[]
  }),
  actions: {
    getBindingByGameGuid() { return this.activeBinding },
    clearDraft() {},
    createAutoGroups() {}
  }
})

const useSave = defineStore('reachability-save', {
  state: () => ({
    selectedArchive: archive(),
    savedArchivesState: { list: [] as any[] },
    archives: new Map()
  })
})

const useBlueprint = defineStore('reachability-blueprint', {
  state: () => ({ savedEmpires: { list: [] as any[] } })
})

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, te: () => false })
}))

vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => gameData }))
vi.mock('@/store/useActiveViewStore', () => ({ useActiveViewStore: () => activeView }))
vi.mock('@/store/useSaveBindingStore', () => ({ useSaveBindingStore: () => useBinding() }))
vi.mock('@/store/useSaveStore', () => ({ useSaveStore: () => useSave() }))
vi.mock('@/store/useBlueprintProductionStore', () => ({ useBlueprintProductionStore: () => useBlueprint() }))

function emptyResult(): AutoGroupResult {
  return { groups: [], assignments: [], bridgePlans: [], playerSectorMacros: [] }
}

function mountPresenter() {
  let presenter!: ReturnType<typeof useAutoSectorGroupPresenter>
  const wrapper = mount(defineComponent({
    setup() {
      presenter = useAutoSectorGroupPresenter()
      return () => h('div')
    }
  }))
  return { presenter, wrapper }
}

beforeEach(() => {
  setActivePinia(createPinia())
  calls.clean.length = 0
  calls.incremental.length = 0
  calls.assignment.length = 0
  calls.enrich.length = 0
})

describe('auto-group algorithms use the supplied reachability table', () => {
  it('computes the group graph without reading sectorGraph', () => {
    const poison = poisonGraph('computeGroupGraph')
    const groups = [group(A), group(B)]

    computeGroupGraph(groups, poison.graph, { [A]: 'cluster-a', [B]: 'cluster-b' }, 5, sectorReachability)

    expect(groups.map((item) => [item.id, item.connectedGroupIds])).toEqual([[A, [B]], [B, [A]]])
    expect(poison.readCount()).toBe(0)
  })

  it('builds assignment distances without reading sectorGraph', () => {
    const poison = poisonGraph('buildAssignmentResult')

    const result = buildAssignmentResult([T], new Map([[A, A]]), [group(A)], poison.graph, { [A]: 'cluster-a', [T]: 'cluster-t' }, sectorReachability)

    expect(result[0]?.options[0]).toMatchObject({ type: 'absorb', targetGroupId: A, distance: 1 })
    expect(poison.readCount()).toBe(0)
  })

  it('builds clean-slate coverage without reading sectorGraph', () => {
    const poison = poisonGraph('groupCleanSlate coverage')

    const result = groupCleanSlate(archive(), modulesByMacroId, poison.graph, {
      [A]: 'cluster-a', [B]: 'cluster-b', [T]: 'cluster-t'
    }, { containerThreshold: 5_000_000 }, 2, 5, [], true, sectorReachability)

    expect(result.groups.find((item) => item.id === A)?.coverageSectorMacros).toContain(T)
    expect(poison.readCount()).toBe(0)
  })

  it('builds bridge candidates and plans without reading sectorGraph', () => {
    const poison = poisonGraph('buildBridgePlanOptions')
    const sectorHubMap = new Map([[X, [{ score: 100 } as any]]])

    const plans = buildBridgePlanOptions(
      [group(A), group(B)],
      [A, B, X],
      sectorHubMap,
      poison.graph,
      { [A]: 'cluster-a', [B]: 'cluster-b', [X]: 'cluster-x' },
      5,
      [],
      sectorReachability
    )

    expect(plans).toHaveLength(1)
    expect(plans[0]?.units.map((unit) => unit.selectedSectorMacro)).toEqual([X])
    expect(poison.readCount()).toBe(0)
  })
})

describe('runtime entry points preserve reachability object identity', () => {
  it('passes the game-data table from presenter clean and incremental calculations', () => {
    const { presenter, wrapper } = mountPresenter()
    const live = useLiveProductionStore()

    live.setAutoGroupResult(null)
    expect(presenter.runCalculationFromEditInput()).toBe(true)
    expect(calls.clean.at(-1)?.[9]).toBe(sectorReachability)

    live.setAutoGroupResult({ ...emptyResult(), groups: [group(A)] })
    expect(presenter.runCalculationFromEditInput()).toBe(true)
    expect(calls.incremental.at(-1)?.[10]).toBe(sectorReachability)

    wrapper.unmount()
  })

  it('passes the game-data table from live-store draft initialization', () => {
    const live = useLiveProductionStore()

    live.initAutoGroupDraft()

    expect(calls.clean.at(-1)?.[9]).toBe(sectorReachability)
    expect(calls.enrich.at(-1)?.[4]).toBe(sectorReachability)
  })
})
