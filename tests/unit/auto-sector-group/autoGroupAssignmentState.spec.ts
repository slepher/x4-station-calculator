import { describe, expect, it } from 'vitest'
import {
  applyAbsorbToResult,
  applyStandaloneToResult,
  applyBridgePlanToDraft,
  buildAssignmentResult,
  groupIncremental,
  groupCleanSlate,
  setGroupPinnedInResult,
  sortAssignmentsForDisplay,
  rebuildAssignmentsForJumpRangeChange,
  preserveEditAssignmentSelections,
  type AutoGroupResult
} from '@/store/logic/autoGroup'
import type { SaveArchive, PlayerStationEntry } from '@/types/saveArchive'
import type { X4Module } from '@/types/x4'

const sectorGraph = {
  A: ['B'],
  B: ['A']
}

const sectorClusterMap = {
  A: 'A',
  B: 'B'
}

function buildResult(): AutoGroupResult {
  return {
    groups: [
      {
        id: 'g1',
        name: 'Group A',
        sectorMacro: 'A',
        jumpRange: 1,
        originalJumpRange: 1,
        coverageSectorMacros: [],
        connectedGroupIds: [],
        excludedDefaultAssignmentSectorMacros: [],
        isNew: false,
        isPinned: true,
        coverageRetainEnabled: true,
        connectionRetainEnabled: true
      }
    ],
    assignments: [
      {
        sectorMacro: 'B',
        status: 'uncertain_extend',
        displayBucket: 'unresolved',
        selectedOptionIndex: null,
        options: [
          {
            type: 'absorb',
            targetGroupId: 'g1',
            distance: 1,
            extendsRange: false,
            resultingGroupSize: 2
          },
          {
            type: 'standalone',
            distance: 0,
            extendsRange: false,
            resultingGroupSize: 1
          }
        ]
      }
    ],
    bridgePlans: [],
    playerSectorMacros: ['A', 'B']
  }
}

function buildStation(code: string, moduleRef: string = 'storage'): PlayerStationEntry {
  return {
    code,
    macro: '',
    owner: '',
    relative_position: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    modules: [{ ref: moduleRef, amount: 1 }]
  }
}

function buildArchiveWithStations(sectorMacros: string[], pureHubSectorMacros: string[] = sectorMacros): SaveArchive {
  const pureHubSectors = new Set(pureHubSectorMacros)
  return {
    meta: {
      id: '',
      guid: '',
      time: 0,
      playerName: '',
      version: '',
      filename: '',
      parser_version: '',
      source: 'json',
      createdAt: new Date(),
      sectorCount: sectorMacros.length
    },
    sectors: Object.fromEntries(
      sectorMacros.map((sectorMacro) => [
        sectorMacro,
        {
          name: sectorMacro,
          player_stations: {
            [`${sectorMacro}_station`]: buildStation(
              `${sectorMacro}_station`,
              pureHubSectors.has(sectorMacro) ? 'storage' : 'production'
            )
          }
        }
      ])
    ),
    isCompatible: true,
    isValid: true
  }
}

const modulesByMacroId: Record<string, X4Module> = {
  storage: {
    id: 'storage',
    macroId: 'storage',
    wareId: '',
    nameId: '',
    name: 'storage',
    dlc_tag: '',
    type: 'storage',
    method: 'default',
    group: '',
    race: '',
    isPlayerBlueprint: true,
    buildTime: 0,
    buildCost: {},
    cycleTime: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 },
    outputs: {},
    inputs: {},
    dockingCount: 0,
    buildProcessorCount: 0,
    buildShipClasses: [],
    color: '',
    color_rgb: '',
    tier: 0,
    cargo: { type: 'container', capacity: 10 }
  },
  production: {
    id: 'production',
    macroId: 'production',
    wareId: '',
    nameId: '',
    name: 'production',
    dlc_tag: '',
    type: 'production',
    method: 'default',
    group: '',
    race: '',
    isPlayerBlueprint: true,
    buildTime: 0,
    buildCost: {},
    cycleTime: 0,
    workforce: { capacity: 0, needed: 0, maxBonus: 0 },
    outputs: {},
    inputs: {},
    dockingCount: 0,
    buildProcessorCount: 0,
    buildShipClasses: [],
    color: '',
    color_rgb: '',
    tier: 0
  }
}

describe('autoGroup assignment state after user selection', () => {
  it('marks standalone selection as standalone without moving its display bucket', () => {
    const updated = applyStandaloneToResult(buildResult(), 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)
    const assignment = updated.assignments.find((a) => a.sectorMacro === 'B')!

    expect(assignment.selectedOptionIndex).toBe(1)
    expect(assignment.status).toBe('standalone')
    expect(assignment.displayBucket).toBe('unresolved')
  })

  it('assigns a generated color when standalone selection creates a hub', () => {
    const updated = applyStandaloneToResult(
      buildResult(),
      'B',
      sectorGraph,
      sectorClusterMap,
      1,
      (macro) => macro,
      undefined,
      {
        getFactionColor: () => undefined,
        getDistance: (from, to) => from === to ? 0 : 1,
        maxHop: 5
      }
    )

    expect(updated.groups.find((group) => group.sectorMacro === 'B')?.color).toBeTruthy()
    expect(updated.groups.find((group) => group.sectorMacro === 'B')?.color).not.toBe('transparent')
    expect(updated.groups.find((group) => group.sectorMacro === 'B')?.isPinned).toBe(false)
  })

  it('assigns a generated color when bridge selection creates a hub', () => {
    const base = buildResult()
    const plan = {
      id: 'bridge-plan',
      recommended: true,
      selected: false,
      units: [{
        unitId: 'unit-c',
        label: 'C',
        reaches: [],
        candidates: [{ sectorMacro: 'C', score: 10 }],
        selectedSectorMacro: 'C'
      }],
      connectedComponentCount: 2,
      planScore: 10,
      totalJump: 1,
      maxJump: 1,
      stableKey: 'unit-c'
    }
    const graph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B']
    }
    const clusterMap = {
      A: 'A',
      B: 'B',
      C: 'C'
    }

    const updated = applyBridgePlanToDraft(
      { ...base, bridgePlans: [plan], playerSectorMacros: ['A', 'B', 'C'] },
      plan,
      1,
      (macro) => macro,
      graph,
      clusterMap,
      undefined,
      {
        getFactionColor: () => undefined,
        getDistance: (from, to) => from === to ? 0 : 1,
        maxHop: 5
      }
    )

    expect(updated.groups.find((group) => group.sectorMacro === 'C')?.color).toBeTruthy()
    expect(updated.groups.find((group) => group.sectorMacro === 'C')?.color).not.toBe('transparent')
    expect(updated.groups.find((group) => group.sectorMacro === 'C')?.isPinned).toBe(true)
  })

  it('uses sectorMacro as bridge hub runtime id instead of auto uuid', () => {
    const base = buildResult()
    const plan = {
      id: 'bridge-plan',
      recommended: true,
      selected: false,
      units: [{
        unitId: 'unit-c',
        label: 'C',
        reaches: [],
        candidates: [{ sectorMacro: 'C', score: 10 }],
        selectedSectorMacro: 'C'
      }],
      connectedComponentCount: 2,
      planScore: 10,
      totalJump: 1,
      maxJump: 1,
      stableKey: 'unit-c'
    }
    const graph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B']
    }
    const clusterMap = {
      A: 'A',
      B: 'B',
      C: 'C'
    }

    const updated = applyBridgePlanToDraft(
      { ...base, bridgePlans: [plan], playerSectorMacros: ['A', 'B', 'C'] },
      plan,
      1,
      (macro) => macro,
      graph,
      clusterMap
    )

    const bridgeGroup = updated.groups.find((group) => group.sectorMacro === 'C')!
    expect(bridgeGroup.id).toBe('C')
    expect(bridgeGroup.id).not.toMatch(/^auto_/)
  })

  it('does not add duplicate hub groups when standalone is selected repeatedly', () => {
    const first = applyStandaloneToResult(buildResult(), 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)
    const second = applyStandaloneToResult(first, 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)

    expect(second).toBe(first)
    expect(second.groups.filter((group) => group.sectorMacro === 'B')).toHaveLength(1)
  })

  it('keeps an existing explicit standalone selection when another standalone hub adds an extension option', () => {
    const graph = {
      H: ['H1'],
      H1: ['H', 'H2'],
      H2: ['H1', 'T'],
      T: ['H2', 'S1'],
      S1: ['T', 'S2'],
      S2: ['S1', 'S'],
      S: ['S2']
    }
    const clusterMap = {
      H: 'H',
      H1: 'H1',
      H2: 'H2',
      T: 'T',
      S1: 'S1',
      S2: 'S2',
      S: 'S'
    }
    const baseGroup = buildResult().groups[0]!
    const result: AutoGroupResult = {
      groups: [
        { ...baseGroup, id: 'H', name: 'Hub H', sectorMacro: 'H', jumpRange: 1, originalJumpRange: 1 }
      ],
      assignments: [
        {
          sectorMacro: 'T',
          status: 'standalone',
          displayBucket: 'unresolved',
          selectedOptionIndex: 1,
          options: [
            { type: 'absorb', targetGroupId: 'H', distance: 3, extendsRange: true, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        },
        {
          sectorMacro: 'S',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: null,
          options: [
            { type: 'absorb', targetGroupId: 'H', distance: 6, extendsRange: true, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      bridgePlans: [],
      playerSectorMacros: ['H', 'T', 'S']
    }

    const updated = applyStandaloneToResult(result, 'S', graph, clusterMap, 1, (macro) => macro)
    const tAssignment = updated.assignments.find((assignment) => assignment.sectorMacro === 'T')!

    expect(tAssignment.options.some((option) => option.type === 'absorb' && option.targetGroupId === 'S' && option.extendsRange)).toBe(true)
    expect(tAssignment.selectedSectorMacro).toBe('T')
    expect(tAssignment.options[tAssignment.selectedOptionIndex!]?.type).toBe('standalone')
    expect(tAssignment.status).toBe('standalone')
  })

  it('marks absorb selection as auto without moving its display bucket', () => {
    const updated = applyAbsorbToResult(buildResult(), 'B', 0, sectorGraph, sectorClusterMap, 1)
    const assignment = updated.assignments.find((a) => a.sectorMacro === 'B')!

    expect(assignment.selectedOptionIndex).toBe(0)
    expect(assignment.status).toBe('auto')
    expect(assignment.displayBucket).toBe('unresolved')
  })

  it('rebuilds other affected sector options when extension absorb extends hub jumpRange', () => {
    const baseGroup = buildResult().groups[0]!
    const absorbGraph = {
      H: ['M1'],
      M1: ['H', 'M2'],
      M2: ['M1', 'M3'],
      M3: ['M2', 'T', 'U'],
      T: ['M3'],
      U: ['M3']
    }
    const absorbCluster = { H: 'H', M1: 'M1', M2: 'M2', M3: 'M3', T: 'T', U: 'U' }
    const result: AutoGroupResult = {
      groups: [
        { ...baseGroup, id: 'H', sectorMacro: 'H', jumpRange: 2, originalJumpRange: 2 }
      ],
      assignments: [
        {
          sectorMacro: 'T',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'H', distance: 3, extendsRange: true, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        },
        {
          sectorMacro: 'U',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: null,
          options: [
            { type: 'absorb', targetGroupId: 'H', distance: 3, extendsRange: true, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      bridgePlans: [],
      playerSectorMacros: ['H', 'T', 'U']
    }

    const updated = applyAbsorbToResult(result, 'T', 0, absorbGraph, absorbCluster, 2)

    const uAssignment = updated.assignments.find((a) => a.sectorMacro === 'U')!
    const hOpt = uAssignment.options.find((o) => o.targetGroupId === 'H')!
    expect(hOpt.extendsRange).toBe(false)
    expect(uAssignment.selectedOptionIndex).toBe(uAssignment.options.indexOf(hOpt))
    expect(uAssignment.status).toBe('auto')
  })

  it('uses standalone-only unresolved assignment when nearest hub is beyond max extension jump', () => {
    const graph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B', 'D'],
      D: ['C', 'E'],
      E: ['D', 'F'],
      F: ['E', 'G'],
      G: ['F', 'H'],
      H: ['G']
    }
    const clusterMap = {
      A: 'A',
      B: 'B',
      C: 'C',
      D: 'D',
      E: 'E',
      F: 'F',
      G: 'G',
      H: 'H'
    }
    const group = {
      ...buildResult().groups[0]!,
      id: 'hubA',
      sectorMacro: 'A',
      jumpRange: 1,
      originalJumpRange: 1
    }

    const assignments = buildAssignmentResult(['H'], new Map([['A', 'hubA']]), [group], graph, clusterMap)
    const assignment = assignments.find((candidate) => candidate.sectorMacro === 'H')!

    expect(assignment.options).toEqual([
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ])
    expect(assignment.selectedOptionIndex).toBeNull()
    expect(assignment.displayBucket).toBe('unresolved')
    expect(assignment.status).not.toBe('auto')
  })

  it('uses standalone-only unresolved assignments when no hub exists', () => {
    const assignments = buildAssignmentResult(['A', 'B'], new Map(), [], sectorGraph, sectorClusterMap)

    expect(assignments.map((assignment) => assignment.sectorMacro)).toEqual(['A', 'B'])
    for (const assignment of assignments) {
      expect(assignment.options).toEqual([
        { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
      ])
      expect(assignment.selectedOptionIndex).toBeNull()
      expect(assignment.displayBucket).toBe('unresolved')
      expect(assignment.status).not.toBe('auto')
    }
  })

  it('unpin keeps the hub and adds a default standalone assignment, while pin removes it', () => {
    const unpinned = setGroupPinnedInResult(buildResult(), 'g1', false, sectorGraph, sectorClusterMap)

    expect(unpinned.groups).toHaveLength(1)
    expect(unpinned.groups[0]!.isPinned).toBe(false)

    const assignment = unpinned.assignments.find((a) => a.sectorMacro === 'A')!
    expect(assignment).toBeTruthy()
    expect(assignment.status).toBe('standalone')
    expect(assignment.selectedOptionIndex).not.toBeNull()
    expect(assignment.options[assignment.selectedOptionIndex!]?.type).toBe('standalone')

    const pinned = setGroupPinnedInResult(unpinned, 'g1', true, sectorGraph, sectorClusterMap)
    expect(pinned.groups[0]!.isPinned).toBe(true)
    expect(pinned.assignments.some((a) => a.sectorMacro === 'A')).toBe(false)
  })

  it('unpin standalone assignment does not expose absorb options beyond max uncertain jump', () => {
    const longGraph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B', 'D'],
      D: ['C', 'E'],
      E: ['D', 'F'],
      F: ['E', 'G'],
      G: ['F']
    }
    const longClusterMap = {
      A: 'A',
      B: 'B',
      C: 'C',
      D: 'D',
      E: 'E',
      F: 'F',
      G: 'G'
    }
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        buildResult().groups[0]!,
        {
          id: 'gFar',
          name: 'Far Group',
          sectorMacro: 'G',
          jumpRange: 1,
          originalJumpRange: 1,
          coverageSectorMacros: [],
          connectedGroupIds: [],
          excludedDefaultAssignmentSectorMacros: [],
          isNew: false,
          isPinned: true,
          coverageRetainEnabled: true,
          connectionRetainEnabled: true
        }
      ],
      assignments: [],
      playerSectorMacros: ['A', 'G']
    }

    const unpinned = setGroupPinnedInResult(result, 'g1', false, longGraph, longClusterMap)
    const assignment = unpinned.assignments.find((a) => a.sectorMacro === 'A')!

    expect(assignment.options).toHaveLength(1)
    expect(assignment.options[0]!.type).toBe('standalone')
  })

  it('unpin assignment keeps all in-range absorb options instead of only the best one', () => {
    const graph = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B']
    }
    const clusterMap = {
      A: 'A',
      B: 'B',
      C: 'C'
    }
    const baseGroup = buildResult().groups[0]!
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        baseGroup,
        {
          ...baseGroup,
          id: 'gB',
          name: 'Group B',
          sectorMacro: 'B',
          jumpRange: 2,
          originalJumpRange: 2
        },
        {
          ...baseGroup,
          id: 'gC',
          name: 'Group C',
          sectorMacro: 'C',
          jumpRange: 2,
          originalJumpRange: 2
        }
      ],
      assignments: [],
      playerSectorMacros: ['A', 'B', 'C']
    }

    const unpinned = setGroupPinnedInResult(result, 'g1', false, graph, clusterMap)
    const assignment = unpinned.assignments.find((a) => a.sectorMacro === 'A')!

    expect(assignment.options.filter((option) => option.type === 'absorb').map((option) => option.targetGroupId)).toEqual(['gB', 'gC'])
    expect(assignment.options[assignment.selectedOptionIndex!]?.type).toBe('standalone')
  })

  it('orders unpin assignments first by the order they were unpinned', () => {
    const baseGroup = buildResult().groups[0]!
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        baseGroup,
        {
          ...baseGroup,
          id: 'gB',
          name: 'Group B',
          sectorMacro: 'B'
        }
      ],
      assignments: [
        {
          sectorMacro: 'C',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: null,
          options: [
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      playerSectorMacros: ['A', 'B', 'C']
    }

    const firstUnpin = setGroupPinnedInResult(result, 'gB', false, sectorGraph, sectorClusterMap)
    const secondUnpin = setGroupPinnedInResult(firstUnpin, 'g1', false, sectorGraph, sectorClusterMap)
    const sorted = sortAssignmentsForDisplay(secondUnpin.assignments, secondUnpin.groups)

    expect(sorted.map((assignment) => assignment.sectorMacro)).toEqual(['B', 'A', 'C'])
  })

  it('keeps unpin assignment at top after absorb to another group', () => {
    const baseGroup = buildResult().groups[0]!
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        baseGroup,
        {
          ...baseGroup,
          id: 'gB',
          name: 'Group B',
          sectorMacro: 'B'
        }
      ],
      assignments: [
        {
          sectorMacro: 'C',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: null,
          options: [
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      playerSectorMacros: ['A', 'B', 'C']
    }

    const unpinned = setGroupPinnedInResult(result, 'gB', false, sectorGraph, sectorClusterMap)
    const unpinAssignment = unpinned.assignments.find((a) => a.sectorMacro === 'B')!
    expect(unpinAssignment.displayBucket).toBe('unpin')
    expect(unpinAssignment.unpinOrder).toBe(1)

    const absorbOptionIdx = unpinAssignment.options.findIndex((o) => o.type === 'absorb' && o.targetGroupId === 'g1')
    const absorbed = applyAbsorbToResult(unpinned, 'B', absorbOptionIdx, sectorGraph, sectorClusterMap, 1)
    const absorbedAssignment = absorbed.assignments.find((a) => a.sectorMacro === 'B')!

    expect(absorbedAssignment.status).toBe('auto')
    expect(absorbedAssignment.displayBucket).toBe('unpin')
    expect(absorbedAssignment.unpinOrder).toBe(1)

    const sorted = sortAssignmentsForDisplay(absorbed.assignments, absorbed.groups)
    expect(sorted[0]!.sectorMacro).toBe('B')
  })

  it('keeps unpin assignment at top after switching back to standalone', () => {
    const baseGroup = buildResult().groups[0]!
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        baseGroup,
        {
          ...baseGroup,
          id: 'gB',
          name: 'Group B',
          sectorMacro: 'B'
        }
      ],
      assignments: [
        {
          sectorMacro: 'C',
          status: 'uncertain_extend',
          displayBucket: 'unresolved',
          selectedOptionIndex: null,
          options: [
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ],
      playerSectorMacros: ['A', 'B', 'C']
    }

    const unpinned = setGroupPinnedInResult(result, 'gB', false, sectorGraph, sectorClusterMap)
    const unpinAssignment = unpinned.assignments.find((a) => a.sectorMacro === 'B')!
    const absorbOptionIdx = unpinAssignment.options.findIndex((o) => o.type === 'absorb' && o.targetGroupId === 'g1')
    const absorbed = applyAbsorbToResult(unpinned, 'B', absorbOptionIdx, sectorGraph, sectorClusterMap, 1)
    const standalone = applyStandaloneToResult(absorbed, 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)
    const standaloneAssignment = standalone.assignments.find((a) => a.sectorMacro === 'B')!

    expect(standaloneAssignment.status).toBe('standalone')
    expect(standaloneAssignment.displayBucket).toBe('unpin')
    expect(standaloneAssignment.unpinOrder).toBe(1)

    const sorted = sortAssignmentsForDisplay(standalone.assignments, standalone.groups)
    expect(sorted[0]!.sectorMacro).toBe('B')
  })

  it('normalizes previously unpinned sectors that reappear as calculated hubs', async () => {
    const autoGroup = await import('@/store/logic/autoGroup')
    const result: AutoGroupResult = {
      ...buildResult(),
      groups: [
        {
          ...buildResult().groups[0]!,
          isPinned: false
        }
      ],
      assignments: [
        {
          sectorMacro: 'A',
          status: 'standalone',
          displayBucket: 'resolved',
          selectedOptionIndex: 0,
          options: [
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ]
    }

    const normalized = (autoGroup as any).normalizeReappearedUnpinnedHubs(result, new Set(['A'])) as AutoGroupResult

    expect(normalized.groups[0]!.isPinned).toBe(true)
    expect(normalized.assignments.some((assignment) => assignment.sectorMacro === 'A')).toBe(false)
  })

  it('finds recalculated hubs before retained coverage can occupy them', () => {
    const result = groupIncremental(
      buildArchiveWithStations(['A', 'B', 'C'], ['A', 'C']),
      [
        {
          name: 'Group C',
          order: 0,
          sectorMacro: 'C',
          jumpRange: 2,
          coverageSectorMacros: [{ ref: 'A', jump: 0 }, { ref: 'B', jump: 0 }],
          connectedGroupIds: []
        }
      ],
      modulesByMacroId,
      {
        A: ['B'],
        B: ['A', 'D'],
        D: ['B', 'C'],
        C: ['D']
      },
      {
        A: 'A',
        B: 'B',
        D: 'D',
        C: 'C'
      },
      { containerThreshold: 1 },
      2,
      5
    )

    const groupA = result.groups.find((group) => group.sectorMacro === 'A')!
    const groupC = result.groups.find((group) => group.sectorMacro === 'C')!

    expect(groupA).toBeTruthy()
    expect(groupA.coverageSectorMacros).toContain('B')
    expect(groupC.coverageSectorMacros).not.toContain('A')
    expect(groupC.coverageSectorMacros).not.toContain('B')
  })

  it('absorbs a sector by removing its own hub even when the hub is not new', () => {
    const base = buildResult()
    const result: AutoGroupResult = {
      ...base,
      groups: [
        {
          ...base.groups[0]!,
          id: 'A',
          sectorMacro: 'A',
          connectedGroupIds: ['B']
        },
        {
          ...base.groups[0]!,
          id: 'B',
          name: 'Group B',
          sectorMacro: 'B',
          isNew: false,
          connectedGroupIds: ['A']
        }
      ],
      assignments: [
        {
          sectorMacro: 'B',
          status: 'standalone',
          displayBucket: 'resolved',
          selectedOptionIndex: 1,
          options: [
            { type: 'absorb', targetGroupId: 'A', distance: 1, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ]
    }

    const updated = applyAbsorbToResult(result, 'B', 0, sectorGraph, sectorClusterMap, 1)

    expect(updated.groups.map((group) => group.id)).toEqual(['A'])
    expect(updated.groups[0]!.connectedGroupIds).toEqual([])
    expect(updated.groups[0]!.coverageSectorMacros).toContain('B')
  })

  describe('applyStandaloneToResult derived candidate rules', () => {
    const graph = {
      H: ['A', 'B', 'C', 'D', 'E', 'F'],
      A: ['H'],
      B: ['H'],
      C: ['H'],
      D: ['H'],
      E: ['H'],
      F: ['H']
    }
    const clusterMap = {
      H: 'H', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F'
    }

    function buildResultWithHub(hubSector: string, unassignedSectors: string[]): AutoGroupResult {
      const baseGroup = buildResult().groups[0]!
      return {
        groups: [
          {
            ...baseGroup,
            id: hubSector,
            name: `Group ${hubSector}`,
            sectorMacro: hubSector,
            jumpRange: 1,
            originalJumpRange: 1
          }
        ],
        assignments: unassignedSectors.map((sectorMacro) => ({
          sectorMacro,
          status: 'uncertain_extend' as const,
          displayBucket: 'unresolved' as const,
          selectedOptionIndex: null,
          options: [
            { type: 'standalone' as const, distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        })),
        bridgePlans: [],
        playerSectorMacros: [hubSector, ...unassignedSectors]
      }
    }

    it('appends extension absorb candidate when distance > prefJumpRange and <= MAX_UNCERTAIN_JUMP', () => {
      const result = buildResultWithHub('H', ['D'])
      const updated = applyStandaloneToResult(result, 'D', graph, clusterMap, 1, (macro) => macro)

      const dGroup = updated.groups.find((g) => g.sectorMacro === 'D')!
      expect(dGroup).toBeTruthy()

      const hAssignment = updated.assignments.find((a) => a.sectorMacro === 'H')
      if (hAssignment) {
        const hOpt = hAssignment.options.find((o) => o.targetGroupId === dGroup.id)
        if (hOpt) {
          expect(hOpt.extendsRange).toBe(true)
          expect(hOpt.distance).toBeGreaterThan(1)
        }
      }
    })

    it('keeps selectedOptionIndex null when only extension candidates exist', () => {
      const result = buildResultWithHub('H', ['E'])
      const updated = applyStandaloneToResult(result, 'E', graph, clusterMap, 1, (macro) => macro)

      const hAssignment = updated.assignments.find((a) => a.sectorMacro === 'H')
      if (hAssignment) {
        const extensionOpt = hAssignment.options.find((o) => o.extendsRange && o.targetGroupId === 'E')
        if (extensionOpt) {
          expect(hAssignment.selectedOptionIndex).toBeNull()
          expect(hAssignment.status).toBe('uncertain_extend')
        }
      }
    })

    it('switches to new hub when it is closer than current selection', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['T'],
        T: ['S', 'H1'],
        H1: ['T']
      }
      const standaloneCluster = { S: 'S', T: 'T', H1: 'H1' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const sGroup = updated.groups.find((g) => g.sectorMacro === 'S')!
      const sOpt = tAssignment.options.find((o) => o.targetGroupId === sGroup.id)

      if (sOpt && !sOpt.extendsRange) {
        expect(tAssignment.selectedOptionIndex).toBe(tAssignment.options.indexOf(sOpt))
        expect(tAssignment.status).toBe('auto')
      }
    })

    it('does not switch when current selection is already better', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'auto',
            displayBucket: 'resolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 1, extendsRange: false, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['T'],
        T: ['S', 'H1'],
        H1: ['T']
      }
      const standaloneCluster = { S: 'S', T: 'T', H1: 'H1' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const sGroup = updated.groups.find((g) => g.sectorMacro === 'S')!
      const sOpt = tAssignment.options.find((o) => o.targetGroupId === sGroup.id)

      if (sOpt && sOpt.distance >= 1) {
        expect(tAssignment.selectedOptionIndex).toBe(0)
      }
    })

    it('does not resolve uncertain tie when new hub still ties with existing candidates', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1, hubScore: 10 },
          { ...baseGroup, id: 'H2', sectorMacro: 'H2', jumpRange: 1, originalJumpRange: 1, hubScore: 10 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'absorb', targetGroupId: 'H2', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'uncertain_tie',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 1, extendsRange: false, resultingGroupSize: 3 },
              { type: 'absorb', targetGroupId: 'H2', distance: 1, extendsRange: false, resultingGroupSize: 3 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'H2', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['T'],
        T: ['S', 'H1', 'H2'],
        H1: ['T', 'H2'],
        H2: ['T', 'H1']
      }
      const standaloneCluster = { S: 'S', T: 'T', H1: 'H1', H2: 'H2' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const sGroup = updated.groups.find((g) => g.sectorMacro === 'S')!
      const sOpt = tAssignment.options.find((o) => o.targetGroupId === sGroup.id)

      if (sOpt && sOpt.distance === 1) {
        expect(tAssignment.selectedOptionIndex).toBeNull()
        expect(tAssignment.status).toBe('uncertain_tie')
      }
    })

    it('preserves explicit standalone selection when new hub appends range hit', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'standalone',
            displayBucket: 'resolved',
            selectedOptionIndex: 1,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['T'],
        T: ['S', 'H1'],
        H1: ['T']
      }
      const standaloneCluster = { S: 'S', T: 'T', H1: 'H1' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const standaloneIdx = tAssignment.options.findIndex((o) => o.type === 'standalone')

      expect(tAssignment.selectedOptionIndex).toBe(standaloneIdx)
      expect(tAssignment.status).toBe('standalone')
    })

    it('does not append extension candidate when sector already has range hit', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 5, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'auto',
            displayBucket: 'resolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 1, extendsRange: false, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['M1'],
        M1: ['S', 'M2'],
        M2: ['M1', 'T'],
        T: ['M2', 'H1'],
        H1: ['T']
      }
      const standaloneCluster = { S: 'S', M1: 'M1', M2: 'M2', T: 'T', H1: 'H1' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const sGroup = updated.groups.find((g) => g.sectorMacro === 'S')!
      const sOpt = tAssignment.options.find((o) => o.targetGroupId === sGroup.id)
      expect(sOpt).toBeUndefined()

      expect(tAssignment.selectedOptionIndex).toBe(0)
      expect(tAssignment.status).toBe('auto')
    })

    it('removes extension absorb options when new range hit is appended', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 1, originalJumpRange: 1 }
        ],
        assignments: [
          {
            sectorMacro: 'S',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          },
          {
            sectorMacro: 'T',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: null,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 2, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'S', 'T']
      }

      const standaloneGraph = {
        S: ['T'],
        T: ['S', 'H1'],
        H1: ['T']
      }
      const standaloneCluster = { S: 'S', T: 'T', H1: 'H1' }

      const updated = applyStandaloneToResult(result, 'S', standaloneGraph, standaloneCluster, 1, (macro) => macro)

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const extensionOpts = tAssignment.options.filter((o) => o.type === 'absorb' && o.extendsRange)
      expect(extensionOpts).toHaveLength(0)

      const rangeOpts = tAssignment.options.filter((o) => o.type === 'absorb' && !o.extendsRange)
      expect(rangeOpts.length).toBeGreaterThan(0)
    })
  })

  describe('rebuildAssignmentsForJumpRangeChange', () => {
    const graph = {
      H: ['M1'],
      M1: ['H', 'M2'],
      M2: ['M1', 'M3'],
      M3: ['M2', 'M4'],
      M4: ['M3', 'D'],
      D: ['M4']
    }
    const clusterMap = { H: 'H', M1: 'M1', M2: 'M2', M3: 'M3', M4: 'M4', D: 'D' }

    function buildHubResult(hubId: string, jumpRange: number, unassigned: string[]): AutoGroupResult {
      const baseGroup = buildResult().groups[0]!
      return {
        groups: [
          {
            ...baseGroup,
            id: hubId,
            name: `Group ${hubId}`,
            sectorMacro: hubId,
            jumpRange,
            originalJumpRange: jumpRange
          }
        ],
        assignments: unassigned.map((sectorMacro) => ({
          sectorMacro,
          status: 'uncertain_extend' as const,
          displayBucket: 'unresolved' as const,
          selectedOptionIndex: null,
          options: [
            { type: 'standalone' as const, distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        })),
        bridgePlans: [],
        playerSectorMacros: [hubId, ...unassigned]
      }
    }

    it('recalculates affected sector options when jumpRange increases', () => {
      const result = buildHubResult('H', 3, ['D'])
      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H', 5, graph, clusterMap
      )

      const dAssignment = updated.assignments.find((a) => a.sectorMacro === 'D')!
      const hOpt = dAssignment.options.find((o) => o.targetGroupId === 'H')
      expect(hOpt).toBeTruthy()
      expect(hOpt!.extendsRange).toBe(false)
    })

    it('switches selection to hub when it becomes range hit and was previously selected as extension', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H', sectorMacro: 'H', jumpRange: 3, originalJumpRange: 3 }
        ],
        assignments: [
          {
            sectorMacro: 'D',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H', distance: 5, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H', 'D']
      }

      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H', 5, graph, clusterMap
      )

      const dAssignment = updated.assignments.find((a) => a.sectorMacro === 'D')!
      const hOpt = dAssignment.options.find((o) => o.targetGroupId === 'H')!
      expect(hOpt.extendsRange).toBe(false)
      expect(dAssignment.selectedOptionIndex).toBe(dAssignment.options.indexOf(hOpt))
      expect(dAssignment.status).toBe('auto')
    })

    it('keeps selection unchanged in edit mode when jumpRange increase makes hub a range hit', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H', sectorMacro: 'H', jumpRange: 3, originalJumpRange: 3 }
        ],
        assignments: [
          {
            sectorMacro: 'D',
            status: 'uncertain_extend',
            displayBucket: 'unresolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H', distance: 5, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H', 'D']
      }

      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H', 5, graph, clusterMap, undefined, false
      )

      const dAssignment = updated.assignments.find((a) => a.sectorMacro === 'D')!
      const hOpt = dAssignment.options.find((o) => o.targetGroupId === 'H')!
      expect(hOpt.extendsRange).toBe(false)
      expect(dAssignment.selectedOptionIndex).toBe(0)
      expect(dAssignment.status).toBe('uncertain_extend')
    })

    it('keeps selection when hub becomes range hit but is not better than current', () => {
      const baseGroup = buildResult().groups[0]!
      const multiGraph = {
        H1: ['T'],
        H2: ['M1'],
        M1: ['H2', 'M2'],
        M2: ['M1', 'T'],
        T: ['H1', 'M2']
      }
      const multiCluster = { H1: 'H1', H2: 'H2', M1: 'M1', M2: 'M2', T: 'T' }
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 3, originalJumpRange: 3 },
          { ...baseGroup, id: 'H2', sectorMacro: 'H2', jumpRange: 3, originalJumpRange: 3 }
        ],
        assignments: [
          {
            sectorMacro: 'T',
            status: 'auto',
            displayBucket: 'resolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 1, extendsRange: false, resultingGroupSize: 2 },
              { type: 'absorb', targetGroupId: 'H2', distance: 3, extendsRange: true, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'H2', 'T']
      }

      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H2', 4, multiGraph, multiCluster
      )

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const h1Opt = tAssignment.options.find((o) => o.targetGroupId === 'H1')!
      expect(tAssignment.selectedOptionIndex).toBe(tAssignment.options.indexOf(h1Opt))
      expect(tAssignment.status).toBe('auto')
    })

    it('recalculates affected sector options when jumpRange decreases', () => {
      const result = buildHubResult('H', 5, ['D'])
      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H', 3, graph, clusterMap
      )

      const dAssignment = updated.assignments.find((a) => a.sectorMacro === 'D')!
      const hOpt = dAssignment.options.find((o) => o.targetGroupId === 'H')
      expect(hOpt).toBeTruthy()
      expect(hOpt!.extendsRange).toBe(true)
    })

    it('downgrades selection when hub becomes extension and no other range hit exists', () => {
      const baseGroup = buildResult().groups[0]!
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H', sectorMacro: 'H', jumpRange: 5, originalJumpRange: 5 }
        ],
        assignments: [
          {
            sectorMacro: 'D',
            status: 'auto',
            displayBucket: 'resolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H', distance: 5, extendsRange: false, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H', 'D']
      }

      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H', 3, graph, clusterMap
      )

      const dAssignment = updated.assignments.find((a) => a.sectorMacro === 'D')!
      expect(dAssignment.selectedOptionIndex).toBeNull()
      expect(dAssignment.status).toBe('uncertain_extend')
    })

    it('switches to best remaining range hit when selected hub becomes extension', () => {
      const baseGroup = buildResult().groups[0]!
      const multiGraph = {
        H1: ['M1'],
        H2: ['M1'],
        M1: ['H1', 'H2', 'M2'],
        M2: ['M1', 'T'],
        T: ['M2']
      }
      const multiCluster = { H1: 'H1', H2: 'H2', M1: 'M1', M2: 'M2', T: 'T' }
      const result: AutoGroupResult = {
        groups: [
          { ...baseGroup, id: 'H1', sectorMacro: 'H1', jumpRange: 5, originalJumpRange: 5 },
          { ...baseGroup, id: 'H2', sectorMacro: 'H2', jumpRange: 5, originalJumpRange: 5 }
        ],
        assignments: [
          {
            sectorMacro: 'T',
            status: 'auto',
            displayBucket: 'resolved',
            selectedOptionIndex: 0,
            options: [
              { type: 'absorb', targetGroupId: 'H1', distance: 3, extendsRange: false, resultingGroupSize: 2 },
              { type: 'absorb', targetGroupId: 'H2', distance: 4, extendsRange: false, resultingGroupSize: 2 },
              { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
            ]
          }
        ],
        bridgePlans: [],
        playerSectorMacros: ['H1', 'H2', 'T']
      }

      const updated = rebuildAssignmentsForJumpRangeChange(
        result, 'H1', 2, multiGraph, multiCluster
      )

      const tAssignment = updated.assignments.find((a) => a.sectorMacro === 'T')!
      const h2Opt = tAssignment.options.find((o) => o.targetGroupId === 'H2')!
      expect(tAssignment.selectedOptionIndex).toBe(tAssignment.options.indexOf(h2Opt))
      expect(tAssignment.status).toBe('auto')
    })
  })

  describe('preserveEditAssignmentSelections', () => {
    it('clears selectedOptionIndex when the selected hub option was removed', () => {
      const previous: AutoGroupResult['assignments'] = [
        {
          sectorMacro: 'T',
          status: 'auto',
          displayBucket: 'resolved',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'H1', distance: 1, extendsRange: false, resultingGroupSize: 2 },
            { type: 'absorb', targetGroupId: 'H2', distance: 2, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ]
      const next: AutoGroupResult['assignments'] = [
        {
          sectorMacro: 'T',
          status: 'auto',
          displayBucket: 'resolved',
          selectedOptionIndex: 0,
          options: [
            { type: 'absorb', targetGroupId: 'H2', distance: 2, extendsRange: false, resultingGroupSize: 2 },
            { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
          ]
        }
      ]

      const [updated] = preserveEditAssignmentSelections(previous, next)

      expect(updated!.selectedOptionIndex).toBeNull()
    })
  })

  describe('sectorStationCandidates precomputation', () => {
    const stationGraph = {
      H: ['T'],
      T: ['H']
    }
    const stationCluster = { H: 'H', T: 'T' }

    it('precomputes station candidates for all player sectors in groupCleanSlate', () => {
      const archive = buildArchiveWithStations(['H', 'T'])
      const result = groupCleanSlate(archive, modulesByMacroId, stationGraph, stationCluster)

      expect(result.sectorStationCandidates).toBeTruthy()
      expect(result.sectorStationCandidates!['H']).toBeTruthy()
      expect(result.sectorStationCandidates!['H']!.length).toBeGreaterThan(0)
      expect(result.sectorStationCandidates!['T']).toBeTruthy()
      expect(result.sectorStationCandidates!['T']!.length).toBeGreaterThan(0)
    })

    it('station candidates are sorted by score descending', () => {
      const archive = buildArchiveWithStations(['H'])
      const result = groupCleanSlate(archive, modulesByMacroId, stationGraph, stationCluster)

      const candidates = result.sectorStationCandidates!['H']!
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i]!.score).toBeLessThanOrEqual(candidates[i - 1]!.score)
      }
    })

    it('sectorStationCandidates contains stationCode and containerCap for each candidate', () => {
      const archive = buildArchiveWithStations(['H'])
      const result = groupCleanSlate(archive, modulesByMacroId, stationGraph, stationCluster)

      const candidates = result.sectorStationCandidates!['H']!
      for (const c of candidates) {
        expect(c.stationCode).toBeTruthy()
        expect(typeof c.containerCap).toBe('number')
      }
    })
  })
})
