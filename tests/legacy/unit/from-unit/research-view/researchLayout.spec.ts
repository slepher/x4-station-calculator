import { describe, expect, it } from 'vitest'
import {
  buildResearchLayoutGroups,
  getNodeConnectionSides,
  makeOrthogonalEdgePath,
  resolveEdgePointsInContainer,
} from '@/components/empire/researchLayout'
import type { X4ResearchItem } from '@/types/x4'

function makeResearchItem(overrides: Partial<X4ResearchItem> & { id: string }): X4ResearchItem {
  return {
    id: overrides.id,
    name: overrides.id,
    nameId: overrides.nameId || overrides.id,
    descriptionId: overrides.descriptionId || '',
    dlcTag: overrides.dlcTag || 'base',
    tags: overrides.tags || ['research'],
    category: overrides.category || 'default',
    researchTime: overrides.researchTime ?? 600,
    cost: overrides.cost || {},
    dependencies: overrides.dependencies || [],
    unlock: overrides.unlock,
    description: overrides.description || '',
  }
}

describe('research layout', () => {
  it('renders station module dependencies as stable edge rows', () => {
    const items = [
      makeResearchItem({ id: 'research_module_dock' }),
      makeResearchItem({ id: 'research_module_production' }),
      makeResearchItem({ id: 'research_module_storage' }),
      makeResearchItem({
        id: 'research_module_defence',
        dependencies: ['research_module_dock', 'research_module_production', 'research_module_storage'],
      }),
      makeResearchItem({
        id: 'research_module_habitation',
        dependencies: ['research_module_dock', 'research_module_production', 'research_module_storage'],
      }),
      makeResearchItem({
        id: 'research_module_build',
        dependencies: ['research_module_defence', 'research_module_habitation'],
      }),
      makeResearchItem({ id: 'research_module_welfare_1' }),
      makeResearchItem({
        id: 'research_module_welfare_2',
        dependencies: ['research_module_welfare_1', 'research_module_welfare_2_pre'],
      }),
      makeResearchItem({ id: 'research_module_venture' }),
    ]

    const stationModules = buildResearchLayoutGroups(items).find(group => group.id === 'station_modules')

    expect(stationModules?.rows).toHaveLength(3)
    expect(stationModules?.rows[0].id).toBe('blueprint_hack')
    expect(stationModules?.rows[0].edges).toEqual([
      ['research_module_dock', 'research_module_defence'],
      ['research_module_production', 'research_module_defence'],
      ['research_module_storage', 'research_module_defence'],
      ['research_module_dock', 'research_module_habitation'],
      ['research_module_production', 'research_module_habitation'],
      ['research_module_storage', 'research_module_habitation'],
      ['research_module_defence', 'research_module_build'],
      ['research_module_habitation', 'research_module_build'],
    ])
    expect(stationModules?.rows[0].nodes.map(node => [node.id, node.layer])).toEqual([
      ['research_module_dock', 0],
      ['research_module_production', 0],
      ['research_module_storage', 0],
      ['research_module_defence', 1],
      ['research_module_habitation', 1],
      ['research_module_build', 2],
    ])

    expect(stationModules?.rows[1].id).toBe('welfare')
    expect(stationModules?.rows[1].edges).toEqual([
      ['research_module_welfare_1', 'research_module_welfare_2'],
    ])
    expect(stationModules?.rows[1].nodes.map(node => [node.id, node.layer])).toEqual([
      ['research_module_welfare_1', 0],
      ['research_module_welfare_2', 1],
    ])

    expect(stationModules?.rows[2].id).toBe('standalone')
    expect(stationModules?.rows[2].edges).toEqual([])
    expect(stationModules?.rows[2].nodes.map(node => node.id)).toEqual(['research_module_venture'])
  })

  it('marks only the connected sides of each node', () => {
    const row = {
      id: 'chain',
      nodes: [
        { id: 'source', layer: 0 },
        { id: 'middle', layer: 1 },
        { id: 'target', layer: 2 },
        { id: 'standalone', layer: 0 },
      ],
      edges: [
        ['source', 'middle'],
        ['middle', 'target'],
      ] as [string, string][],
    }

    expect(getNodeConnectionSides(row, 'source')).toEqual({ incoming: false, outgoing: true })
    expect(getNodeConnectionSides(row, 'middle')).toEqual({ incoming: true, outgoing: true })
    expect(getNodeConnectionSides(row, 'target')).toEqual({ incoming: true, outgoing: false })
    expect(getNodeConnectionSides(row, 'standalone')).toEqual({ incoming: false, outgoing: false })
  })

  it('routes edge paths through a column gap instead of drawing a diagonal', () => {
    expect(makeOrthogonalEdgePath({
      x1: 220,
      y1: 90,
      x2: 500,
      y2: 210,
    })).toBe('M 220 90 H 360 V 210 H 500')
  })

  it('resolves edge points in a shared row coordinate system', () => {
    expect(resolveEdgePointsInContainer(
      { left: 100, top: 50 },
      { left: 120, top: 80, width: 200, height: 90 },
      { left: 500, top: 170, width: 220, height: 120 },
      { scrollLeft: 30, scrollTop: 10 },
    )).toEqual({
      x1: 250,
      y1: 85,
      x2: 430,
      y2: 190,
    })
  })
})
