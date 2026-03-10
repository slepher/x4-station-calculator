import { describe, expect, it } from 'vitest'
import type { EmpireGroupedFlows, SectorInternalData } from '@/types/x4'
import { buildStationComponentGapFlows } from '@/store/logic/stationGapViewModel'

function createGroupedFlows(params: {
  operations?: Array<{ wareId: string; netRate: number; orderIndex?: number; tier?: number }>
  supply?: Array<{ wareId: string; netRate: number; orderIndex?: number; tier?: number }>
}): EmpireGroupedFlows {
  const createFlow = (item: { wareId: string; netRate: number; orderIndex?: number; tier?: number }) => ({
    wareId: item.wareId,
    orderIndex: item.orderIndex ?? 0,
    tier: item.tier ?? 0,
    transportType: 'container' as const,
    unitVolume: 1,
    production: Math.max(item.netRate, 0),
    consumption: Math.max(-item.netRate, 0),
    workforceConsumption: 0,
    netRate: item.netRate,
    unitPrice: 1,
    netValue: item.netRate,
    contributions: [{
      stationId: `st-${item.wareId}`,
      stationName: `Station-${item.wareId}`,
      stationCount: 1,
      production: Math.max(item.netRate, 0),
      consumption: Math.max(-item.netRate, 0),
      workforceConsumption: 0,
      netRate: item.netRate,
      netValue: item.netRate
    }]
  })

  const operations = (params.operations || []).map(createFlow)
  const supply = (params.supply || []).map(createFlow)
  return {
    flows: [...operations, ...supply],
    empireGroups: {
      operations,
      supply
    }
  }
}

function createSectorInternalDataMap(): Map<string, SectorInternalData> {
  return new Map<string, SectorInternalData>([
    ['A', {
      sectorId: 'A',
      planning: { sectorId: 'A', localStationIds: ['sta-1'] },
      localGroupedFlows: createGroupedFlows({
        operations: [
          { wareId: 'w1', netRate: -5, orderIndex: 1, tier: 2 },
          { wareId: 'w2', netRate: 4, orderIndex: 2, tier: 1 }
        ],
        supply: []
      }),
      supplyStorageFlows: []
    }],
    ['B', {
      sectorId: 'B',
      planning: { sectorId: 'B', localStationIds: ['stb-1'] },
      localGroupedFlows: createGroupedFlows({
        operations: [],
        supply: [
          { wareId: 'w2', netRate: -1, orderIndex: 2, tier: 1 },
          { wareId: 'w3', netRate: -3, orderIndex: 3, tier: 1 }
        ]
      }),
      supplyStorageFlows: []
    }],
    ['C', {
      sectorId: 'C',
      planning: { sectorId: 'C', localStationIds: ['stc-1'] },
      localGroupedFlows: createGroupedFlows({
        operations: [{ wareId: 'w9', netRate: -9, orderIndex: 9, tier: 1 }],
        supply: []
      }),
      supplyStorageFlows: []
    }]
  ])
}

describe('stationGapViewModel', () => {
  it('aggregates by current sector component and merges same ware from operations into supply', () => {
    const result = buildStationComponentGapFlows({
      currentSectorId: 'A',
      sectors: [
        { id: 'A', name: 'Alpha', order: 0 },
        { id: 'B', name: 'Beta', order: 1 },
        { id: 'C', name: 'Gamma', order: 2 }
      ],
      sectorLinks: ['A|B'],
      orderedStations: [
        { id: 'sta-1', name: 'A-Station', sectorId: 'A', modules: [], settings: {} as any, lastUpdated: 0 },
        { id: 'stb-1', name: 'B-Station', sectorId: 'B', modules: [], settings: {} as any, lastUpdated: 0 },
        { id: 'stc-1', name: 'C-Station', sectorId: 'C', modules: [], settings: {} as any, lastUpdated: 0 }
      ],
      sectorInternalDataMap: createSectorInternalDataMap()
    })

    // C is disconnected and must not be included.
    expect(result.operations.find((item) => item.wareId === 'w9')).toBeUndefined()

    // w2 is present in operations(A) + supply(B), should be merged into supply only.
    expect(result.operations.find((item) => item.wareId === 'w2')).toBeUndefined()
    const mergedW2Supply = result.supply.find((item) => item.wareId === 'w2')
    expect(mergedW2Supply).toBeTruthy()
    expect(mergedW2Supply?.netRate).toBe(3)

    // w1 from A operations should remain.
    const w1 = result.operations.find((item) => item.wareId === 'w1')
    expect(w1?.netRate).toBe(-5)

    // External sector contribution should be synthesized for B.
    const w3 = result.supply.find((item) => item.wareId === 'w3')
    expect(w3).toBeTruthy()
    expect(w3?.contributions[0]?.stationId).toBe('sector:B')
  })

  it('returns empty when current sector is empty or not connected', () => {
    const map = createSectorInternalDataMap()
    const empty = buildStationComponentGapFlows({
      currentSectorId: '',
      sectors: [{ id: 'A', name: 'Alpha', order: 0 }],
      sectorLinks: [],
      orderedStations: [],
      sectorInternalDataMap: map
    })
    expect(empty.operations).toEqual([])
    expect(empty.supply).toEqual([])
  })
})
