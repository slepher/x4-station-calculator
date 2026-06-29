import { describe, expect, it } from 'vitest'
import {
  applyAbsorbToResult,
  applyStandaloneToResult,
  groupIncremental,
  setGroupPinnedInResult,
  sortAssignmentsForDisplay,
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

  it('does not add duplicate hub groups when standalone is selected repeatedly', () => {
    const first = applyStandaloneToResult(buildResult(), 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)
    const second = applyStandaloneToResult(first, 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)

    expect(second).toBe(first)
    expect(second.groups.filter((group) => group.sectorMacro === 'B')).toHaveLength(1)
  })

  it('marks absorb selection as auto without moving its display bucket', () => {
    const updated = applyAbsorbToResult(buildResult(), 'B', 0, sectorGraph, sectorClusterMap, 1)
    const assignment = updated.assignments.find((a) => a.sectorMacro === 'B')!

    expect(assignment.selectedOptionIndex).toBe(0)
    expect(assignment.status).toBe('auto')
    expect(assignment.displayBucket).toBe('unresolved')
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
})
