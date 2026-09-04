import { describe, expect, it } from 'vitest'
import { breadthFirstReachable } from '@/store/logic/mapSectorGraph'

describe('NPC trade jump range', () => {
  it('calculates candidates beyond the five-jump reachability cache horizon', () => {
    const sectors = Array.from({ length: 8 }, (_, index) => `sector-${index}`)
    const graph = Object.fromEntries(sectors.map((sector, index) => [
      sector,
      [sectors[index - 1], sectors[index + 1]].filter((item): item is string => item !== undefined)
    ]))
    const sectorClusterMap = Object.fromEntries(sectors.map((sector, index) => [sector, `cluster-${index}`]))

    expect(breadthFirstReachable(graph, 'sector-0', 5, sectorClusterMap)['sector-7']).toBeUndefined()
    expect(breadthFirstReachable(graph, 'sector-0', 13, sectorClusterMap)['sector-7']).toBe(7)
  })
})
