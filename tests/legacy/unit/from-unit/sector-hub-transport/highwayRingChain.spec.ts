import { describe, expect, it } from 'vitest'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import { buildMapHighwayRingChains, buildMapHighwayRings } from '@/store/logic/useGameData'
import type { X4Map } from '@/types/x4'

describe('highway ring chain derived map data', () => {
  it('builds the cross-sector highway ring with distinct forward and backward highways', () => {
    const maps = JSON.parse(JSON.stringify(mapsData)) as X4Map
    maps.highwayRings = buildMapHighwayRings(maps)

    const chains = buildMapHighwayRingChains(maps)

    expect(chains).toHaveLength(1)
    expect(chains[0]!.hops).toHaveLength(12)
    for (const hop of chains[0]!.hops) {
      expect(hop.sectorId).toBeTruthy()
      expect(hop.prevGateId).toBeTruthy()
      expect(hop.nextGateId).toBeTruthy()
      expect(hop.forwardHighwayId).toBeTruthy()
      expect(hop.backwardHighwayId).toBeTruthy()
      expect(hop.forwardHighwayId).not.toBe(hop.backwardHighwayId)
      expect(hop.forwardHighwayLengthKm).toBeGreaterThan(0)
      expect(hop.backwardHighwayLengthKm).toBeGreaterThan(0)
    }
  })
})
