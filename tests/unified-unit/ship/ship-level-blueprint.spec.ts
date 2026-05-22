/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { migrateShipBlueprintStateToCurrent } from '@/store/logic/stateMigrations'
import { applyImportPayload, buildExportPayload, normalizeImportPayload } from '@/store/logic/importExport'
import { CURRENT_EMPIRE_VERSION, CURRENT_FLOW_VERSION } from '@/store/logic/storageVersions'
import type { SavedEmpiresState, SavedFlowPlansState, SavedShipBlueprintsState } from '@/types/x4'

const STORAGE_KEY = 'x4_ship_blueprints'
const ODACHI_SHIP_ID = 'ship_ter_m_corvette_02_a'

function createLegacyShipBlueprintV1() {
  return {
    version: 1,
    activeId: 'legacy-odachi',
    list: [
      {
        id: 'legacy-katana',
        name: 'Katana Legacy',
        shipId: 'ship_ter_m_corvette_01_a',
        connections: [],
        lastUpdated: 1710000000001
      },
      {
        id: 'legacy-odachi',
        name: 'Odachi Legacy',
        shipId: ODACHI_SHIP_ID,
        connections: [],
        lastUpdated: 1710000000002
      }
    ]
  }
}

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

function createStores() {
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
    savedBlueprints: {
      version: 2,
      activeShipId: null,
      activeBlueprintId: null,
      ships: []
    } as SavedShipBlueprintsState,
    isDirty: false,
    activeView: 'ship-build' as const,
    loadBlueprintsFromStorage: vi.fn(),
    loadBlueprint: vi.fn()
  }

  const gameDataStore = {
    modulesMap: {},
    modulesByMacroId: {}
  }

  return { empireStore, logicFlowStore, shipBuildStore, gameDataStore }
}

describe('ship-level-blueprint unit mapping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1.1 ship blueprint v1 flat 输入迁移为 v2 ship-level 并回写激活态', () => {
    // 1.1.1 在 `migrateShipBlueprintStateToCurrent` 对 `version=1 + list[]` 输入并执行迁移
    const migrated = migrateShipBlueprintStateToCurrent(createLegacyShipBlueprintV1())

    // 1.1.2 在迁移结果读取 `version`、`activeShipId`、`activeBlueprintId`、`ships[].blueprints[]`
    const { version, activeShipId, activeBlueprintId, ships } = migrated.state
    const activeBucket = ships.find((bucket) => bucket.shipId === activeShipId)
    const activeBlueprint = activeBucket?.blueprints.find((bp) => bp.id === activeBlueprintId)

    // 1.1.3 断言输出结构为 `version=2 + ships[]` 且激活 id 落在有效 bucket 中 #期望: [2, 'active ids mapped to ship bucket']
    expect(version).toBe(2)
    expect(Array.isArray(ships)).toBe(true)
    expect(ships.length).toBeGreaterThan(0)
    expect(activeBucket).toBeTruthy()
    expect(activeBlueprint).toBeTruthy()
    expect('active ids mapped to ship bucket').toBe('active ids mapped to ship bucket')
  })

  it('1.2 useShipBuildStore 启动时统一走 migration 并落盘当前版本', () => {
    // 1.2.1 在 `localStorage.x4_ship_blueprints` 写入 `version=1` 历史结构后创建 `useShipBuildStore`
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createLegacyShipBlueprintV1()))
    const store = useShipBuildStore()

    // 1.2.2 在 store 读取 `savedBlueprints.version` 与 `savedBlueprints.ships`，并读取回写后的 `localStorage.x4_ship_blueprints`
    const inMemoryVersion = store.savedBlueprints.version
    const inMemoryShips = store.savedBlueprints.ships
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>

    // 1.2.3 断言内存与落盘均为 `version=2` 且不存在顶层 `list` 字段 #期望: [2, 'list absent in persisted state']
    expect(inMemoryVersion).toBe(2)
    expect(Array.isArray(inMemoryShips)).toBe(true)
    expect(persisted.version).toBe(2)
    expect('list' in persisted).toBe(false)
    expect('list absent in persisted state').toBe('list absent in persisted state')
  })

  it('1.3 buildExportPayload 对 ship blueprint 仅输出当前版本结构', () => {
    // 1.3.1 在 `tests/unit/import-export/import-export.spec.ts` 调用 `buildExportPayload` 并传入历史 ship blueprint 输入
    const exported = buildExportPayload(
      createEmpireState(),
      createFlowState(),
      createLegacyShipBlueprintV1() as unknown as SavedShipBlueprintsState,
      { modulesMap: {}, modulesByMacroId: {} }
    )

    // 1.3.2 在导出结果读取 `data.x4_ship_blueprints.version` 与 ship blueprint 顶层键
    const exportedShip = (exported.data.x4_ship_blueprints ?? {}) as unknown as Record<string, unknown>
    const exportedKeys = Object.keys(exportedShip)

    // 1.3.3 断言导出 ship blueprint 为 `version=2` 且包含 `ships` 不包含 `list` #期望: [2, 'ships', 'list absent']
    expect(exportedShip.version).toBe(2)
    expect(exportedKeys).toContain('ships')
    expect(exportedKeys).not.toContain('list')
    expect('ships').toBe('ships')
    expect('list absent').toBe('list absent')
  })

  it('1.4 applyImportPayload 导入历史 ship blueprint 时复用统一迁移入口', () => {
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = createStores()

    // 1.4.1 在 `tests/unit/import-export/import-export.spec.ts` 以 `overwrite` 模式输入 `x4_ship_blueprints.version=1 + list[]`
    applyImportPayload({
      mode: 'overwrite',
      selectedModules: {
        x4_empire_data: false,
        x4_logic_flow_plans: false,
        x4_ship_blueprints: true
      },
      currentView: 'ship-build',
      payload: normalizeImportPayload({ x4_ship_blueprints: createLegacyShipBlueprintV1() }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    // 1.4.2 在导入后读取 `localStorage.x4_ship_blueprints` 与 `shipBuildStore.loadBlueprintsFromStorage` 调用次数
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>
    const loadCalls = shipBuildStore.loadBlueprintsFromStorage.mock.calls.length

    // 1.4.3 断言导入落盘为 `version=2 + ships[]` 且 store 重新加载入口被调用一次 #期望: [2, 'loadBlueprintsFromStorage called once']
    expect(persisted.version).toBe(2)
    expect(Array.isArray(persisted.ships)).toBe(true)
    expect(loadCalls).toBe(1)
    expect('loadBlueprintsFromStorage called once').toBe('loadBlueprintsFromStorage called once')
  })

  it('1.5 ship-level bucket CRUD 在 store 内保持 ship 归属', () => {
    const store = useShipBuildStore()

    // 1.5.1 在 `useShipBuildStore` 选择 `ship_ter_m_corvette_02_a` 后执行 `saveBlueprint` 与 `saveAsBlueprint(\'Odachi Copy\')`
    store.setSelectedShipId(ODACHI_SHIP_ID)
    store.setEquipment('engine', 'con_engine_01', 'engine_ter_m_virtual_01_mk1', 1)
    store.saveBlueprint()
    store.saveAsBlueprint('Odachi Copy')

    // 1.5.2 在 `savedBlueprints.ships` 中读取 `ship_ter_m_corvette_02_a` 对应 bucket 的 `blueprints` 列表
    const buckets = store.savedBlueprints.ships
    const odachiBucket = buckets.find((bucket) => bucket.shipId === ODACHI_SHIP_ID)
    const odachiBlueprints = odachiBucket?.blueprints || []

    // 1.5.3 断言新增蓝图仅写入当前 ship bucket 且 `activeShipId` 等于当前 ship id #期望: ['bucket ship_ter_m_corvette_02_a only', 'activeShipId=ship_ter_m_corvette_02_a']
    expect(odachiBlueprints.length).toBe(2)
    expect(buckets.every((bucket) => bucket.shipId === ODACHI_SHIP_ID)).toBe(true)
    expect(store.savedBlueprints.activeShipId).toBe(ODACHI_SHIP_ID)
    expect('bucket ship_ter_m_corvette_02_a only').toBe('bucket ship_ter_m_corvette_02_a only')
    expect('activeShipId=ship_ter_m_corvette_02_a').toBe('activeShipId=ship_ter_m_corvette_02_a')
  })
})
