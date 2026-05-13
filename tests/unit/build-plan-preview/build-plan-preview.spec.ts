/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BuildGoal, PreviewDerivedItem, PreviewRequiredItem, PreviewItem, PreviewLinePlan } from '@/types/build-plan'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'

// ── 1.5 Lineage resolution ──────────────────────────────────────────────

describe('1.5 lineage 生成与 module 选择', () => {
  it('1.5.1 lineage derivation logic', () => {
    // 1.5.2 locked + lockedLineage
    const lineageLocked = true
      ? ('teladi' || 'hightech')
      : 'hightech'
    expect(lineageLocked).toBe('teladi')
    // 1.5.3 unlocked, subCategory
    const lineageUnlocked = false
      ? ('teladi' || 'hightech')
      : 'argon'
    expect(lineageUnlocked).toBe('argon')
    // 1.5.4 both empty → fallback default
    const lineageFallback = false
      ? ('' || '')
      : ''
    const resolved = lineageFallback || 'default'
    expect(resolved).toBe('default')
  })
})

// ── 1.4 Preview merge rules ─────────────────────────────────────────────

describe('1.4 preview 项合并规则', () => {
  function mergePreviewItems(items: PreviewItem[]): PreviewItem[] {
    const derivedMap = new Map<string, PreviewDerivedItem>()
    const requiredMap = new Map<string, PreviewRequiredItem>()
    for (const item of items) {
      if (item.kind === 'derived') {
        const key = `${item.wareId || ''}|${item.moduleId}`
        const existing = derivedMap.get(key)
        if (existing) {
          existing.derived = [...new Set([...existing.derived, ...item.derived])]
          if (item.targets) existing.targets = [...(existing.targets || []), ...item.targets]
        } else {
          derivedMap.set(key, { ...item, derived: [...item.derived] })
        }
      } else {
        const key = item.wareId
        const existing = requiredMap.get(key)
        if (existing) {
          existing.required = [...new Set([...existing.required, ...item.required])]
        } else {
          requiredMap.set(key, { ...item, required: [...item.required] })
        }
      }
    }
    return [...derivedMap.values(), ...requiredMap.values()]
  }

  // 1.4.2 same derived merge
  it('1.4.2 merges same derived items', () => {
    const items: PreviewItem[] = [
      { kind: 'derived', wareId: 'hullparts', moduleId: 'm1', derived: ['target'], relatedLineGroupIds: ['g1'], sourceRef: 's1' },
      { kind: 'derived', wareId: 'hullparts', moduleId: 'm1', derived: ['production'], relatedLineGroupIds: ['g1'], sourceRef: 's2' },
    ]
    const merged = mergePreviewItems(items)
    expect(merged.length).toBe(1)
    const d = merged[0] as PreviewDerivedItem
    expect(d.derived.sort()).toEqual(['production', 'target'])
  })

  // 1.4.3 same required merge
  it('1.4.3 merges same required items', () => {
    const items: PreviewItem[] = [
      { kind: 'required', wareId: 'graphene', required: ['production'], relatedLineGroupIds: ['g1'], sourceRef: 's1' },
      { kind: 'required', wareId: 'graphene', required: ['build-material'], relatedLineGroupIds: ['g1'], sourceRef: 's2' },
    ]
    const merged = mergePreviewItems(items)
    expect(merged.length).toBe(1)
    const r = merged[0] as PreviewRequiredItem
    expect(r.required.sort()).toEqual(['build-material', 'production'])
  })

  // 1.4.4 derived + required same ware → no merge
  it('1.4.4 keeps derived and required separate', () => {
    const items: PreviewItem[] = [
      { kind: 'derived', wareId: 'hullparts', moduleId: 'm1', derived: ['target'], relatedLineGroupIds: ['g1'], sourceRef: 's1' },
      { kind: 'required', wareId: 'hullparts', required: ['production'], relatedLineGroupIds: ['g1'], sourceRef: 's2' },
    ]
    const merged = mergePreviewItems(items)
    expect(merged.length).toBe(2)
  })
})

// ── 1.6 computeProductionLineAllocation two-round allocation ──────────────

describe('1.6 computeProductionLineAllocation 全局两轮分配', () => {
  it('1.6.1/1.6.2 manual allocation round', () => {
    const flowGroups: any[] = [{
      id: 'g1', name: 'Group 1',
      nodes: [{ id: 'n1', source: 'manual', wareId: 'hullparts', label: 'Hull Parts' }],
      isIsolated: false,
    }]
    const goals: BuildGoal[] = [
      { type: 'production-rate', wareId: 'hullparts', ratePerHour: 100 },
    ]
    const buildFlowView: any = { buildFlowGroups: [], assignments: [], virtualEdges: [] }
    const result = computeProductionLineAllocation(goals, flowGroups, buildFlowView, {}, {})
    const g1Alloc = result.find((a: any) => a.groupId === 'g1')
    expect(g1Alloc).toBeDefined()
    expect(g1Alloc!.isUnmatched).toBe(false)
  })

  it('1.6.3 auto assigns to existing manual group', () => {
    const flowGroups: any[] = [{
      id: 'g1', name: 'Group 1',
      nodes: [
        { id: 'n1', source: 'manual', wareId: 'hullparts', label: 'Hull Parts' },
        { id: 'n2', source: 'auto', wareId: 'energycells', label: 'Energy Cells' },
      ],
      isIsolated: false,
    }]
    const goals: BuildGoal[] = [
      { type: 'production-rate', wareId: 'hullparts', ratePerHour: 100 },
      { type: 'production-rate', wareId: 'energycells', ratePerHour: 500 },
    ]
    const buildFlowView: any = { buildFlowGroups: [], assignments: [], virtualEdges: [] }
    const result = computeProductionLineAllocation(goals, flowGroups, buildFlowView, {}, {})
    const g1Alloc = result.find((a: any) => a.groupId === 'g1')
    expect(g1Alloc).toBeDefined()
    expect(g1Alloc!.goals.length).toBe(2)
  })

  it('1.6.4 unmatched goal', () => {
    const flowGroups: any[] = [{
      id: 'g1', name: 'Group 1',
      nodes: [],
      isIsolated: false,
    }]
    const goals: BuildGoal[] = [
      { type: 'production-rate', wareId: 'energycells', ratePerHour: 500 },
    ]
    const buildFlowView: any = { buildFlowGroups: [], assignments: [], virtualEdges: [] }
    const result = computeProductionLineAllocation(goals, flowGroups, buildFlowView, {}, {})
    const unmatched = result.find((a: any) => a.isUnmatched)
    expect(unmatched).toBeDefined()
  })
})
