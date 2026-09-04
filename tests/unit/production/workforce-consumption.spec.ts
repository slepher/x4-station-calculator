import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { calculateProductionFlowsCore } from '../../../src/store/logic/calculateProductionFlows'
import { calculateWareFlowDerived } from '../../../src/store/logic/calculateWareFlowDerived'
import type { StationSettings, X4Module, X4Ware, SavedModule, WorkforceConsumptionMap, GroupedFlows } from '../../../src/types/x4'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_PATH = path.join(__dirname, '../../../src/assets/x4_game_data/8.0-Diplomacy/data')

function callComputeFlows(
  plannedModules: SavedModule[],
  modules: Record<string, X4Module>,
  wares: Record<string, X4Ware>,
  consumption: WorkforceConsumptionMap,
  settings: StationSettings,
  warePriority: Record<string, number>,
  actualWorkforceOverride?: number,
  saturationOverride?: number,
  workforceOverride?: Array<{ race: string; amount: number }>
): GroupedFlows {
  const coreResult = calculateProductionFlowsCore({
    plannedModules,
    autoIndustryModules: [],
    autoHabitationModules: [],
    modulesMap: modules,
    waresMap: wares,
    workforceConsumptionMap: consumption,
    settings,
    warePriority,
    actualWorkforceOverride,
    saturationOverride,
    workforceOverride
  })

  const derivedResult = calculateWareFlowDerived({
    productionFlows: coreResult.productionFlows,
    autoIndustryModules: [],
    plannedModules,
    modulesMap: modules,
    waresMap: wares,
    settings: {
      racePreference: settings.racePreference,
      resourceBufferHours: settings.resourceBufferHours,
      primaryProductBufferHours: settings.primaryProductBufferHours,
      secondaryProductBufferHours: settings.secondaryProductBufferHours,
      buyMultiplier: settings.buyMultiplier,
      sellMultiplier: settings.sellMultiplier,
      transportMinutes: 60,
      transportShipCapacity: settings.transportShipCapacity,
      sunlight: settings.sunlight
    },
    warePriorityLevels: warePriority
  })

  return derivedResult.groupedFlows
}

describe('Split Supply Operations - workforceConsumption', () => {
  let modules: Record<string, X4Module> = {}
  let wares: Record<string, X4Ware> = {}
  let consumption: WorkforceConsumptionMap = {}

  beforeAll(() => {
    const modulesArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8')) as X4Module[]
    modulesArray.forEach(m => modules[m.id] = m)

    const waresArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8')) as X4Ware[]
    waresArray.forEach(w => wares[w.id] = w)

    consumption = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'consumption.json'), 'utf-8'))
  })

  const defaultSettings: StationSettings = {
    racePreference: 'argon',
    considerWorkforceForAutoFill: false,
    supplyWorkforceBonus: false,
    internalSupply: false,
    resourceBufferHours: 1,
    primaryProductBufferHours: 1,
    secondaryProductBufferHours: 1,
    workforcePercent: 100,
    sunlight: 100,
    useHQ: false,
    manualWorkforce: 0,
    workforceAuto: true,
    buyMultiplier: 0.5,
    sellMultiplier: 0.5,
    minersEnabled: false,
    transportShipCapacity: 10000
  }

  it('空模块列表返回空结果', () => {
    const result = callComputeFlows([], modules, wares, consumption, defaultSettings, {})

    expect(result.flows.length).toBe(0)
    expect(result.rateGroups.positive.length).toBe(0)
    expect(result.rateGroups.operations.length).toBe(0)
    expect(result.rateGroups.supply.length).toBe(0)
    expect(result.rateGroups.resources.length).toBe(0)
  })

  it('工人消耗正确记录到 workforceConsumption 字段', () => {
    const habModuleId = 'module_arg_hab_m_01'
    const habModule = modules[habModuleId]
    expect(habModule).toBeDefined()

    const actualWorkforce = 100
    const plannedModules: SavedModule[] = [{ id: habModuleId, count: 1 }]
    const saturation = 1.0

    const result = callComputeFlows(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      {},
      actualWorkforce,
      saturation
    )

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations')
    const medicalsuppliesFlow = result.flows.find(f => f.wareId === 'medicalsupplies')

    expect(foodrationsFlow).toBeDefined()
    expect(medicalsuppliesFlow).toBeDefined()

    if (foodrationsFlow) {
      expect(foodrationsFlow.consumption).toBeGreaterThan(0)
      expect(foodrationsFlow.contributions.some(c => c.class === 'workforce')).toBe(true)
    }

    if (medicalsuppliesFlow) {
      expect(medicalsuppliesFlow.consumption).toBeGreaterThan(0)
      expect(medicalsuppliesFlow.contributions.some(c => c.class === 'workforce')).toBe(true)
    }
  })

  it('分组逻辑 - 补给分组', () => {
    const habModuleId = 'module_arg_hab_m_01'
    const actualWorkforce = 100
    const plannedModules: SavedModule[] = [{ id: habModuleId, count: 1 }]

    const result = callComputeFlows(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      {},
      actualWorkforce,
      1.0
    )

    const foodrationsInSupply = result.rateGroups.supply.find(f => f.wareId === 'foodrations')
    const medicalsuppliesInSupply = result.rateGroups.supply.find(f => f.wareId === 'medicalsupplies')

    expect(foodrationsInSupply).toBeDefined()
    expect(medicalsuppliesInSupply).toBeDefined()
  })

  it('分组逻辑 - 运营分组', () => {
    const weaponComponentsModuleId = Object.keys(modules).find(k =>
      k.includes('weaponcomponents') && k.includes('prod')
    )
    expect(weaponComponentsModuleId).toBeDefined()
    if (!weaponComponentsModuleId) return

    const plannedModules: SavedModule[] = [{ id: weaponComponentsModuleId, count: 1 }]

    const result = callComputeFlows(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      {},
      0,
      1
    )

    const hullpartsFlow = result.flows.find(f => f.wareId === 'hullparts')
    expect(hullpartsFlow).toBeDefined()

    if (hullpartsFlow && hullpartsFlow.netRate < 0) {
      expect(hullpartsFlow.contributions.some(c => c.class === 'workforce' || c.class === 'workforce_idle')).toBe(false)

      const hullpartsInOperations = result.rateGroups.operations.find(f => f.wareId === 'hullparts')
      expect(hullpartsInOperations).toBeDefined()
    }
  })

  it('分组逻辑 - 混合消耗物资归入补给分组', () => {
    const habModuleId = 'module_arg_hab_m_01'
    const weaponComponentsModuleId = Object.keys(modules).find(k => k.includes('weaponcomponents'))

    expect(modules[habModuleId]).toBeDefined()
    expect(weaponComponentsModuleId).toBeDefined()
    if (!weaponComponentsModuleId) return

    const actualWorkforce = 100
    const plannedModules: SavedModule[] = [
      { id: habModuleId, count: 1 },
      { id: weaponComponentsModuleId, count: 1 }
    ]

    const result = callComputeFlows(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      {},
      actualWorkforce,
      1.0
    )

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations')
    expect(foodrationsFlow).toBeDefined()

    if (foodrationsFlow && foodrationsFlow.netRate < 0) {
      expect(foodrationsFlow.contributions.some(c => c.class === 'workforce' || c.class === 'workforce_idle')).toBe(true)

      const foodrationsInSupply = result.rateGroups.supply.find(f => f.wareId === 'foodrations')
      expect(foodrationsInSupply).toBeDefined()
    }
  })

  it('手动 workforce 大于需求时，额外人数作为 idle contribution 进入 wareflow', () => {
    const habModuleId = 'module_arg_hab_m_01'
    const weaponComponentsModuleId = Object.keys(modules).find(k => k.includes('weaponcomponents'))

    expect(modules[habModuleId]).toBeDefined()
    expect(weaponComponentsModuleId).toBeDefined()
    if (!weaponComponentsModuleId) return

    const settings: StationSettings = {
      ...defaultSettings,
      workforceAuto: false,
      manualWorkforce: 1000
    }

    const result = callComputeFlows(
      [
        { id: habModuleId, count: 1 },
        { id: weaponComponentsModuleId, count: 1 }
      ],
      modules,
      wares,
      consumption,
      settings,
      {}
    )

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations')
    expect(foodrationsFlow).toBeDefined()
    if (!foodrationsFlow) return

    expect(foodrationsFlow.contributions.some(c => c.class === 'workforce')).toBe(true)
    expect(foodrationsFlow.contributions.some(c => c.class === 'workforce_idle')).toBe(true)
  })

  it('无岗位需求时不生成 0 值 busy contribution，只保留 idle contribution', () => {
    const habModuleId = 'module_arg_hab_m_01'
    const settings: StationSettings = {
      ...defaultSettings,
      workforceAuto: false,
      manualWorkforce: 100
    }

    const result = callComputeFlows(
      [{ id: habModuleId, count: 1 }],
      modules,
      wares,
      consumption,
      settings,
      {}
    )

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations')
    expect(foodrationsFlow).toBeDefined()
    if (!foodrationsFlow) return

    expect(foodrationsFlow.contributions.some(c => c.class === 'workforce')).toBe(false)
    expect(foodrationsFlow.contributions.some(c => c.class === 'workforce_idle')).toBe(true)
  })
})
