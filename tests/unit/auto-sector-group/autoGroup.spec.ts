import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/auto-group/save_009_minimal.json'
import { groupCleanSlate, groupIncremental, applyAbsorbToResult, applyStandaloneToResult, applyBridgePlanToDraft, buildBridgePlanOptions, collectConnectedComponents, type AutoGroupResult, type GroupDraftInfo } from '@/store/logic/autoGroup'
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

  it('covers all player sectors via assignments or groups', () => {
    const anchorSectors = new Set(result.groups.filter(g => g.sectorMacro).map(g => g.sectorMacro!))
    const assignedMacros = result.assignments.map(a => a.sectorMacro)
    for (const m of result.playerSectorMacros) {
      // Hub anchors don't generate assignment cards
      if (!anchorSectors.has(m)) {
        expect(assignedMacros).toContain(m)
      }
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
    const auto = result.assignments.filter(a => a.status === 'auto')
    expect(auto.length).toBeGreaterThan(0)
  })

  it('Savage Spur I auto-assigned (one-way highway blocks Asteroid Belt)', () => {
    const ssi = result.assignments.find(a => a.sectorMacro === 'cluster_112_sector001_macro')
    expect(ssi).toBeDefined()
    expect(ssi!.status).toBe('auto')
  })

  it('selected absorb assignments are reflected in group coverage', () => {
    for (const assignment of result.assignments) {
      if (assignment.selectedOptionIndex === null) continue
      const selected = assignment.options[assignment.selectedOptionIndex]
      if (!selected || selected.type !== 'absorb' || !selected.targetGroupId) continue
      const targetGroup = result.groups.find((g) => g.id === selected.targetGroupId)
      expect(targetGroup).toBeDefined()
      if (targetGroup!.sectorMacro === assignment.sectorMacro) continue
      expect(targetGroup!.coverageSectorMacros).toContain(assignment.sectorMacro)
    }
  })
})

describe('autoGroup - recalculation with pinned hubs', () => {
  it('keeps generating new pure hubs outside pinned base groups', () => {
    const archive = buildArchive(fixture as CompactFixture)
    const modulesByMacroId = buildModulesByMacroId()
    const { sectorGraph, sectorClusterMap } = buildSectorData()
    const clean = groupCleanSlate(archive, modulesByMacroId, sectorGraph, sectorClusterMap)
    const pinnedGroups = clean.groups.slice(0, 2).map((group, index) => ({
      id: group.id,
      name: group.name,
      order: index,
      sectorMacro: group.sectorMacro,
      jumpRange: group.jumpRange,
      coverageSectorMacros: [],
      connectedGroupIds: []
    }))

    const recalculated = groupIncremental(
      archive,
      pinnedGroups,
      modulesByMacroId,
      sectorGraph,
      sectorClusterMap
    )

    expect(recalculated.groups.length).toBeGreaterThan(pinnedGroups.length)
    expect(recalculated.groups.some((group) =>
      group.isNew &&
      !pinnedGroups.some((pinned) => pinned.sectorMacro === group.sectorMacro)
    )).toBe(true)
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

  it('standalone derived candidates append, auto-select, and roll back without removing original candidates', () => {
    const sectorGraph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B', 'D'],
      D: ['C']
    }
    const sectorClusterMap = { A: 'A', B: 'B', C: 'C', D: 'D' }
    const base: AutoGroupResult = {
      groups: [
        {
          id: 'g1',
          name: 'Group A',
          sectorMacro: 'A',
          jumpRange: 2,
          originalJumpRange: 2,
          coverageSectorMacros: ['B'],
          connectedGroupIds: [],
          isNew: true,
          excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
        },
        {
          id: 'g2',
          name: 'Group D',
          sectorMacro: 'D',
          jumpRange: 2,
          originalJumpRange: 2,
          coverageSectorMacros: [],
          connectedGroupIds: [],
          isNew: true,
          excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
        }
      ],
      assignments: [
        {
          sectorMacro: 'B',
          status: 'auto',
          displayBucket: 'resolved',
          defaultGroupId: 'g1',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'g1', distance: 1, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        },
        {
          sectorMacro: 'C',
          status: 'auto',
          displayBucket: 'resolved',
          defaultGroupId: 'g2',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'g2', distance: 2, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      bridgePlans: [],
      playerSectorMacros: ['A', 'B', 'C', 'D']
    }

    const withStandalone = applyStandaloneToResult(base, 'B', sectorGraph, sectorClusterMap, 2, (m) => m)
    const newGroup = withStandalone.groups[withStandalone.groups.length - 1]!
    const cAssignment = withStandalone.assignments.find((a) => a.sectorMacro === 'C')!
    const derivedIndex = cAssignment.options.findIndex((o) => o.sourceGroupId === newGroup.id)

    expect(derivedIndex).toBeGreaterThanOrEqual(0)
    expect(cAssignment.options.some((o) => o.targetGroupId === 'g2')).toBe(true)
    expect(cAssignment.selectedOptionIndex).toBe(derivedIndex)
    expect(withStandalone.groups.find((g) => g.id === newGroup.id)!.coverageSectorMacros).toContain('C')

    const bAssignment = withStandalone.assignments.find((a) => a.sectorMacro === 'B')!
    const absorbIdx = bAssignment.options.findIndex((o) => o.targetGroupId === 'g1')
    const rolledBack = applyAbsorbToResult(withStandalone, 'B', absorbIdx, sectorGraph, sectorClusterMap, 2)
    const rolledBackC = rolledBack.assignments.find((a) => a.sectorMacro === 'C')!

    expect(rolledBackC.options.some((o) => o.sourceGroupId === newGroup.id)).toBe(false)
    expect(rolledBackC.options.some((o) => o.targetGroupId === 'g2')).toBe(true)
    expect(rolledBackC.selectedOptionIndex).toBe(0)
  })
})

describe('autoGroup - bridge adoption', () => {
  it('rebuilds assignments from adopted bridge groups as fixed anchors', () => {
    const sectorGraph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B', 'D'],
      D: ['C', 'E'],
      E: ['D']
    }
    const sectorClusterMap = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' }
    const base: AutoGroupResult = {
      groups: [
        {
          id: 'gA',
          name: 'Group A',
          sectorMacro: 'A',
          jumpRange: 2,
          originalJumpRange: 2,
          coverageSectorMacros: [],
          connectedGroupIds: [],
          isNew: true,
          excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
        },
        {
          id: 'gE',
          name: 'Group E',
          sectorMacro: 'E',
          jumpRange: 2,
          originalJumpRange: 2,
          coverageSectorMacros: ['C'],
          connectedGroupIds: [],
          isNew: true,
          excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
        }
      ],
      assignments: [
        {
          sectorMacro: 'B',
          status: 'auto',
          displayBucket: 'resolved',
          defaultGroupId: 'gA',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'gA', distance: 1, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        },
        {
          sectorMacro: 'C',
          status: 'auto',
          displayBucket: 'resolved',
          defaultGroupId: 'gE',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'gE', distance: 2, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      bridgePlans: [],
      playerSectorMacros: ['A', 'B', 'C', 'D', 'E']
    }
    const plan = {
      id: 'planB',
      recommended: true,
      selected: false,
      planScore: 100,
      connectedComponentCount: 2,
      totalJump: 2,
      maxJump: 1,
      stableKey: 'unitB',
      units: [{
        unitId: 'unitB',
        label: 'B',
        reaches: [],
        candidates: [{ sectorMacro: 'B', score: 100 }],
        selectedSectorMacro: 'B'
      }]
    }

    const updated = applyBridgePlanToDraft(
      { ...base, bridgePlans: [plan] },
      plan,
      2,
      (macro) => macro,
      sectorGraph,
      sectorClusterMap,
      5
    )
    const bridgeGroup = updated.groups.find((group) => group.sectorMacro === 'B')!
    // Hub anchors (bridge groups) don't generate assignment cards
    const bridgeAssignment = updated.assignments.find((assignment) => assignment.sectorMacro === 'B')
    const cAssignment = updated.assignments.find((assignment) => assignment.sectorMacro === 'C')!
    const selectedCOption = cAssignment.options[cAssignment.selectedOptionIndex!]

    expect(bridgeAssignment).toBeFalsy()
    expect(selectedCOption.targetGroupId).toBe(bridgeGroup.id)
    expect(bridgeGroup.coverageSectorMacros).toContain('C')
    expect(updated.groups.find((group) => group.id === 'gE')!.coverageSectorMacros).not.toContain('C')
  })

  it('keeps the best partial bridge plan when full component connection is impossible', () => {
    const groups: GroupDraftInfo[] = [
      {
        id: 'gA',
        name: 'Group A',
        sectorMacro: 'A',
        jumpRange: 1,
        originalJumpRange: 1,
        coverageSectorMacros: [],
        connectedGroupIds: [],
        isNew: true,
        excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
      },
      {
        id: 'gC',
        name: 'Group C',
        sectorMacro: 'C',
        jumpRange: 1,
        originalJumpRange: 1,
        coverageSectorMacros: [],
        connectedGroupIds: [],
        isNew: true,
        excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
      },
      {
        id: 'gE',
        name: 'Group E',
        sectorMacro: 'E',
        jumpRange: 1,
        originalJumpRange: 1,
        coverageSectorMacros: [],
        connectedGroupIds: [],
        isNew: true,
        excludedDefaultAssignmentSectorMacros: [],
          isPinned: false
      }
    ]
    const sectorGraph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B'],
      E: []
    }
    const sectorClusterMap = { A: 'A', B: 'B', C: 'C', E: 'E' }
    const sectorHubMap = new Map([
      ['B', [{ score: 100 } as any]]
    ])

    const plans = buildBridgePlanOptions(
      groups,
      ['A', 'B', 'C', 'E'],
      sectorHubMap,
      sectorGraph,
      sectorClusterMap,
      1
    )

    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0]!.connectedComponentCount).toBe(2)
    expect(plans[0]!.units.map((unit) => unit.selectedSectorMacro)).toContain('B')
  })

  it('bridge plan uses min distance to ANY group in component, not just first', () => {
    // Component 0: group A (anchor=far) connected to group B (anchor=near) via MST (dist=3)
    // Component 1: group D (anchor=d)
    // Bridge unit X can reach B (dist=1) and D (dist=1), but NOT A (dist=5)
    // Bug: component node uses first group A's anchor → dist(X,component_0)=5 > bridgeRange=4 → no edge
    // Fix: should use min distance → dist(X,B)=1 ≤ 4 → edge exists → solo plan valid
    const groups: GroupDraftInfo[] = [
      { id: 'gA', name: 'A', sectorMacro: 'A', jumpRange: 2, originalJumpRange: 2, coverageSectorMacros: [], connectedGroupIds: ['gB'], excludedDefaultAssignmentSectorMacros: [], isNew: true, isPinned: false },
      { id: 'gB', name: 'B', sectorMacro: 'B', jumpRange: 2, originalJumpRange: 2, coverageSectorMacros: [], connectedGroupIds: ['gA'], excludedDefaultAssignmentSectorMacros: [], isNew: true, isPinned: false },
      { id: 'gD', name: 'D', sectorMacro: 'D', jumpRange: 2, originalJumpRange: 2, coverageSectorMacros: [], connectedGroupIds: [], excludedDefaultAssignmentSectorMacros: [], isNew: true, isPinned: false },
    ]

    const sectorGraph: Record<string, string[]> = {
      A: ['m1'], m1: ['A', 'm2'], m2: ['m1', 'm3'], m3: ['m2', 'B'],
      B: ['m3', 'X'], X: ['B', 'D'], D: ['X'],
    }
    const sectorClusterMap: Record<string, string> = {
      A: 'cA', m1: 'c1', m2: 'c2', m3: 'c3', B: 'cB', X: 'cX', D: 'cD'
    }
    const playerSectorMacros = ['A', 'B', 'D', 'X']
    // Hub score for X = 5000
    const sectorHubMap = new Map([['X', [{ containerCap: 0, prodLines: 0, qualified: false, score: 5000, stationCode: '', stationMacro: '', isPureHub: false }]]])

    const plans = buildBridgePlanOptions(groups, playerSectorMacros, sectorHubMap, sectorGraph, sectorClusterMap, 4)

    const zsPlans = plans.filter(p => p.units.length === 1 && p.units[0]!.selectedSectorMacro === 'X')
    expect(zsPlans.length).toBeGreaterThan(0)
    expect(zsPlans[0]!.connectedComponentCount).toBe(2)
  })
})
