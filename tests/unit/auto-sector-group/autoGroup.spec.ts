import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/auto-group/save_009_minimal.json'
import { groupCleanSlate, type AutoGroupResult, type GroupDraftInfo } from '@/store/logic/autoGroup'
import { buildSectorGraphFromMaps } from '@/store/logic/saveBindingUtils'
import type { SaveArchive, PlayerStationEntry } from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'
import mapsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import modulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'

type StationData = { m: Array<[string, number]>; c: Array<[string, number]> }
type CompactFixture = {
  sectors: Record<string, { n: string; s: Record<string, StationData> }>
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

function buildArchive(f: CompactFixture): SaveArchive {
  const sectors: SaveArchive['sectors'] = {}
  for (const [sectorMacro, sd] of Object.entries(f.sectors)) {
    const player_stations: Record<string, PlayerStationEntry> = {}
    for (const [code, st] of Object.entries(sd.s)) {
      const modules = st.m.map(([ref, amount]) => ({ ref, amount }))
      const constructions = st.c.flatMap(([ref, count]) =>
        Array.from({ length: count }, (_, i) => ({
          id: `c_${ref}_${i}`, index: i + 1, ref
        }))
      )
      player_stations[code] = {
        code, macro: '', owner: '',
        relative_position: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        modules, constructions
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

function buildSectorData() {
  const { sectorGraph, sectorClusterMap } = buildSectorGraphFromMaps(
    mapsRaw.clusters as Record<string, { sectors?: string[] }>,
    mapsRaw.sectors as Record<string, { id: string; cluster_id?: string; cluster_gates?: Record<string, { target_cluster_id?: string }> }>
  )
  return { sectorGraph, sectorClusterMap }
}

function runCleanSlate(): AutoGroupResult {
  const f = fixture as CompactFixture
  return groupCleanSlate(buildArchive(f), buildModulesByMacroId(), ...Object.values(buildSectorData()) as [any, any])
}

function hubAnchors(groups: GroupDraftInfo[]): string[] {
  return groups.map((g) => g.sectorMacro!)
}

describe('autoGroup - fixture structure', () => {
  it('has 22 sectors with 45 stations', () => {
    const f = fixture as CompactFixture
    let secCount = 0, stCount = 0
    for (const [, sd] of Object.entries(f.sectors)) {
      secCount++
      stCount += Object.keys(sd.s).length
    }
    expect(secCount).toBe(22)
    expect(stCount).toBe(45)
  })
})

describe('autoGroup - cleanSlate groups', () => {
  let result: AutoGroupResult

  beforeAll(() => { result = runCleanSlate() })

  it('produces 7 groups from pure hubs', () => {
    expect(result.groups).toHaveLength(7)
  })

  it('all 7 expected hub anchors present (background.md verified)', () => {
    const anchors = hubAnchors(result.groups)
    expect(anchors).toContain('cluster_02_sector001_macro')       // Eighteen Billion
    expect(anchors).toContain('cluster_04_sector002_macro')       // Nopileos' Fortune VI
    expect(anchors).toContain('cluster_29_sector001_macro')       // Hatikvah's Choice I
    expect(anchors).toContain('cluster_32_sector001_macro')       // Tharka's Cascade XV
    expect(anchors).toContain('cluster_713_sector001_macro')      // CEO's Doubt
    expect(anchors).toContain('cluster_100_sector001_macro')      // Asteroid Belt
    expect(anchors).toContain('cluster_401_sector001_macro')      // Family Zhin
  })

  it('group anchor is NOT in its own coverage (binding UI convention)', () => {
    for (const g of result.groups) {
      if (g.sectorMacro) {
        expect(g.coverageSectorMacros).not.toContain(g.sectorMacro)
      }
    }
  })

  it('no coverage overlap between groups', () => {
    const seen = new Set<string>()
    for (const g of result.groups) {
      for (const m of g.coverageSectorMacros) {
        expect(seen.has(m)).toBe(false)
        seen.add(m)
      }
    }
  })

  it('all groups are marked as new', () => {
    for (const g of result.groups) {
      expect(g.isNew).toBe(true)
    }
  })

  it('coverage only contains player sectors', () => {
    const playerSet = new Set(result.playerSectorMacros)
    for (const g of result.groups) {
      for (const m of g.coverageSectorMacros) {
        expect(playerSet.has(m)).toBe(true)
      }
    }
  })
})

describe('autoGroup - cleanSlate assignments', () => {
  let result: AutoGroupResult

  beforeAll(() => { result = runCleanSlate() })

  it('covers all 22 player sectors', () => {
    expect(result.assignments).toHaveLength(22)
    const assignedMacros = result.assignments.map(a => a.sectorMacro)
    for (const m of result.playerSectorMacros) {
      expect(assignedMacros).toContain(m)
    }
  })

  it('has at least 12 auto-assigned sectors', () => {
    const auto = result.assignments.filter(a => a.status === 'auto')
    expect(auto.length).toBeGreaterThanOrEqual(12)
  })

  it('has at least 1 uncertain_extend sector', () => {
    const extend = result.assignments.filter(a => a.status === 'uncertain_extend')
    expect(extend.length).toBeGreaterThanOrEqual(1)
  })

  it('has at least 1 uncertain_extend sector', () => {
    const extend = result.assignments.filter(a => a.status === 'uncertain_extend')
    expect(extend.length).toBeGreaterThanOrEqual(1)
  })

  it('auto-assigned sectors have selectedOptionIndex >= 0', () => {
    for (const a of result.assignments) {
      if (a.status === 'auto') {
        expect(a.selectedOptionIndex).toBeGreaterThanOrEqual(0)
        expect(a.defaultGroupId).toBeTruthy()
      }
    }
  })

  it('Savage Spur I auto-assigned (one-way highway blocks Asteroid Belt)', () => {
    const ssi = result.assignments.find(a => a.sectorMacro === 'cluster_112_sector001_macro')
    expect(ssi).toBeDefined()
    expect(ssi!.status).toBe('auto')
  })

  it('Savage Spur II auto-assigned (one-way highway blocks Tharka)', () => {
    const ssii = result.assignments.find(a => a.sectorMacro === 'cluster_112_sector002_macro')
    expect(ssii).toBeDefined()
    expect(ssii!.status).toBe('auto')
  })

  it('each assignment has the correct sectorMacro field', () => {
    for (const a of result.assignments) {
      expect(a.sectorMacro).toBeTruthy()
      expect(typeof a.sectorMacro).toBe('string')
    }
  })
})
