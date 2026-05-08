import { describe, expect, it } from 'vitest'
import { deriveProductionFlows } from '@/store/logic/calculateWareFlowDerived'
import type { WareProductionFlow } from '@/types/production-flow'
import type { X4Ware } from '@/types/x4'

describe('deriveProductionFlows transit hub details', () => {
  it('uses stationContributions as output detail source when present', () => {
    const flows: WareProductionFlow[] = [
      {
        wareId: 'energycells',
        orderIndex: 1,
        tier: 1,
        transportType: 'container',
        unitVolume: 1,
        production: 10,
        consumption: 4,
        netRate: 6,
        contributions: [
          {
            moduleId: 'module_solar',
            count: 1,
            type: 'production',
            amount: 10,
            bonusPercent: 0
          }
        ],
        stationContributions: [
          {
            stationId: 'station-a',
            stationName: 'Alpha',
            stationCount: 2,
            production: 10,
            consumption: 4,
            netRate: 6
          }
        ]
      }
    ]

    const waresMap: Record<string, X4Ware> = {
      energycells: {
        id: 'energycells',
        nameId: 'energycells',
        name: 'Energy Cells',
        transport: 'container',
        volume: 1,
        price: 10,
        minPrice: 8,
        maxPrice: 12,
        tier: 1,
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
        resourceBufferHours: 0,
        primaryProductBufferHours: 12,
        secondaryProductBufferHours: 0,
        buyMultiplier: 0.5,
        sellMultiplier: 0.5,
        transportMinutes: 30,
        transportShipCapacity: 0,
        sunlight: 100
      },
      warePriorityLevels: {}
    })

    expect(derived[0]?.contributions[0]).toMatchObject({
      stationId: 'station-a',
      stationName: 'Alpha',
      stationCount: 2,
      netRate: 6
    })
  })
})
