/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  })
}))

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: true,
    waresMap: {},
    modulesMap: {},
    medicalConsumptionMap: {}
  }))
}))

import { useEmpireStore } from '@/store/useEmpireStore'
import { analyzeEmpireWareFlow } from '@/store/logic/analyzeEmpireWareFlow'
import type { GroupedFlows, WareFlow, StationPlan, ModuleFlowAtom } from '@/types/x4'

function createMockGroupedFlows(overrides: Partial<GroupedFlows> = {}): GroupedFlows {
  const defaultFlow: WareFlow = {
    wareId: 'test-ware',
    orderIndex: 1,
    tier: 1,
    transportType: 'container',
    unitVolume: 1,
    production: 100,
    consumption: 50,
    workforceConsumption: 0,
    netRate: 50,
    productionVolume: 100,
    consumptionVolume: 50,
    netVolume: 50,
    totalOccupiedCount: 0,
    totalOccupiedConsumptionCount: 0,
    totalOccupiedVolume: 0,
    unitPrice: 100,
    netValue: 5000,
    contributions: []
  }

  return {
    flows: [defaultFlow],
    rateGroups: {
      supply: [],
      operations: [],
      positive: [],
      resources: []
    },
    volumeGroups: {
      container: [],
      solid: [],
      liquid: []
    },
    ...overrides
  }
}

function makeContribution(partial: Partial<ModuleFlowAtom> & Pick<ModuleFlowAtom, 'type' | 'amount' | 'bonusPercent'>): ModuleFlowAtom {
  return {
    moduleId: 'test-module',
    count: 1,
    volumeFlow: 0,
    valueFlow: 0,
    ...partial
  }
}

function createMockStation(id: string, name: string, count: number = 1): StationPlan {
  return {
    id,
    name,
    type: 'industrial',
    count,
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
      racePreference: 'argon',
      resourceBufferHours: 1.0,
      primaryProductBufferHours: 12.0,
      secondaryProductBufferHours: 2.0,
      transportShipCapacity: 62000
    },
    lastUpdated: Date.now(),
    lockedWares: [],
    warePriority: {}
  }
}

function getProducts(result: ReturnType<typeof analyzeEmpireWareFlow>) {
  return result.empireGroups.operations.filter(flow => flow.netRate > 0)
}

function getOperations(result: ReturnType<typeof analyzeEmpireWareFlow>) {
  return result.empireGroups.operations.filter(flow => flow.netRate <= 0)
}

describe('analyzeEmpireWareFlow 聚合逻辑测试', () => {
  it('补给组数据正确聚合', () => {
    const station1 = createMockStation('station-1', 'Station 1', 1)
    const station2 = createMockStation('station-2', 'Station 2', 2)

    const flows1 = createMockGroupedFlows({
      rateGroups: {
        supply: [{
          wareId: 'foodrations',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 0,
          consumption: 100,
          workforceConsumption: 100,
          netRate: -100,
          productionVolume: 0,
          consumptionVolume: 50,
          netVolume: -50,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 50,
          netValue: -5000,
          contributions: [makeContribution({ type: 'consumption', amount: 100, bonusPercent: 0 })]
        }],
        operations: [],
        positive: [],
        resources: []
      }
    })

    const flows2 = createMockGroupedFlows({
      rateGroups: {
        supply: [{
          wareId: 'foodrations',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 0,
          consumption: 50,
          workforceConsumption: 50,
          netRate: -50,
          productionVolume: 0,
          consumptionVolume: 25,
          netVolume: -25,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 50,
          netValue: -2500,
          contributions: [makeContribution({ type: 'consumption', amount: 50, bonusPercent: 0 })]
        }],
        operations: [],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows1)
    cache.set('station-2', flows2)

    const result = analyzeEmpireWareFlow([station1, station2], (id) => cache.get(id) || null)

    expect(result.empireGroups.supply.length).toBe(1)
    const firstSupply = result.empireGroups.supply[0]
    expect(firstSupply).toBeDefined()
    expect(firstSupply!.wareId).toBe('foodrations')
    expect(firstSupply!.consumption).toBe(200)
    expect(firstSupply!.netRate).toBe(-200)
  })

  it('产品组数据正确归类（netRate > 0）', () => {
    const station = createMockStation('station-1', 'Station 1', 1)

    const flows = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'claytronics',
          orderIndex: 1,
          tier: 3,
          transportType: 'container',
          unitVolume: 1,
          production: 432,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 432,
          productionVolume: 432,
          consumptionVolume: 0,
          netVolume: 432,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 1000,
          netValue: 432000,
          contributions: [makeContribution({ type: 'production', amount: 432, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows)

    const result = analyzeEmpireWareFlow([station], (id) => cache.get(id) || null)

    const products = getProducts(result)
    const operations = getOperations(result)
    expect(products.length).toBe(1)
    const firstProduct = products[0]
    expect(firstProduct).toBeDefined()
    expect(firstProduct!.wareId).toBe('claytronics')
    expect(firstProduct!.netRate).toBe(432)
    expect(operations.length).toBe(0)
  })

  it('运营组数据正确归类（netRate < 0）', () => {
    const station = createMockStation('station-1', 'Station 1', 1)

    const flows = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'quantumtubes',
          orderIndex: 2,
          tier: 2,
          transportType: 'container',
          unitVolume: 0.5,
          production: 70,
          consumption: 140,
          workforceConsumption: 0,
          netRate: -70,
          productionVolume: 35,
          consumptionVolume: 70,
          netVolume: -35,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 500,
          netValue: -35000,
          contributions: [
            makeContribution({ type: 'production', amount: 70, bonusPercent: 0 }),
            makeContribution({ type: 'consumption', amount: -140, bonusPercent: 0 })
          ]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows)

    const result = analyzeEmpireWareFlow([station], (id) => cache.get(id) || null)

    const products = getProducts(result)
    const operations = getOperations(result)
    expect(operations.length).toBe(1)
    const firstOperation = operations[0]
    expect(firstOperation).toBeDefined()
    expect(firstOperation!.wareId).toBe('quantumtubes')
    expect(firstOperation!.netRate).toBe(-70)
    expect(products.length).toBe(0)
  })

  it('数量为 0 的空间站不参与计算', () => {
    const station1 = createMockStation('station-1', 'Station 1', 0)
    const station2 = createMockStation('station-2', 'Station 2', 1)

    const flows1 = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'claytronics',
          orderIndex: 1,
          tier: 3,
          transportType: 'container',
          unitVolume: 1,
          production: 432,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 432,
          productionVolume: 432,
          consumptionVolume: 0,
          netVolume: 432,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 1000,
          netValue: 432000,
          contributions: [makeContribution({ type: 'production', amount: 432, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const flows2 = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'hullparts',
          orderIndex: 1,
          tier: 2,
          transportType: 'container',
          unitVolume: 2,
          production: 200,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 200,
          productionVolume: 400,
          consumptionVolume: 0,
          netVolume: 400,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 300,
          netValue: 60000,
          contributions: [makeContribution({ type: 'production', amount: 200, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows1)
    cache.set('station-2', flows2)

    const result = analyzeEmpireWareFlow([station1, station2], (id) => cache.get(id) || null)

    const products = getProducts(result)
    expect(products.length).toBe(1)
    const firstProduct = products[0]
    expect(firstProduct).toBeDefined()
    expect(firstProduct!.wareId).toBe('hullparts')
    expect(firstProduct!.production).toBe(200)
  })

  it('数量 > 1 的空间站数据正确乘以倍数', () => {
    const station = createMockStation('station-1', 'Station 1', 3)

    const flows = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'claytronics',
          orderIndex: 1,
          tier: 3,
          transportType: 'container',
          unitVolume: 1,
          production: 100,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 100,
          productionVolume: 100,
          consumptionVolume: 0,
          netVolume: 100,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 1000,
          netValue: 100000,
          contributions: [makeContribution({ type: 'production', amount: 100, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows)

    const result = analyzeEmpireWareFlow([station], (id) => cache.get(id) || null)

    const products = getProducts(result)
    const firstProduct = products[0]
    expect(firstProduct).toBeDefined()
    expect(firstProduct!.production).toBe(300)
    expect(firstProduct!.netRate).toBe(300)
    expect(firstProduct!.netValue).toBe(300000)
  })

  it('候选数据中的 supply wareId 优先归入补给组', () => {
    const station = createMockStation('station-1', 'Station 1', 1)

    const flows = createMockGroupedFlows({
      rateGroups: {
        supply: [{
          wareId: 'foodrations',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 0,
          consumption: 120,
          workforceConsumption: 120,
          netRate: -120,
          productionVolume: 0,
          consumptionVolume: 60,
          netVolume: -60,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 50,
          netValue: -6000,
          contributions: [makeContribution({ type: 'consumption', amount: 120, bonusPercent: 0 })]
        }],
        operations: [{
          wareId: 'foodrations',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 30,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 30,
          productionVolume: 15,
          consumptionVolume: 0,
          netVolume: 15,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 50,
          netValue: 1500,
          contributions: [makeContribution({ type: 'production', amount: 30, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows)

    const result = analyzeEmpireWareFlow([station], (id) => cache.get(id) || null)

    expect(result.empireGroups.supply.length).toBe(1)
    const firstSupply = result.empireGroups.supply[0]
    expect(firstSupply).toBeDefined()
    expect(firstSupply!.wareId).toBe('foodrations')
    expect(firstSupply!.netRate).toBe(-90)
    const products = getProducts(result)
    const operations = getOperations(result)
    expect(products.length).toBe(0)
    expect(operations.length).toBe(0)
  })

  it('候选数据命中 supply 时与补给组聚合结果合并', () => {
    const station1 = createMockStation('station-1', 'Station 1', 1)
    const station2 = createMockStation('station-2', 'Station 2', 1)

    const flows1 = createMockGroupedFlows({
      rateGroups: {
        supply: [{
          wareId: 'medicalsupplies',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 0,
          consumption: 80,
          workforceConsumption: 80,
          netRate: -80,
          productionVolume: 0,
          consumptionVolume: 40,
          netVolume: -40,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 60,
          netValue: -4800,
          contributions: [makeContribution({ type: 'consumption', amount: 80, bonusPercent: 0 })]
        }],
        operations: [{
          wareId: 'medicalsupplies',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 10,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 10,
          productionVolume: 5,
          consumptionVolume: 0,
          netVolume: 5,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 60,
          netValue: 600,
          contributions: [makeContribution({ type: 'production', amount: 10, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const flows2 = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'medicalsupplies',
          orderIndex: 1,
          tier: 0,
          transportType: 'container',
          unitVolume: 0.5,
          production: 5,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 5,
          productionVolume: 2.5,
          consumptionVolume: 0,
          netVolume: 2.5,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 60,
          netValue: 300,
          contributions: [makeContribution({ type: 'production', amount: 5, bonusPercent: 0 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows1)
    cache.set('station-2', flows2)

    const result = analyzeEmpireWareFlow([station1, station2], (id) => cache.get(id) || null)
    const supply = result.empireGroups.supply.find(flow => flow.wareId === 'medicalsupplies')

    expect(supply).toBeDefined()
    expect(supply!.netRate).toBe(-65)
    expect(supply!.production).toBe(15)
    expect(supply!.consumption).toBe(80)
    expect(getProducts(result).find(flow => flow.wareId === 'medicalsupplies')).toBeUndefined()
    expect(getOperations(result).find(flow => flow.wareId === 'medicalsupplies')).toBeUndefined()
  })
})

describe('EmpireStore 缓存机制测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('缓存正确初始化', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    expect(store.stationFlowCache).toBeDefined()
    expect(store.stationFlowCache instanceof Map).toBe(true)
  })

  it('创建空间站时创建缓存', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const station = store.createStation('Test Station', 'industrial')
    expect(station).toBeDefined()
    
    const cachedFlows = store.getStationFlowCache(station!.id)
    expect(cachedFlows).toBeDefined()
  })

  it('删除空间站时删除缓存', async () => {
    const store = useEmpireStore()
    
    await vi.waitFor(() => expect(store.isReady).toBe(true), { timeout: 3000 })
    
    const station = store.createStation('Test Station', 'industrial')
    expect(station).toBeDefined()
    
    const stationId = station!.id
    expect(store.getStationFlowCache(stationId)).toBeDefined()
    
    store.deleteStation(stationId)
    expect(store.getStationFlowCache(stationId)).toBeNull()
  })
})

describe('EmpireFlowAtom 数据结构测试', () => {
  it('明细数据包含正确的空间站信息', () => {
    const station = createMockStation('station-1', 'Test Station', 2)

    const flows = createMockGroupedFlows({
      rateGroups: {
        supply: [],
        operations: [{
          wareId: 'claytronics',
          orderIndex: 1,
          tier: 3,
          transportType: 'container',
          unitVolume: 1,
          production: 100,
          consumption: 0,
          workforceConsumption: 0,
          netRate: 100,
          productionVolume: 100,
          consumptionVolume: 0,
          netVolume: 100,
          totalOccupiedCount: 0,
          totalOccupiedConsumptionCount: 0,
          totalOccupiedVolume: 0,
          unitPrice: 1000,
          netValue: 100000,
          contributions: [makeContribution({ type: 'production', amount: 100, bonusPercent: 10 })]
        }],
        positive: [],
        resources: []
      }
    })

    const cache = new Map<string, GroupedFlows>()
    cache.set('station-1', flows)

    const result = analyzeEmpireWareFlow([station], (id) => cache.get(id) || null)

    const products = getProducts(result)
    const firstProduct = products[0]
    expect(firstProduct).toBeDefined()
    expect(firstProduct!.contributions.length).toBe(1)
    
    const contribution = firstProduct!.contributions[0]
    expect(contribution).toBeDefined()
    expect(contribution!.stationId).toBe('station-1')
    expect(contribution!.stationName).toBe('Test Station')
    expect(contribution!.stationCount).toBe(2)
    expect(contribution!.netRate).toBe(200)
    expect(contribution!.production).toBe(200)
    expect(contribution!.consumption).toBe(0)
  })
})
