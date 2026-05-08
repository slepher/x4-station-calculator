import { describe, expect, it } from 'vitest'
import type { EmpireGroupedFlows, SupplyStorageFlow, X4Module, X4Ware } from '@/types/x4'
import { buildTransitHubStorageFlows, buildTransitHubStorageModulePlans } from '@/store/logic/transitHubViewModel'
import type { SolveMultiWareByLinkOutput } from '@/store/logic/sectorLinkFlow'

describe('transitHubViewModel', () => {
  it('builds storage flows by merging local station contributions and external sector link flows', () => {
    const groupedFlows: EmpireGroupedFlows = {
      flows: [
        {
          wareId: 'w1',
          orderIndex: 1,
          tier: 2,
          transportType: 'container',
          unitVolume: 2,
          production: 10,
          consumption: 0,
          netRate: 10,
          unitPrice: 1,
          netValue: 10,
          contributions: [{
            stationId: 's-a1',
            stationName: 'A-1',
            stationCount: 1,
            production: 10,
            consumption: 0,
            netRate: 10,
            netValue: 10
          }]
        }
      ],
      empireGroups: {
        operations: [],
        supply: []
      }
    }

    const solverOutput: SolveMultiWareByLinkOutput = {
      linkWareFlows: [
        { linkId: 'A|B', from: 'B', to: 'A', wareId: 'w1', amount: 5 },
        { linkId: 'A|B', from: 'A', to: 'B', wareId: 'w2', amount: 2 }
      ],
      allocatedDemandBySector: [],
      deficitSummary: {
        totalDeficit: 0,
        deficitByNode: [],
        producerNodes: []
      }
    }

    const waresMap: Record<string, X4Ware> = {
      w1: {
        id: 'w1', nameId: 'w1', name: 'W1', transport: 'container', volume: 2, price: 1, minPrice: 1, maxPrice: 1, tier: 2, group: 'test'
      },
      w2: {
        id: 'w2', nameId: 'w2', name: 'W2', transport: 'container', volume: 3, price: 1, minPrice: 1, maxPrice: 1, tier: 3, group: 'test'
      }
    }

    const flows = buildTransitHubStorageFlows({
      sectorId: 'A',
      sectors: [
        { id: 'A', name: 'Alpha', order: 0 },
        { id: 'B', name: 'Beta', order: 1 }
      ],
      stations: [
        { id: 's-a1', name: 'A-1', sectorId: 'A', modules: [], settings: {} as any, lastUpdated: 0 }
      ],
      groupedFlows,
      solverOutput,
      waresMap,
      storageBufferHours: 12
    })

    expect(flows).toHaveLength(2)

    const w1 = flows.find((flow) => flow.wareId === 'w1')
    expect(w1).toBeTruthy()
    expect(w1?.totalProductionStorageVolume).toBe(240) // 10 * 2 * 12
    expect(w1?.totalConsumptionStorageVolume).toBe(120) // 5 * 2 * 12
    expect(w1?.details[0]?.stationId).toBe('s-a1') // local station detail first
    expect(w1?.details[1]?.stationId).toContain('external:B:in')

    const w2 = flows.find((flow) => flow.wareId === 'w2')
    expect(w2?.totalProductionStorageVolume).toBe(72) // 2 * 3 * 12
    expect(w2?.totalConsumptionStorageVolume).toBe(0)
  })

  it('builds storage plans with race-preferred storage and pier demand', () => {
    const storageFlows: SupplyStorageFlow[] = [{
      wareId: 'w1',
      orderIndex: 1,
      tier: 2,
      transportType: 'container',
      unitVolume: 1,
      totalProductionStorageVolume: 600000,
      totalConsumptionStorageVolume: 0,
      totalRequiredStorageVolume: 600000,
      details: [{
        stationId: 's-a1',
        stationName: 'A-1',
        stationCount: 1,
        kind: 'production',
        staticRate: 675,
        storageVolume: 600000
      }]
    }]

    const modulesMap: Record<string, X4Module> = {
      storageSmall: { id: 'storageSmall', macroId: 'm1', wareId: 'w', nameId: 'n', name: 'S', type: 'storage', method: 'default', group: 'g', race: 'argon', buildTime: 0, buildCost: {}, cycleTime: 0, workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {}, cargo: { capacity: 400000, type: 'container' }, dockingCount: 0, color: '', color_rgb: '', tier: 0 },
      storageLargeRace: { id: 'storageLargeRace', macroId: 'm2', wareId: 'w', nameId: 'n', name: 'L', type: 'storage', method: 'default', group: 'g', race: 'argon', buildTime: 0, buildCost: {}, cycleTime: 0, workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {}, cargo: { capacity: 600000, type: 'container' }, dockingCount: 0, color: '', color_rgb: '', tier: 0 },
      storageLargeOther: { id: 'storageLargeOther', macroId: 'm3', wareId: 'w', nameId: 'n', name: 'L2', type: 'storage', method: 'default', group: 'g', race: 'teladi', buildTime: 0, buildCost: {}, cycleTime: 0, workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {}, cargo: { capacity: 800000, type: 'container' }, dockingCount: 0, color: '', color_rgb: '', tier: 0 },
      pierLarge: { id: 'pierLarge', macroId: 'pier_harbor_03_macro', wareId: 'w', nameId: 'n', name: 'Pier', type: 'pier', method: 'default', group: 'g', race: 'argon', buildTime: 0, buildCost: {}, cycleTime: 0, workforce: { capacity: 0, needed: 0, maxBonus: 0 }, outputs: {}, inputs: {}, dockingCount: 0, color: '', color_rgb: '', tier: 0 }
    }

    const plans = buildTransitHubStorageModulePlans({
      storageFlows,
      modulesMap,
      racePreference: 'argon',
      transportShipCapacity: 30
    })

    const storagePlan = plans.find((plan) => plan.id === 'storageLargeRace')
    expect(storagePlan?.count).toBe(1)

    const pierPlan = plans.find((plan) => plan.id === 'pierLarge')
    expect(pierPlan?.count).toBe(1)
  })
})
