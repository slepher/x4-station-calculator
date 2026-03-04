/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyImportPayload, normalizeImportPayload } from '@/store/logic/importExport'
import { migrateEmpireStateToCurrent, migrateFlowStateToCurrent } from '@/store/logic/stateMigrations'
import type { SavedEmpiresState, SavedFlowPlansState } from '@/types/x4'

const lookup = {
  modulesMap: {
    module_gen_prod_hullparts_01: {
      id: 'module_gen_prod_hullparts_01',
      macroId: 'prod_gen_hullparts_macro',
      wareId: 'module_gen_prod_hullparts_01'
    },
    module_gen_prod_energycells_01: {
      id: 'module_gen_prod_energycells_01',
      macroId: 'prod_gen_energycells_macro',
      wareId: 'module_gen_prod_energycells_01'
    }
  },
  modulesByMacroId: {
    prod_gen_hullparts_macro: {
      id: 'module_gen_prod_hullparts_01',
      macroId: 'prod_gen_hullparts_macro',
      wareId: 'module_gen_prod_hullparts_01'
    },
    prod_gen_energycells_macro: {
      id: 'module_gen_prod_energycells_01',
      macroId: 'prod_gen_energycells_macro',
      wareId: 'module_gen_prod_energycells_01'
    }
  }
} as any

function createEmpireV2MacroState(): SavedEmpiresState {
  return {
    version: 2,
    activeId: 'imp-empire-1',
    activeStationId: 'imp-station-1',
    list: [
      {
        id: 'imp-empire-1',
        name: 'Imported Empire',
        stations: [
          {
            id: 'imp-station-1',
            name: 'Imported Station',
            type: 'industrial',
            count: 1,
            modules: [
              { id: 'prod_gen_hullparts_macro', count: 1 },
              { id: 'prod_gen_energycells_macro', count: 1 }
            ],
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
            lastUpdated: 1772453451902,
            lockedWares: [],
            warePriority: {}
          }
        ]
      }
    ]
  }
}

function createFlowV1MacroState(): SavedFlowPlansState {
  return {
    version: 1,
    activeId: 'imp-flow-1',
    list: [
      {
        id: 'imp-flow-1',
        name: 'Imported Flow',
        groups: [
          {
            id: 'imp-group-1',
            name: 'Imported Group',
            category: 'industrial',
            subCategory: 'default',
            isLocked: false,
            lockedLineage: 'default',
            nodes: [
              {
                id: 'imp-node-1',
                wareId: 'hullparts',
                moduleId: 'prod_gen_hullparts_macro',
                race: 'argon',
                lineage: 'default',
                column: 1,
                isIsolated: false,
                source: 'manual',
                isRoot: true,
                order: 0
              }
            ]
          }
        ],
        settings: { isDefaultLocked: true },
        lastUpdated: 1772453451902
      }
    ]
  }
}

describe('module-id unit mapping', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1.1 Empire v2 到 v3 迁移归一 module id', () => {
    // 1.1.1 构造 `version=2` 且 `modules[].id` 为 macro id 的 empire 输入
    const empireV2Macro = createEmpireV2MacroState()

    // 1.1.2 调用 Empire 迁移函数并读取迁移结果
    const migrated = migrateEmpireStateToCurrent(empireV2Macro, lookup).state
    const modules = migrated.list.flatMap((empire) => empire.stations.flatMap((station) => station.modules))

    // 1.1.3 断言迁移后版本为 3 且模块 ID 全部可在 modulesMap 命中 #期望: [3, true]
    const allHit = modules.every((module) => Boolean(lookup.modulesMap[module.id]))
    expect(migrated.version).toBe(3)
    expect(allHit).toBe(true)
  })

  it('1.2 Flow v1 到 v2 迁移归一 moduleId', () => {
    // 1.2.1 构造 `version=1` 且 `nodes[].moduleId` 为 macro id 的 flow 输入
    const flowV1Macro = createFlowV1MacroState()

    // 1.2.2 调用 Flow 迁移函数并读取迁移结果
    const migrated = migrateFlowStateToCurrent(flowV1Macro, lookup).state
    const moduleIds = migrated.list.flatMap((plan) =>
      plan.groups.flatMap((group) => group.nodes.map((node) => node.moduleId).filter(Boolean))
    ) as string[]

    // 1.2.3 断言迁移后版本为 2 且节点 moduleId 可命中 modulesMap #期望: [2, true]
    const allHit = moduleIds.every((moduleId) => Boolean(lookup.modulesMap[moduleId]))
    expect(migrated.version).toBe(2)
    expect(allHit).toBe(true)
  })

  it('1.3 Import coerce 与 migrate 职责分离', () => {
    const incomingEmpire = createEmpireV2MacroState()
    const empireStore = {
      savedEmpires: createEmpireV2MacroState(),
      activeEmpireId: 'base-empire',
      isDirty: false,
      loadData: vi.fn(),
      initializeAllStationCaches: vi.fn(),
      saveToStorage: vi.fn()
    }
    const logicFlowStore = {
      savedPlans: createFlowV1MacroState(),
      isDirty: false,
      init: vi.fn()
    }
    const shipBuildStore = {
      savedBlueprints: { version: 1, activeId: null, list: [] },
      isDirty: false,
      activeView: 'production' as const,
      loadBlueprintsFromStorage: vi.fn(),
      loadBlueprint: vi.fn()
    }

    // 1.3.1 构造带 `version=2` 的 empire 导入包
    const payload = normalizeImportPayload({
      x4_empire_data: incomingEmpire
    })

    // 1.3.2 调用 coerce 后检查版本未被改写
    const rawVersion = (payload.modules.x4_empire_data as SavedEmpiresState).version
    expect(rawVersion).toBe(2)

    applyImportPayload({
      mode: 'overwrite',
      selectedModules: {
        x4_empire_data: true,
        x4_logic_flow_plans: false,
        x4_ship_blueprints: false
      },
      currentView: 'production',
      payload,
      gameDataStore: lookup,
      empireStore: empireStore as any,
      logicFlowStore: logicFlowStore as any,
      shipBuildStore: shipBuildStore as any
    })

    // 1.3.3 调用 migrate 后检查升级到最新版本 #期望: [2, 3]
    const migrated = JSON.parse(localStorage.getItem('x4_empire_data') || '{}') as SavedEmpiresState
    expect(rawVersion).toBe(2)
    expect(migrated.version).toBe(3)
  })
})
