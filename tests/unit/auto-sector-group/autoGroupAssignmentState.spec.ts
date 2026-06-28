import { describe, expect, it } from 'vitest'
import {
  applyAbsorbToResult,
  applyStandaloneToResult,
  setGroupPinnedInResult,
  type AutoGroupResult
} from '@/store/logic/autoGroup'

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

describe('autoGroup assignment state after user selection', () => {
  it('marks standalone selection as standalone without moving its display bucket', () => {
    const updated = applyStandaloneToResult(buildResult(), 'B', sectorGraph, sectorClusterMap, 1, (macro) => macro)
    const assignment = updated.assignments.find((a) => a.sectorMacro === 'B')!

    expect(assignment.selectedOptionIndex).toBe(1)
    expect(assignment.status).toBe('standalone')
    expect(assignment.displayBucket).toBe('unresolved')
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
