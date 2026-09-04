import { describe, expect, it } from 'vitest'
import { buildTransitRoute, buildTransitRouteCandidates } from '@/store/logic/transitRouteBuilder'
import { generateHighwayAlternative } from '@/store/logic/transitRouteHighway'
import { buildMapHighwayRingChains, buildMapHighwayRings } from '@/store/logic/useGameData'
import type { X4MapCluster, X4MapSector } from '@/types/x4'
import mapsData from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import type { X4Map } from '@/types/x4'

function sector(id: string, clusterId = 'cluster_a', patch: Partial<X4MapSector> = {}): X4MapSector {
  return {
    id,
    cluster_id: clusterId,
    nameId: id,
    name: id,
    owner: '',
    owner_color: '',
    ...patch
  }
}

function cluster(id: string, sectors: string[], patch: Partial<X4MapCluster> = {}): X4MapCluster {
  return {
    id,
    nameId: id,
    name: id,
    dlc_tag: '',
    owner: '',
    owner_color: '',
    sectors,
    ...patch
  }
}

describe('sector-hub-transport route and highway construction', () => {
  it('builds gate route segments with normal distance and gate count', () => {
    const sectors = {
      a: sector('a', 'ca', {
        cluster_gates: {
          g_ab: { target_cluster_id: 'cb', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      b: sector('b', 'cb', {
        cluster_gates: {
          g_ba: { target_cluster_id: 'ca', raw_local_pos: { x: 5_000, y: 0, z: 0 } }
        }
      })
    }
    const route = buildTransitRoute({
      clusters: {
        ca: cluster('ca', ['a']),
        cb: cluster('cb', ['b'])
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'b' }
    })

    expect(route.problems).toEqual([])
    expect(route.summary.gateCount).toBe(1)
    expect(route.summary.normalDistanceKm).toBe(10)
    expect(route.segments.map((segment) => segment.kind)).toEqual(['station-to-gate', 'gate-transit'])
    expect(route.segments[0]).toMatchObject({
      fromPosition: { x: 0, y: 0, z: 0 },
      toPosition: { x: 10_000, y: 0, z: 0 }
    })
  })

  it('builds superhighway route segments without adding gate count or normal distance', () => {
    const sectors = {
      a: sector('a', 'cluster_a', {
        zones: { za: { id: 'za', raw_sector_pos: { x: 1_000, y: 0, z: 0 } } }
      }),
      b: sector('b', 'cluster_a', {
        zones: { zb: { id: 'zb', raw_sector_pos: { x: 25_000, y: 0, z: 0 } } }
      })
    }
    const route = buildTransitRoute({
      clusters: {
        cluster_a: cluster('cluster_a', ['a', 'b'], {
          sector_links: {
            link_ab: { id: 'link_ab', sector_a_id: 'a', sector_b_id: 'b', from_zone_id: 'za', to_zone_id: 'zb' }
          }
        })
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 1_000, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'b' }
    })

    expect(route.summary.gateCount).toBe(0)
    expect(route.summary.normalDistanceKm).toBe(0)
    expect(route.summary.superhighwayDistanceKm).toBe(24)
    expect(route.terminal.kind).toBe('superhighway-exit')
    expect(route.segments.map((segment) => segment.kind)).toEqual(['superhighway'])
  })

  it('generates in-sector highway alternative only for forward direction and useful ramps', () => {
    const highwaySector = sector('a', 'cluster_a', {
      highways: {
        ring: {
          spline: [
            { x: 0, z: 0 },
            { x: 100_000, z: 0 }
          ]
        }
      }
    })

    const forward = generateHighwayAlternative(
      { x: 0, z: 5_000 },
      { x: 100_000, z: 5_000 },
      'A',
      'B',
      highwaySector
    )
    expect(forward).not.toBeNull()
    expect(forward?.approachSegments).toHaveLength(1)
    expect(forward?.exitSegments).toHaveLength(1)
    expect(forward?.highwayDistanceKm).toBe(100)

    const adjacent = generateHighwayAlternative(
      { x: 0, z: 500 },
      { x: 100_000, z: 500 },
      'A',
      'B',
      highwaySector
    )
    expect(adjacent?.approachSegments).toHaveLength(0)
    expect(adjacent?.exitSegments).toHaveLength(0)

    const reverse = generateHighwayAlternative(
      { x: 100_000, z: 0 },
      { x: 0, z: 0 },
      'B',
      'A',
      highwaySector
    )
    expect(reverse).toBeNull()

    const rampLongerThanDirect = generateHighwayAlternative(
      { x: 0, z: 100_000 },
      { x: 1_000, z: 100_000 },
      'A',
      'B',
      highwaySector
    )
    expect(rampLongerThanDirect).toBeNull()
  })

  it('returns final route candidates sorted by normal distance then gate count', () => {
    const sectors = {
      a: sector('a', 'ca', {
        cluster_gates: {
          g_ab: { target_cluster_id: 'cb', raw_local_pos: { x: 10_000, y: 0, z: 0 } },
          g_ac: { target_cluster_id: 'cc', raw_local_pos: { x: 20_000, y: 0, z: 0 } },
          g_ae: { target_cluster_id: 'ce', raw_local_pos: { x: 30_000, y: 0, z: 0 } },
          g_af: { target_cluster_id: 'cf', raw_local_pos: { x: 40_000, y: 0, z: 0 } }
        }
      }),
      b: sector('b', 'cb', {
        cluster_gates: {
          g_ba: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_bd: { target_cluster_id: 'cd', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      c: sector('c', 'cc', {
        cluster_gates: {
          g_ca: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_cd: { target_cluster_id: 'cd', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      e: sector('e', 'ce', {
        cluster_gates: {
          g_ea: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_ed: { target_cluster_id: 'cd', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      f: sector('f', 'cf', {
        cluster_gates: {
          g_fa: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_fd: { target_cluster_id: 'cd', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      d: sector('d', 'cd', {
        cluster_gates: {
          g_db: { target_cluster_id: 'cb', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_dc: { target_cluster_id: 'cc', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_de: { target_cluster_id: 'ce', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_df: { target_cluster_id: 'cf', raw_local_pos: { x: 0, y: 0, z: 0 } }
        }
      })
    }

    const candidates = buildTransitRouteCandidates({
      clusters: {
        ca: cluster('ca', ['a']),
        cb: cluster('cb', ['b']),
        cc: cluster('cc', ['c']),
        cd: cluster('cd', ['d']),
        ce: cluster('ce', ['e']),
        cf: cluster('cf', ['f'])
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'd' }
    })

    expect(candidates).toHaveLength(1)
    expect(candidates.map((route) => route.summary.normalDistanceKm)).toEqual([11])
  })

  it('filters route candidates dominated across final selection metrics', () => {
    const sectors = {
      a: sector('a', 'ca', {
        cluster_gates: {
          g_ab: { target_cluster_id: 'cb', raw_local_pos: { x: 10_000, y: 0, z: 0 } },
          g_ac: { target_cluster_id: 'cc', raw_local_pos: { x: 20_000, y: 0, z: 0 } }
        }
      }),
      b: sector('b', 'cb', {
        cluster_gates: {
          g_ba: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_bd: { target_cluster_id: 'cd', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      c: sector('c', 'cc', {
        cluster_gates: {
          g_ca: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_ce: { target_cluster_id: 'ce', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      e: sector('e', 'ce', {
        cluster_gates: {
          g_ec: { target_cluster_id: 'cc', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_ed: { target_cluster_id: 'cd', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      d: sector('d', 'cd', {
        cluster_gates: {
          g_db: { target_cluster_id: 'cb', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_de: { target_cluster_id: 'ce', raw_local_pos: { x: 0, y: 0, z: 0 } }
        }
      })
    }

    const candidates = buildTransitRouteCandidates({
      clusters: {
        ca: cluster('ca', ['a']),
        cb: cluster('cb', ['b']),
        cc: cluster('cc', ['c']),
        cd: cluster('cd', ['d']),
        ce: cluster('ce', ['e'])
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'd' }
    })

    expect(candidates.map((route) => route.sectors)).toEqual([
      ['a', 'b', 'd']
    ])
  })

  it('selects normal distance before gate count when no ship is selected', () => {
    const sectors = {
      a: sector('a', 'ca', {
        cluster_gates: {
          g_ab: { target_cluster_id: 'cb', raw_local_pos: { x: 100_000, y: 0, z: 0 } },
          g_ac: { target_cluster_id: 'cc', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      b: sector('b', 'cb', {
        cluster_gates: {
          g_ba: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_bd: { target_cluster_id: 'cd', raw_local_pos: { x: 0, y: 0, z: 0 } }
        }
      }),
      c: sector('c', 'cc', {
        cluster_gates: {
          g_ca: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_ce: { target_cluster_id: 'ce', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      e: sector('e', 'ce', {
        cluster_gates: {
          g_ec: { target_cluster_id: 'cc', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_ed: { target_cluster_id: 'cd', raw_local_pos: { x: 10_000, y: 0, z: 0 } }
        }
      }),
      d: sector('d', 'cd', {
        cluster_gates: {
          g_db: { target_cluster_id: 'cb', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_de: { target_cluster_id: 'ce', raw_local_pos: { x: 0, y: 0, z: 0 } }
        }
      })
    }

    const route = buildTransitRoute({
      clusters: {
        ca: cluster('ca', ['a']),
        cb: cluster('cb', ['b']),
        cc: cluster('cc', ['c']),
        cd: cluster('cd', ['d']),
        ce: cluster('ce', ['e'])
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'd' }
    })

    expect(route.summary.normalDistanceKm).toBe(30)
    expect(route.summary.gateCount).toBe(3)
    expect(route.sectors).toEqual(['a', 'c', 'e', 'd'])
  })

  it('preserves concrete segment endpoints for candidates passing through the same sector', () => {
    const sectors = {
      a: sector('a', 'ca', {
        cluster_gates: {
          g_ax: { target_cluster_id: 'cx', raw_local_pos: { x: 10_000, y: 0, z: 0 } },
          g_ay: { target_cluster_id: 'cy', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      y: sector('y', 'cy', {
        cluster_gates: {
          g_ya: { target_cluster_id: 'ca', raw_local_pos: { x: 0, y: 0, z: 0 } },
          g_yx: { target_cluster_id: 'cx', raw_local_pos: { x: 1_000, y: 0, z: 0 } }
        }
      }),
      x: sector('x', 'cx', {
        cluster_gates: {
          g_xa: { target_cluster_id: 'ca', raw_local_pos: { x: 1_000, y: 0, z: 0 } },
          g_xy: { target_cluster_id: 'cy', raw_local_pos: { x: 30_000, y: 0, z: 0 } },
          g_xd: { target_cluster_id: 'cd', raw_local_pos: { x: 50_000, y: 0, z: 0 } }
        }
      }),
      d: sector('d', 'cd', {
        cluster_gates: {
          g_dx: { target_cluster_id: 'cx', raw_local_pos: { x: 0, y: 0, z: 0 } }
        }
      })
    }

    const candidates = buildTransitRouteCandidates({
      clusters: {
        ca: cluster('ca', ['a']),
        cy: cluster('cy', ['y']),
        cx: cluster('cx', ['x']),
        cd: cluster('cd', ['d'])
      },
      sectors,
      from: { sectorMacro: 'a', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 'd' }
    })

    const throughXSegments = candidates
      .filter((route) => route.sectors.includes('x'))
      .map((route) => route.segments.find((segment) =>
        segment.kind === 'gate-to-gate' &&
        segment.toPosition?.x === 50_000
      )?.fromPosition?.x)
      .filter((value): value is number => typeof value === 'number')

    expect(new Set(throughXSegments)).toEqual(new Set([1_000, 30_000]))
  })

  it('adds highway ring route candidates with engine-only summary metrics', () => {
    const maps = JSON.parse(JSON.stringify(mapsData)) as X4Map
    maps.highwayRings = buildMapHighwayRings(maps)
    maps.highwayRingChains = buildMapHighwayRingChains(maps)

    const candidates = buildTransitRouteCandidates({
      clusters: maps.clusters,
      sectors: maps.sectors,
      highwayRingChains: maps.highwayRingChains,
      from: {
        sectorMacro: 'cluster_18_sector001_macro',
        label: 'Hub',
        position: { x: 0, y: 0, z: 0 }
      },
      target: { kind: 'sector', sectorMacro: 'cluster_14_sector001_macro' }
    })

    const ringCandidate = candidates.find((candidate) =>
      candidate.summary.highwayDistanceKm > 0 &&
      candidate.summary.highwayGateCount > 0
    )

    expect(ringCandidate).toBeTruthy()
    expect(ringCandidate!.summary.engineDistanceKm).toBeLessThan(ringCandidate!.summary.normalDistanceKm)
    expect(ringCandidate!.segments.some((segment) => segment.kind === 'highway')).toBe(true)
  })

  it('does not explode highway ring route candidates by combining every ring entry and exit', () => {
    const maps = JSON.parse(JSON.stringify(mapsData)) as X4Map
    maps.highwayRings = buildMapHighwayRings(maps)
    maps.highwayRingChains = buildMapHighwayRingChains(maps)

    const candidates = buildTransitRouteCandidates({
      clusters: maps.clusters,
      sectors: maps.sectors,
      highwayRingChains: maps.highwayRingChains,
      from: {
        sectorMacro: 'cluster_18_sector001_macro',
        label: 'Hub',
        position: { x: 0, y: 0, z: 0 }
      },
      target: { kind: 'sector', sectorMacro: 'cluster_14_sector001_macro' }
    })

    const ringCandidates = candidates.filter((candidate) => candidate.summary.highwayDistanceKm > 0)
    expect(ringCandidates.length).toBeGreaterThan(0)
    expect(ringCandidates.length).toBeLessThanOrEqual(2)
  })

  it('does not return route candidates beyond five gate jumps', () => {
    const sectors: Record<string, X4MapSector> = {}
    const clusters: Record<string, X4MapCluster> = {}
    for (let i = 0; i <= 6; i += 1) {
      const sectorId = `s${i}`
      const clusterId = `c${i}`
      clusters[clusterId] = cluster(clusterId, [sectorId])
      sectors[sectorId] = sector(sectorId, clusterId, {
        cluster_gates: {}
      })
    }
    for (let i = 0; i < 6; i += 1) {
      sectors[`s${i}`]!.cluster_gates![`g_${i}_${i + 1}`] = {
        target_cluster_id: `c${i + 1}`,
        raw_local_pos: { x: 1_000, y: 0, z: 0 }
      }
      sectors[`s${i + 1}`]!.cluster_gates![`g_${i + 1}_${i}`] = {
        target_cluster_id: `c${i}`,
        raw_local_pos: { x: 0, y: 0, z: 0 }
      }
    }

    const candidates = buildTransitRouteCandidates({
      clusters,
      sectors,
      from: { sectorMacro: 's0', label: 'Hub', position: { x: 0, y: 0, z: 0 } },
      target: { kind: 'sector', sectorMacro: 's6' }
    })

    expect(candidates[0]!.problems).toEqual(['route:s0->s6'])
  })
})
