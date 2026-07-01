import { describe, expect, it } from 'vitest'
import { groupCleanSlate } from '@/store/logic/autoGroup'
import { buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import type { SaveArchive, PlayerStationEntry } from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'
import mapsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import modulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import nopileosOnlyFixture from '../../fixtures/auto-group/save_009_fallback_nopileos_only.json'

type StationData = { m: Array<[string, number]>; c: Array<[string, number]> }
type CompactFixture = {
  sectors: Record<string, { n: string; s: Record<string, StationData> }>
}

function buildTestModule(
  macroId: string,
  type: X4Module['type'],
  cargo?: { type: 'container' | 'solid' | 'liquid'; capacity: number }
): X4Module {
  return {
    id: macroId, macroId, wareId: '', nameId: '', name: macroId, dlc_tag: '',
    type, method: 'default', group: '', race: '',
    isPlayerBlueprint: true, buildTime: 0, buildCost: {}, cycleTime: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 },
    outputs: {}, inputs: {},
    dockingCount: 0, buildProcessorCount: 0, buildShipClasses: [],
    color: '', color_rgb: '', tier: 0,
    ...(cargo ? { cargo } : {})
  }
}

function buildArchive(f: CompactFixture): SaveArchive {
  const sectors: SaveArchive['sectors'] = {}
  for (const [sectorMacro, sd] of Object.entries(f.sectors)) {
    const player_stations: Record<string, PlayerStationEntry> = {}
    for (const [code, st] of Object.entries(sd.s)) {
      player_stations[code] = {
        code, macro: '', owner: '',
        relative_position: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        modules: st.m.map(([ref, amount]) => ({ ref, amount })),
        constructions: st.c.flatMap(([ref, count]) =>
          Array.from({ length: count }, (_, i) => ({ id: `c_${ref}_${i}`, index: i + 1, ref }))
        )
      }
    }
    sectors[sectorMacro] = { name: sd.n, player_stations }
  }
  return {
    meta: { id: '', guid: '', time: 0, playerName: '', version: '', filename: '',
            parser_version: '', source: 'json', createdAt: new Date(), sectorCount: 0 },
    sectors, isCompatible: true, isValid: true
  }
}

function buildModulesByMacroId(): Record<string, X4Module> {
  const result: Record<string, X4Module> = {}
  for (const m of modulesRaw as Array<{
    macroId: string; type: string
    cargo?: { type: string; capacity: number }
  }>) {
    if (!m.macroId) continue
    result[m.macroId] = {
      id: m.macroId, macroId: m.macroId, wareId: '', nameId: '', name: m.macroId, dlc_tag: '',
      type: m.type as X4Module['type'], method: 'default', group: '', race: '',
      isPlayerBlueprint: true, buildTime: 0, buildCost: {}, cycleTime: 0,
      workforce: { capacity: 0, needed: 0, maxBonus: 0 },
      outputs: {}, inputs: {},
      dockingCount: 0, buildProcessorCount: 0, buildShipClasses: [],
      color: '', color_rgb: '', tier: 0,
      ...(m.cargo?.type && m.cargo?.capacity
        ? { cargo: { type: m.cargo.type as 'container' | 'solid' | 'liquid', capacity: m.cargo.capacity } }
        : {})
    }
  }
  return result
}

function buildSectorData() {
  return buildSectorGraphFromMaps(
    mapsRaw.clusters as Record<string, { sectors?: string[] }>,
    mapsRaw.sectors as Record<string, { id: string; cluster_id?: string; cluster_gates?: Record<string, { target_cluster_id?: string }> }>
  )
}

describe('autoGroup - cleanSlate production fallback seeds', () => {
  it('creates representative production anchors when no pure hub exists without seeding every station sector', () => {
    const archive = buildArchive({
      sectors: {
        A: { n: 'A', s: { SA: { m: [['container', 1], ['production', 1]], c: [] } } },
        B: { n: 'B', s: { SB: { m: [['container', 2], ['production', 1]], c: [] } } },
        C: { n: 'C', s: { SC: { m: [['container', 1], ['production', 1]], c: [] } } },
        X: { n: 'X', s: { SX: { m: [['container', 1], ['production', 1]], c: [] } } },
        Y: { n: 'Y', s: { SY: { m: [['container', 1], ['production', 1]], c: [] } } }
      }
    })
    const modulesByMacroId = {
      container: buildTestModule('container', 'storage', { type: 'container', capacity: 6_000_000 }),
      production: buildTestModule('production', 'production')
    }
    const sectorGraph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B'],
      X: ['Y'],
      Y: ['X']
    }
    const sectorClusterMap = { A: 'A', B: 'B', C: 'C', X: 'X', Y: 'Y' }

    const result = groupCleanSlate(
      archive,
      modulesByMacroId,
      sectorGraph,
      sectorClusterMap,
      { containerThreshold: 5_000_000 },
      1
    )
    const anchors = result.groups.map((group) => group.sectorMacro).sort()

    expect(anchors).toEqual(['B', 'X'])
    expect(anchors).not.toContain('A')
    expect(anchors).not.toContain('C')
    expect(anchors).not.toContain('Y')
    expect(result.assignments.map((assignment) => assignment.sectorMacro).sort()).toEqual(['A', 'C', 'Y'])
  })

  it('supplements production fallback anchors when only the Nopileos pure hub remains', () => {
    const { sectorGraph, sectorClusterMap } = buildSectorData()
    const result = groupCleanSlate(
      buildArchive(nopileosOnlyFixture as CompactFixture),
      buildModulesByMacroId(),
      sectorGraph,
      sectorClusterMap
    )
    const anchors = result.groups.map((group) => group.sectorMacro)

    expect(anchors).toContain('cluster_04_sector002_macro')
    expect(anchors.length).toBeGreaterThan(1)
    expect(anchors.some((anchor) => anchor !== 'cluster_04_sector002_macro')).toBe(true)
    expect(result.assignments.length).toBeGreaterThan(0)
  })
})
