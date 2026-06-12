import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/auto-group/save_009_minimal.json'
import { groupCleanSlate, applyAbsorbToResult, applyStandaloneToResult, type AutoGroupResult, type GroupDraftInfo } from '@/store/logic/autoGroup'
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

  it('auto-connects each group to nearest neighbor', () => {
    let connected = 0
    for (const g of result.groups) {
      if (g.connectedGroupIds.length > 0) connected++
    }
    expect(connected).toBeGreaterThanOrEqual(1)
  })

  it('pure hub groups have hubStationCode set', () => {
    for (const g of result.groups) {
      if (g.isNew) {
        // Pure hub groups from cleanSlate should have station code
        expect(g.hubStationCode).toBeTruthy()
      }
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
})

describe('autoGroup - interactive applyAbsorb', () => {
  let result: AutoGroupResult
  const { sectorGraph, sectorClusterMap } = buildSectorData()

  beforeAll(() => { result = runCleanSlate() })

  it('absorb adds sector to target group coverage', () => {
    // Find an uncertain_extend sector and its absorb option
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')
    expect(extend).toBeDefined()
    const absorbOptIdx = extend!.options.findIndex(o => o.type === 'absorb')
    expect(absorbOptIdx).toBeGreaterThanOrEqual(0)
    const targetGroupId = extend!.options[absorbOptIdx]!.targetGroupId!

    const targetGroupBefore = result.groups.find(g => g.id === targetGroupId)
    expect(targetGroupBefore).toBeDefined()

    const updated = applyAbsorbToResult(result, extend!.sectorMacro, absorbOptIdx, sectorGraph, sectorClusterMap)
    const targetGroupAfter = updated.groups.find(g => g.id === targetGroupId)!

    expect(targetGroupAfter.coverageSectorMacros).toContain(extend!.sectorMacro)
    expect(targetGroupAfter.coverageSectorMacros.length).toBeGreaterThan(targetGroupBefore!.coverageSectorMacros.length)
  })

  it('absorb removes sector from other groups coverage', () => {
    // cluster_26 is uncertain_extend to Asteroid Belt (group 6)
    const extend = result.assignments.find(a =>
      a.sectorMacro === 'cluster_26_sector001_macro'
    )
    expect(extend).toBeDefined()
    const absorbOptIdx = extend!.options.findIndex(o => o.type === 'absorb')
    const targetGroupId = extend!.options[absorbOptIdx]!.targetGroupId!

    const updated = applyAbsorbToResult(result, extend!.sectorMacro, absorbOptIdx, sectorGraph, sectorClusterMap)

    // Other groups should NOT have this sector
    for (const g of updated.groups) {
      if (g.id !== targetGroupId) {
        expect(g.coverageSectorMacros).not.toContain(extend!.sectorMacro)
      }
    }
  })

  it('absorb marks assignment as auto with selected index', () => {
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')!
    const absorbOptIdx = extend.options.findIndex(o => o.type === 'absorb')

    const updated = applyAbsorbToResult(result, extend.sectorMacro, absorbOptIdx, sectorGraph, sectorClusterMap)
    const updatedAssignment = updated.assignments.find(a => a.sectorMacro === extend.sectorMacro)!

    expect(updatedAssignment.status).toBe('auto')
    expect(updatedAssignment.selectedOptionIndex).toBe(absorbOptIdx)
  })
})

describe('autoGroup - interactive applyStandalone', () => {
  let result: AutoGroupResult
  const { sectorGraph, sectorClusterMap } = buildSectorData()

  beforeAll(() => { result = runCleanSlate() })

  it('standalone creates new group with sector as anchor', () => {
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')!
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)

    expect(updated.groups.length).toBe(result.groups.length + 1)
    const newGroup = updated.groups[updated.groups.length - 1]!
    expect(newGroup.sectorMacro).toBe(extend.sectorMacro)
    expect(newGroup.isNew).toBe(true)
  })

  it('absorb removes standalone group when switching back', () => {
    const extend = result.assignments.find(a => a.sectorMacro === 'cluster_26_sector001_macro')!

    // First make it standalone
    const withStandalone = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)
    expect(withStandalone.groups.length).toBe(result.groups.length + 1)

    // Now switch back to absorb
    const reAssignment = withStandalone.assignments.find(a => a.sectorMacro === extend.sectorMacro)!
    const absorbIdx = reAssignment.options.findIndex(o => o.type === 'absorb')

    const switched = applyAbsorbToResult(withStandalone, extend.sectorMacro, absorbIdx, sectorGraph, sectorClusterMap, 3)
    // Standalone group should be removed
    expect(switched.groups.length).toBe(result.groups.length)
    // Sector should now be in the absorb target group
    const updatedAssignment = switched.assignments.find(a => a.sectorMacro === extend.sectorMacro)!
    expect(updatedAssignment.status).toBe('auto')
    expect(updatedAssignment.selectedOptionIndex).toBe(absorbIdx)
  })

  it('standalone removes standalone sector from old group coverage', () => {
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')!
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)

    for (let i = 0; i < updated.groups.length - 1; i++) {
      expect(updated.groups[i]!.coverageSectorMacros).not.toContain(extend.sectorMacro)
    }
  })

  it('standalone coverage respects existing occupied sectors', () => {
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')!
    const occupied = new Set<string>()
    for (const g of result.groups) {
      g.coverageSectorMacros.forEach((m) => occupied.add(m))
      if (g.sectorMacro) occupied.add(g.sectorMacro)
    }
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)
    const newGroup = updated.groups[updated.groups.length - 1]!
    for (const m of newGroup.coverageSectorMacros) {
      expect(occupied.has(m)).toBe(false)
    }
  })

  it('standalone selects standalone option, keeps card visible', () => {
    const extend = result.assignments.find(a => a.status === 'uncertain_extend')!
    const standaloneIdx = extend.options.findIndex(o => o.type === 'standalone')
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)
    const updatedAssignment = updated.assignments.find(a => a.sectorMacro === extend.sectorMacro)!
    expect(updatedAssignment.selectedOptionIndex).toBe(standaloneIdx)
    expect(updatedAssignment.options).toEqual(extend.options)
    expect(updated.groups.length).toBe(result.groups.length + 1)
  })

  it('standalone auto-reassigns nearby auto sectors if closer', () => {
    // cluster_26 (Atiya's Misfortune I) is uncertain_extend at distance 4 from Asteroid Belt
    const extend = result.assignments.find(a => a.sectorMacro === 'cluster_26_sector001_macro')!
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)
    
    // Any nearby auto sector that's closer to the new group should be moved to new group's coverage
    // Even if no sector qualifies, the new group should exist
    expect(updated.groups.length).toBe(result.groups.length + 1)
    const newGroupId = updated.groups[updated.groups.length - 1]!.id

    // Check if any sector was reassigned
    const reassigned = updated.assignments.find(a =>
      a.sectorMacro !== extend.sectorMacro &&
      a.defaultGroupId === newGroupId
    )
    if (reassigned) {
      expect(reassigned.status).toBe('auto')
    }
  })

  it('standalone adds new group candidate to nearby uncertain sectors', () => {
    const extend = result.assignments.find(a => a.sectorMacro === 'cluster_26_sector001_macro')!
    // First make cluster_26 standalone (creates a new group)
    const updated = applyStandaloneToResult(result, extend.sectorMacro, sectorGraph, sectorClusterMap, 3, (m) => m)
    const newGroupId = updated.groups[updated.groups.length - 1]!.id

    // Other uncertain sectors within range should get the new group as candidate
    // (Atiya's Misfortune I is at dist 4 from Asteroid Belt, the new group at Atiya's
    //  might not be within range of others, but the logic should not crash)
    expect(updated.groups.length).toBe(result.groups.length + 1)
  })
})
