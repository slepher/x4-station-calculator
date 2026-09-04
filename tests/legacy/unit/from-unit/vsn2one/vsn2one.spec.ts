/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyImportPayload, buildExportPayload, normalizeImportPayload } from '@/store/logic/importExport'
import { migrateShipBlueprintStateToCurrent } from '@/store/logic/stateMigrations'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION, CURRENT_SHIP_BLUEPRINT_VERSION } from '@/store/logic/storageVersions'
import type { SavedEmpiresState, SavedFlowPlansState, SavedShipBlueprintsState } from '@/types/x4'

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
            modules: [],
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
        groups: [],
        settings: { isDefaultLocked: true },
        lastUpdated: Date.now()
      }
    ]
  }
}

function createStoreStubs() {
  const shipState: SavedShipBlueprintsState = {
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeId: null,
    list: []
  }

  const empireStore = {
    savedEmpires: createEmpireState(),
    activeEmpireId: 'empire-a',
    isDirty: false,
    loadData: vi.fn(),
    initializeAllStationCaches: vi.fn(),
    saveToStorage: vi.fn()
  }

  const logicFlowStore = {
    savedPlans: createFlowState(),
    isDirty: false,
    init: vi.fn()
  }

  const shipBuildStore = {
    savedBlueprints: shipState,
    isDirty: false,
    activeView: 'ship-build' as const,
    loadBlueprintsFromStorage: vi.fn(() => {
      const raw = localStorage.getItem('x4_ship_blueprints')
      if (raw) shipBuildStore.savedBlueprints = JSON.parse(raw)
    }),
    loadBlueprint: vi.fn()
  }

  const gameDataStore = {
    modulesMap: {},
    modulesByMacroId: {}
  }

  return { empireStore, logicFlowStore, shipBuildStore, gameDataStore }
}

describe('vsn2one', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1.1 blueprint migration 归一化输出', () => {
    const raw = {
      version: 0,
      activeId: 'legacy-active',
      list: [
        {
          id: 'legacy-active',
          name: 'Keep',
          shipId: 'ship_a',
          connections: [],
          lastUpdated: 1
        },
        {
          id: 'drop-me',
          name: 'Drop',
          shipId: '',
          connections: [],
          lastUpdated: 2
        }
      ]
    }

    // 1.1.1 在 `migrateShipBlueprintStateToCurrent` 输入 `version=0` 且包含一个缺失 `shipId` 的条目
    const migrated = migrateShipBlueprintStateToCurrent(raw)

    // 1.1.2 读取迁移结果的 `ships` 与 `activeBlueprintId`
    const next = migrated.state

    // 1.1.3 断言迁移结果过滤无效条目且 `version` 更新到当前版本
    expect(next.ships).toHaveLength(1)
    expect(next.ships[0].blueprints).toHaveLength(1)
    expect(next.activeBlueprintId).toBe('legacy-active')
    expect(next.version).toBe(CURRENT_SHIP_BLUEPRINT_VERSION)
  })

  it('1.1.1 blueprint migration 保留 favorite 字段', () => {
    const raw = {
      version: CURRENT_SHIP_BLUEPRINT_VERSION,
      activeShipId: 'ship_a',
      activeBlueprintId: 'bp-fav',
      ships: [
        {
          shipId: 'ship_a',
          blueprints: [
            {
              id: 'bp-fav',
              name: 'Favorite Blueprint',
              shipId: 'ship_a',
              connections: [],
              materialMethod: 'default',
              lastUpdated: 1,
              favorite: true
            }
          ]
        }
      ]
    }

    const migrated = migrateShipBlueprintStateToCurrent(raw)
    const blueprint = migrated.state.ships[0]?.blueprints[0]

    expect(blueprint?.favorite).toBe(true)
    expect(migrated.state.activeBlueprintId).toBe('bp-fav')
  })

  it('1.2 import/export ship 模组复用统一 migration 路径', async () => {
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = createStoreStubs()

    // 1.2.1 在 import 流程输入 `x4_ship_blueprints.version=0` 并执行 overwrite
    const importResult = await applyImportPayload({
      mode: 'overwrite',
      selectedModules: {
        x4_empire_data: false,
        x4_logic_flow_plans: false,
        x4_ship_blueprints: true
      },
      currentView: 'ship-build',
      payload: normalizeImportPayload({
        x4_ship_blueprints: {
          version: 0,
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
      }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    // 1.2.2 在 export 流程对同一 ship 数据执行 `buildExportPayload`
    const exported = buildExportPayload(
      createEmpireState(),
      createFlowState(),
      {
        version: 0,
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
      },
      gameDataStore as any
    )

    // 1.2.3 断言导入落盘 version 与导出 payload version 都等于当前版本
    expect(importResult.applied).toEqual(['x4_ship_blueprints'])
    const saved = JSON.parse(localStorage.getItem('x4_ship_blueprints') || '{}') as SavedShipBlueprintsState
    expect(saved.version).toBe(CURRENT_SHIP_BLUEPRINT_VERSION)
    expect(exported.data.x4_ship_blueprints!.version).toBe(CURRENT_SHIP_BLUEPRINT_VERSION)
  })
})
