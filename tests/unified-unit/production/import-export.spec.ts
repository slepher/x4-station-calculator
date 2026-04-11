/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyImportPayload,
  buildExportPayload,
  getModuleImportStats,
  normalizeImportPayload,
  type ImportModuleKey
} from '@/store/logic/importExport'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION } from '@/store/logic/storageVersions'
import type { SavedEmpiresState } from '@/store/useEmpireStore'
import type { SavedFlowPlansState, SavedShipBlueprintsState } from '@/types/x4'

function createEmpireState(): SavedEmpiresState {
  return {
    version: CURRENT_EMPIRE_VERSION,
    activeId: 'empire-a',
    activeStationId: 'station-a',
    list: [
      {
        id: 'empire-a',
        name: 'Empire A',
        stations: [
          {
            id: 'station-a',
            name: 'Station A',
            type: 'industrial',
            count: 1,
            modules: [{ id: 'm1', count: 1 }],
            settings: {
              sunlight: 100,
              useHQ: false,
              manualWorkforce: 0,
              workforcePercent: 100,
              workforceAuto: true,
              considerWorkforceForAutoFill: false,
              supplyWorkforceBonus: false,
              buyMultiplier: 0.5,
              sellMultiplier: 0.5,
              minersEnabled: false,
              internalSupply: false,
              showEmpireGaps: false,
              racePreference: 'argon',
              resourceBufferHours: 1,
              primaryProductBufferHours: 12,
              secondaryProductBufferHours: 2,
              transportShipCapacity: 62000
            },
            lastUpdated: Date.now(),
            lockedWares: [],
            warePriority: {}
          }
        ]
      }
    ]
  }
}

function createFlowState(): SavedFlowPlansState {
  return {
    version: CURRENT_FLOW_VERSION,
    activeId: 'flow-a',
    list: [
      {
        id: 'flow-a',
        name: 'Flow A',
        groups: [
          {
            id: 'group-a',
            name: 'Group A',
            category: 'industrial',
            subCategory: 'default',
            isLocked: false,
            lockedLineage: 'default',
            nodes: [
              {
                id: 'node-a',
                wareId: 'energycells',
                race: 'argon',
                lineage: 'default',
                column: 0,
                isIsolated: true,
                source: 'manual',
                isRoot: true,
                order: 0
              }
            ]
          }
        ],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now()
      }
    ]
  }
}

function createShipState(): SavedShipBlueprintsState {
  return {
    version: 1,
    activeId: 'bp-a',
    list: [
      {
        id: 'bp-a',
        name: 'BP A',
        shipId: 'ship_a',
        connections: [],
        lastUpdated: Date.now()
      }
    ]
  }
}

function createStores(overrides?: {
  empireDirty?: boolean
  flowDirty?: boolean
  shipDirty?: boolean
  flowActiveId?: string | null
  shipActiveId?: string | null
}) {
  const empireState = createEmpireState()
  const flowState = createFlowState()
  const shipState = createShipState()

  if (overrides?.flowActiveId !== undefined) flowState.activeId = overrides.flowActiveId
  if (overrides?.shipActiveId !== undefined) shipState.activeId = overrides.shipActiveId

  const empireStore = {
    savedEmpires: empireState,
    activeEmpireId: empireState.activeId,
    isDirty: overrides?.empireDirty ?? false,
    loadData: vi.fn((data: SavedEmpiresState) => {
      empireStore.savedEmpires = data
      empireStore.activeEmpireId = data.activeId
    }),
    initializeAllStationCaches: vi.fn(),
    saveToStorage: vi.fn()
  }

  const logicFlowStore = {
    savedPlans: flowState,
    isDirty: overrides?.flowDirty ?? false,
    init: vi.fn(() => {
      const raw = localStorage.getItem('x4_logic_flow_plans')
      if (raw) logicFlowStore.savedPlans = JSON.parse(raw)
    })
  }

  const shipBuildStore = {
    savedBlueprints: shipState,
    isDirty: overrides?.shipDirty ?? false,
    activeView: 'production' as const,
    loadBlueprintsFromStorage: vi.fn(() => {
      const raw = localStorage.getItem('x4_ship_blueprints')
      if (raw) shipBuildStore.savedBlueprints = JSON.parse(raw)
    }),
    loadBlueprint: vi.fn()
  }

  const gameDataStore = {
    modulesMap: {
      m1: { id: 'm1', macroId: 'm1_macro', wareId: 'm1' }
    },
    modulesByMacroId: {
      m1_macro: { id: 'm1', macroId: 'm1_macro', wareId: 'm1' }
    }
  } as any

  return { empireStore, logicFlowStore, shipBuildStore, gameDataStore }
}

function allSelected(): Record<ImportModuleKey, boolean> {
  return {
    x4_empire_data: true,
    x4_logic_flow_plans: true,
    x4_ship_blueprints: true
  }
}

describe('import-export logic', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1.1 normalize payload + stats from data envelope', () => {
    // 1.1.1 normalize payload 后统计三模块条目数 #期望: ["empire=1,flow=1,ship=1"]
    const payload = normalizeImportPayload({
      data: {
        x4_empire_data: createEmpireState(),
        x4_logic_flow_plans: createFlowState(),
        x4_ship_blueprints: createShipState()
      }
    })

    const stats = getModuleImportStats(payload)
    expect(stats.length).toBe(3)
    expect(stats).toEqual([
      { key: 'x4_empire_data', count: 1 },
      { key: 'x4_logic_flow_plans', count: 1 },
      { key: 'x4_ship_blueprints', count: 1 }
    ])
  })

  it('1.2 overwrite import applies all selected modules', () => {
    // 1.2.1 overwrite 模式写入 empire/flow/ship 并刷新对应 store #期望: ["applied"]
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = createStores()

    const incomingEmpire = createEmpireState()
    incomingEmpire.activeId = 'imp-empire'
    incomingEmpire.activeStationId = 'imp-station'
    incomingEmpire.list[0]!.id = 'imp-empire'
    incomingEmpire.list[0]!.stations[0]!.id = 'imp-station'

    const incomingFlow = createFlowState()
    incomingFlow.activeId = 'imp-flow'
    incomingFlow.list[0]!.id = 'imp-flow'

    const incomingShip = createShipState()
    incomingShip.activeId = 'imp-bp'
    incomingShip.list[0]!.id = 'imp-bp'

    const result = applyImportPayload({
      mode: 'overwrite',
      selectedModules: allSelected(),
      currentView: 'production',
      payload: normalizeImportPayload({
        x4_empire_data: incomingEmpire,
        x4_logic_flow_plans: incomingFlow,
        x4_ship_blueprints: incomingShip
      }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    expect(result.applied).toEqual(['x4_empire_data', 'x4_logic_flow_plans', 'x4_ship_blueprints'])
    expect(empireStore.loadData).toHaveBeenCalledTimes(1)
    expect(logicFlowStore.init).toHaveBeenCalledTimes(1)
    expect(shipBuildStore.loadBlueprintsFromStorage).toHaveBeenCalledTimes(1)

    const savedEmpire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}') as SavedEmpiresState
    expect(savedEmpire.activeId).toBe('imp-empire')
  })

  it('1.3 incremental import keeps flow activeId when current is dirty', () => {
    // 1.3.1 incremental 且 flow isDirty=true 时保持现有 activeId #期望: ["unchanged"]
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = createStores({ flowDirty: true })

    const incomingFlow = createFlowState()
    incomingFlow.activeId = 'flow-incoming'

    applyImportPayload({
      mode: 'incremental',
      selectedModules: {
        x4_empire_data: false,
        x4_logic_flow_plans: true,
        x4_ship_blueprints: false
      },
      currentView: 'flow',
      payload: normalizeImportPayload({ x4_logic_flow_plans: incomingFlow }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    const savedFlow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}') as SavedFlowPlansState
    expect(savedFlow.activeId).toBe('flow-a')
    expect(savedFlow.list.length).toBe(2)
  })

  it('1.4 incremental ship import regenerates ids to avoid collisions', () => {
    // 1.4.1 incremental 导入 ship 时冲突 id 重生且无冲突 #期望: ["no-id-collision"]
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = createStores()

    const incomingShip = createShipState()
    incomingShip.activeId = 'bp-a'
    incomingShip.list[0]!.id = 'bp-a'

    applyImportPayload({
      mode: 'incremental',
      selectedModules: {
        x4_empire_data: false,
        x4_logic_flow_plans: false,
        x4_ship_blueprints: true
      },
      currentView: 'ship-build',
      payload: normalizeImportPayload({ x4_ship_blueprints: incomingShip }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    const savedShip = JSON.parse(localStorage.getItem('x4_ship_blueprints') || '{}') as SavedShipBlueprintsState
    expect(savedShip.list.length).toBe(2)
    const ids = savedShip.list.map((item) => item.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain('bp-a')
  })

  it('1.5 export payload includes 3 modules and format metadata', () => {
    // 1.5.1 export payload 包含 format/version 与三模块数据 #期望: ["format-ok"]
    const payload = buildExportPayload(createEmpireState(), createFlowState(), createShipState())
    expect(payload.format).toBe('x4-import-export')
    expect(payload.version).toBe(1)
    expect(payload.data.x4_empire_data.version).toBe(CURRENT_EMPIRE_VERSION)
    expect(payload.data.x4_logic_flow_plans.version).toBe(CURRENT_FLOW_VERSION)
    expect(payload.data.x4_empire_data.list.length).toBe(1)
    expect(payload.data.x4_logic_flow_plans.list.length).toBe(1)
    expect(payload.data.x4_ship_blueprints.list.length).toBe(1)
  })
})
