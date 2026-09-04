import { describe, expect, it } from 'vitest'
import { calculateWareFlowDerived, deriveProductionFlows } from '@/store/logic/calculateWareFlowDerived'
import type { WareProductionFlow } from '@/types/production-flow'
import type { X4Ware } from '@/types/x4'

describe('deriveProductionFlows', () => {
  it('moves volume and price calculations into phase two', () => {
    const flows: WareProductionFlow[] = [{
      wareId: 'energycells',
      orderIndex: 1,
      tier: 0,
      transportType: 'container',
      unitVolume: 2,
      production: 10,
      consumption: 4,
      netRate: 6,
      contributions: [
        { moduleId: 'prod_energy', count: 1, type: 'production', amount: 10, bonusPercent: 0 },
        { moduleId: 'prod_consume', count: 1, type: 'consumption', amount: -4, bonusPercent: 0 }
      ],
      stationContributions: [
        {
          stationId: 'station-a',
          stationName: 'Station A',
          stationCount: 1,
          production: 10,
          consumption: 4,
          netRate: 6
        }
      ]
    }]

    const waresMap: Record<string, X4Ware> = {
      energycells: {
        id: 'energycells',
        nameId: 'energycells',
        name: 'Energy Cells',
        transport: 'container',
        volume: 2,
        price: 10,
        minPrice: 8,
        maxPrice: 12,
        tier: 0,
        group: 'energy'
      }
    }

    const derived = deriveProductionFlows({
      productionFlows: flows,
      autoIndustryModules: [],
      plannedModules: [],
      modulesMap: {},
      waresMap,
      settings: {
        racePreference: 'argon',
        resourceBufferHours: 2,
        primaryProductBufferHours: 3,
        secondaryProductBufferHours: 1,
        buyMultiplier: 0.25,
        sellMultiplier: 0.75,
        transportMinutes: 30,
        transportShipCapacity: 62000,
        sunlight: 100
      },
      warePriorityLevels: { energycells: 2 }
    })

    expect(derived).toHaveLength(1)
    expect(derived[0]).toMatchObject({
      productionVolume: 20,
      consumptionVolume: 8,
      netVolume: 12,
      unitPrice: 11,
      netValue: 66,
      transportDemand: 12,
      totalOccupiedCount: 18,
      totalOccupiedConsumptionCount: 8,
      totalOccupiedVolume: 36
    })
    expect(derived[0]?.contributions[0]).toMatchObject({
      volumeContribution: 30,
      valueContribution: 110,
      transportContribution: 20
    })
  })

  it('groups derived flows through the current calculation pipeline', () => {
    const grouped = calculateWareFlowDerived({
      productionFlows: [
      {
        wareId: 'ore',
        orderIndex: 2,
        tier: 0,
        transportType: 'solid',
        unitVolume: 10,
        production: 0,
        consumption: 3,
        netRate: -3,
        productionVolume: 0,
        consumptionVolume: 30,
        netVolume: -30,
        transportDemand: 30,
        totalOccupiedCount: 3,
        totalOccupiedConsumptionCount: 3,
        totalOccupiedVolume: 30,
        unitPrice: 50,
        netValue: -150,
        contributions: [],
        stationContributions: []
      }
      ],
      modulesMap: {},
      waresMap: {
        ore: {
          id: 'ore',
          nameId: 'ore',
          name: 'Ore',
          transport: 'solid',
          volume: 10,
          price: 50,
          minPrice: 40,
          maxPrice: 60,
          tier: 0,
          group: 'resources'
        } as X4Ware
      },
      settings: {
        racePreference: 'argon',
        resourceBufferHours: 0,
        primaryProductBufferHours: 0,
        secondaryProductBufferHours: 0,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportMinutes: 30,
        transportShipCapacity: 62000,
        sunlight: 100
      },
      warePriorityLevels: {}
    }).groupedFlows

    expect(grouped.volumeGroups.solid).toHaveLength(1)
    expect(grouped.rateGroups.resources).toHaveLength(1)
    expect(grouped.flows[0]?.netValue).toBe(-150)
  })
})
