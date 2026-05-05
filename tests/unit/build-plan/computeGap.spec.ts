import { describe, it, expect } from 'vitest'
import type { X4Module } from '@/types/x4'
import type { ProductionLineAllocation } from '@/types/build-plan'

describe('computeGap', () => {
  it('returns empty gap when no required-production goals', async () => {
    const { computeGap } = await import('@/store/logic/computeGap')
    const gap = computeGap([], {})
    expect(gap).toEqual({})
  })

  it('accumulates inputs from build-module goals for required-production ware', async () => {
    const modulesMap: Record<string, X4Module> = {
      mod_claytronics: {
        id: 'mod_claytronics',
        macroId: 'macro_claytronics',
        name: 'Claytronics Fab',
        inputs: { quantumtubes: 8, energycells: 600 },
        outputs: { claytronics: 1 },
        cycleTime: 60,
        buildTime: 600,
        workforce: { max: 100, perModule: 10, race: 'argon' },
        type: 'production', method: 'default',
        isPlayerBlueprint: true, group: 'hightech', race: 'argon',
        dockingCount: 0, color: '#FF0000', color_rgb: '#FF0000', tier: 1,
      },
    }

    const allocations: ProductionLineAllocation[] = [{
      groupId: 'g1', groupName: '电子黏土', isUnmatched: false,
      goals: [
        { type: 'build-module', moduleId: 'mod_claytronics', count: 2 },
        { type: 'required-production', wareId: 'quantumtubes', ratePerHour: 0 },
      ],
    }]

    const { computeGap } = await import('@/store/logic/computeGap')
    const gap = computeGap(allocations, modulesMap)

    // 2 modules × 8 quantumtubes/cycle ÷ 60s × 3600s/h = 960/h
    expect(gap.quantumtubes).toBeCloseTo(960)
  })
})
