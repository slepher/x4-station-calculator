/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyImportPayload,
  buildExportPayload,
  normalizeImportPayload,
  prepareImportPayload,
  type ImportModuleKey
} from '@/store/logic/importExport'
import {
  CURRENT_EMPIRE_VERSION,
  CURRENT_FLOW_VERSION,
  CURRENT_SHIP_BLUEPRINT_VERSION
} from '@/store/logic/storageVersions'
import type {
  SavedEmpiresState,
  SavedFlowPlansState,
  SavedShipBlueprintsState
} from '@/types/x4'

function createEmpireState(moduleId = 'module-valid'): SavedEmpiresState {
  return {
    version: CURRENT_EMPIRE_VERSION,
    activeId: 'empire-a',
    activeStationId: 'station-a',
    list: [
      {
        id: 'empire-a',
        name: 'Sector A',
        stations: [
          {
            id: 'station-a',
            name: 'Station A',
            type: 'industrial',
            count: 1,
            modules: [{ id: moduleId, count: 1 }],
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
            lastUpdated: 1,
            lockedWares: [],
            warePriority: {}
          }
        ],
        sectors: [],
        sectorLinks: []
      }
    ]
  }
}

function createFlowState(moduleId = 'module-valid'): SavedFlowPlansState {
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
              { isolated: 'energycells' },
              { module: moduleId }
            ]
          }
        ],
        settings: { isDefaultLocked: true },
        lastUpdated: 1
      }
    ]
  }
}

function createShipState(shipId = 'ship-valid', equipmentId = 'equipment-valid'): SavedShipBlueprintsState {
  return {
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: shipId,
    activeBlueprintId: 'bp-a',
    ships: [
      {
        shipId,
        blueprints: [
          {
            id: 'bp-a',
            name: 'Blueprint A',
            shipId,
            connections: [
              {
                slot_type: 'engine',
                group: [
                  {
                    group: 'engine-group',
                    equipment_id: equipmentId,
                    count: 1,
                    shield: {
                      equipment_id: equipmentId,
                      count: 1
                    }
                  }
                ]
              }
            ],
            storage: {
              deployables: [{ id: 'consumable-valid', name: 'Deployable', count: 1 }],
              countermeasure: { id: 'consumable-valid', name: 'Countermeasure', count: 1 },
              drones: [{ id: 'drone-valid', name: 'Drone', count: 1 }],
              missiles: [{ id: 'missile-valid', name: 'Missile', count: 1 }]
            },
            lastUpdated: 1
          }
        ]
      }
    ]
  }
}

function createTurretShipState(shipId = 'ship_ter_m_corvette_01_a', equipmentId = 'turret_ter_m_beam_01_mk1'): SavedShipBlueprintsState {
  return {
    version: CURRENT_SHIP_BLUEPRINT_VERSION,
    activeShipId: shipId,
    activeBlueprintId: 'bp-turret',
    ships: [
      {
        shipId,
        blueprints: [
          {
            id: 'bp-turret',
            name: 'Turret Blueprint',
            shipId,
            connections: [
              {
                slot_type: 'turret',
                group: [
                  {
                    group: 'con_turret_front',
                    equipment_id: equipmentId,
                    count: 1
                  }
                ]
              }
            ],
            storage: {
              deployables: [],
              countermeasure: null,
              drones: [],
              missiles: []
            },
            lastUpdated: 1
          }
        ]
      }
    ]
  }
}

function buildStores() {
  const empireStore = {
    savedEmpires: createEmpireState(),
    activeEmpireId: 'empire-a',
    isDirty: false,
    loadEmpire: vi.fn(),
    loadData: vi.fn((data: SavedEmpiresState) => {
      empireStore.savedEmpires = data
    }),
    initializeAllStationCaches: vi.fn(),
    saveToStorage: vi.fn()
  }

  const logicFlowStore = {
    savedPlans: createFlowState(),
    isDirty: false,
    loadPlan: vi.fn(),
    init: vi.fn(() => {
      const raw = localStorage.getItem('x4_logic_flow_plans@9.0-beta')
      if (raw) logicFlowStore.savedPlans = JSON.parse(raw)
    })
  }

  const shipBuildStore = {
    savedBlueprints: createShipState(),
    isDirty: false,
    activeView: 'production' as const,
    shipMap: new Map([['ship-valid', {}]]),
    equipmentMap: new Map([['equipment-valid', {}]]),
    consumablesMap: new Map([['consumable-valid', {}]]),
    dronesMap: new Map([['drone-valid', {}]]),
    missilesMap: new Map([['missile-valid', {}]]),
    loadBlueprintsFromStorage: vi.fn(() => {
      const raw = localStorage.getItem('x4_ship_blueprints@9.0-beta')
      if (raw) shipBuildStore.savedBlueprints = JSON.parse(raw)
    }),
    loadBlueprint: vi.fn()
  }

  const gameDataStore = {
    modulesMap: {
      'module-valid': { id: 'module-valid', macroId: 'module-valid_macro', wareId: 'energycells' }
    },
    modulesByMacroId: {
      'module-valid_macro': { id: 'module-valid', macroId: 'module-valid_macro', wareId: 'energycells' }
    },
    currentVersion: '9.0',
    isBeta: true,
    getStorageKey: (module: 'empire' | 'logic_flow' | 'ship_blueprints') => {
      if (module === 'empire') return 'x4_empire_data@9.0-beta'
      if (module === 'logic_flow') return 'x4_logic_flow_plans@9.0-beta'
      return 'x4_ship_blueprints@9.0-beta'
    }
  }

  return { empireStore, logicFlowStore, shipBuildStore, gameDataStore }
}

describe('import-export game version pipeline', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('exports game_vsn and beta metadata', () => {
    const { gameDataStore } = buildStores()
    const payload = buildExportPayload(
      createEmpireState(),
      createFlowState(),
      createShipState(),
      gameDataStore
    )

    expect(payload.game_vsn).toBe('9.0')
    expect(payload.beta).toBe(true)
    expect(payload.data.x4_empire_data.version).toBe(CURRENT_EMPIRE_VERSION)
  })

  it('defaults legacy imports to 8.0 stable metadata', () => {
    const normalized = normalizeImportPayload({
      data: {
        x4_empire_data: createEmpireState()
      }
    })

    expect(normalized.fileMeta).toEqual({
      game_vsn: '8.0',
      beta: false,
      inferred: true
    })
  })

  it('prepares mismatch info and sanitizes invalid references before apply', () => {
    const { gameDataStore, shipBuildStore } = buildStores()
    const payload = normalizeImportPayload({
      game_vsn: '8.0',
      beta: false,
      data: {
        x4_empire_data: createEmpireState('module-missing'),
        x4_logic_flow_plans: createFlowState('module-missing'),
        x4_ship_blueprints: createShipState('ship-missing', 'equipment-missing')
      }
    })

    const prepared = prepareImportPayload(payload, gameDataStore, shipBuildStore)

    expect(prepared.versionState.mismatch).toBe(true)
    expect(prepared.moduleStats).toEqual([
      { key: 'x4_empire_data', count: 1 },
      { key: 'x4_logic_flow_plans', count: 1 },
      { key: 'x4_ship_blueprints', count: 0 }
    ])
    expect(prepared.sanitizeSummaries).toEqual([
      {
        key: 'x4_empire_data',
        removed: 1,
        details: [{ kind: 'invalidModulesRemoved', count: 1 }]
      },
      {
        key: 'x4_logic_flow_plans',
        removed: 1,
        details: [{ kind: 'invalidFlowModulesRemoved', count: 1 }]
      },
      {
        key: 'x4_ship_blueprints',
        removed: 1,
        details: [{ kind: 'invalidShipsRemoved', count: 1 }]
      }
    ])
  })

  it('sanitizes cross-version ship equipment when it no longer matches the current slot', () => {
    const { shipBuildStore, gameDataStore } = buildStores()
    shipBuildStore.shipMap = new Map([['ship_ter_m_corvette_01_a', {}]])
    shipBuildStore.equipmentMap = new Map([['turret_ter_m_beam_01_mk1', {}]])
    shipBuildStore.findShip = vi.fn(() => ({
      id: 'ship_ter_m_corvette_01_a',
      slots: [
        {
          type: 'turret',
          groups: [
            {
              group: 'con_turret_front',
              connection: {
                size: 'medium',
                tags: ['combat', 'standard', 'unhittable'],
                count: 1
              }
            }
          ]
        }
      ]
    }))
    shipBuildStore.findEquipment = vi.fn(() => ({
      id: 'turret_ter_m_beam_01_mk1',
      slotTags: ['advanced', 'combat', 'unhittable'],
      type: 'turret',
      size: 'medium',
    }))

    const payload = normalizeImportPayload({
      game_vsn: '9.0',
      beta: true,
      data: {
        x4_empire_data: createEmpireState(),
        x4_logic_flow_plans: createFlowState(),
        x4_ship_blueprints: createTurretShipState()
      }
    })

    const prepared = prepareImportPayload(payload, {
      ...gameDataStore,
      currentVersion: '8.0',
      isBeta: false
    }, shipBuildStore)

    expect(prepared.versionState.mismatch).toBe(true)
    expect(prepared.moduleStats).toEqual([
      { key: 'x4_empire_data', count: 1 },
      { key: 'x4_logic_flow_plans', count: 1 },
      { key: 'x4_ship_blueprints', count: 1 }
    ])
    expect(prepared.sanitizeSummaries).toContainEqual({
      key: 'x4_ship_blueprints',
      removed: 1,
      details: [{ kind: 'invalidEquipmentsCleared', count: 1 }]
    })
  })

  it('applies imports into the active version storage keys', () => {
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = buildStores()
    const payload = normalizeImportPayload({
      game_vsn: '9.0',
      beta: true,
      data: {
        x4_empire_data: createEmpireState(),
        x4_logic_flow_plans: createFlowState(),
        x4_ship_blueprints: createShipState()
      }
    })

    const result = applyImportPayload({
      mode: 'overwrite',
      selectedModules: {
        x4_empire_data: true,
        x4_logic_flow_plans: true,
        x4_ship_blueprints: true
      } satisfies Record<ImportModuleKey, boolean>,
      currentView: 'production',
      payload,
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    expect(result.applied).toEqual(['x4_empire_data', 'x4_logic_flow_plans', 'x4_ship_blueprints'])
    expect(localStorage.getItem('x4_empire_data@9.0-beta')).toBeTruthy()
    expect(localStorage.getItem('x4_logic_flow_plans@9.0-beta')).toBeTruthy()
    expect(localStorage.getItem('x4_ship_blueprints@9.0-beta')).toBeTruthy()
  })

  it('overwrite import switches runtime active selections to imported targets', () => {
    const { empireStore, logicFlowStore, shipBuildStore, gameDataStore } = buildStores()
    const empire = createEmpireState()
    empire.activeId = 'empire-imported'
    empire.activeStationId = 'station-imported'
    empire.list[0]!.id = 'empire-imported'
    empire.list[0]!.stations[0]!.id = 'station-imported'

    const flow = createFlowState()
    flow.activeId = 'flow-imported'
    flow.list[0]!.id = 'flow-imported'

    const ship = createShipState()
    ship.activeBlueprintId = 'bp-imported'
    ship.ships[0]!.blueprints[0]!.id = 'bp-imported'

    applyImportPayload({
      mode: 'overwrite',
      selectedModules: {
        x4_empire_data: true,
        x4_logic_flow_plans: true,
        x4_ship_blueprints: true
      },
      currentView: 'production',
      payload: normalizeImportPayload({
        data: {
          x4_empire_data: empire,
          x4_logic_flow_plans: flow,
          x4_ship_blueprints: ship
        }
      }),
      gameDataStore,
      empireStore,
      logicFlowStore,
      shipBuildStore
    })

    expect(empireStore.loadEmpire).toHaveBeenCalledWith('empire-imported')
    expect(logicFlowStore.loadPlan).toHaveBeenCalledWith(0)
    expect(shipBuildStore.loadBlueprint).toHaveBeenCalledWith('bp-imported')
  })
})
