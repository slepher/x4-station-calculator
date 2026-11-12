// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { loadShipTestFixture } from './ship-test-fixture'

const shipId = 'ship_ter_l_destroyer_01_a'
function setup() {
  const store = useShipBuildStore()
  store.setSelectedShipId(shipId)
  store.saveAsBlueprint('A')
  return store
}

describe('independent comparison plans', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); loadShipTestFixture() })

  it('opens a clean empty B without changing dirty A or its save target', () => {
    const store = setup()
    store.blueprint!.name = 'edited A'
    const original = JSON.stringify(store.blueprint)
    expect(store.openComparison()).toBe(true)
    expect(JSON.stringify(store.blueprint)).toBe(original)
    expect(store.isPlanDirty('A')).toBe(true)
    expect(store.getPlan('B')!.blueprint).toMatchObject({ shipId, connections: [] })
    expect(store.isPlanDirty('B')).toBe(false)
    expect(store.planRequiresSaveAs('B')).toBe(true)
    expect(store.getPlan('B')!.blueprint!.storage).not.toBe(store.blueprint!.storage)
  })

  it('selects by createdAt then ID, excludes A, and rejects explicitly loading A', () => {
    const store = setup()
    const a = store.blueprint!.id
    const bucket = store.savedBlueprints.ships[0]!
    bucket.blueprints.push(...['z', 'b', 'c'].map((id, i) => ({
      ...JSON.parse(JSON.stringify(store.blueprint)), id, createdAt: i === 0 ? 1 : 2,
      lastUpdated: i === 0 ? 999 : 1
    })))
    store.openComparison()
    expect(store.getPlan('B')!.saveTargetId).toBe('b')
    expect(store.isPlanDirty('B')).toBe(false)
    expect(store.planRequiresSaveAs('B')).toBe(false)
    const b = store.getPlan('B')
    expect(store.replaceComparisonBlueprint(a)).toBe(false)
    expect(store.getPlan('B')).toBe(b)
    expect(b!.blueprint).not.toBe(bucket.blueprints.find(bp => bp.id === 'b'))
  })

  it('saves only the specified side and preserves work and baseline on storage failure', () => {
    const store = setup()
    store.openComparison()
    store.blueprint!.name = 'dirty A'
    store.getPlan('B')!.blueprint!.name = 'dirty B'
    const before = JSON.stringify(store.getPlan('B'))
    const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(store.savePlan('B', 'B')).toBe('failed')
    expect(JSON.stringify(store.getPlan('B'))).toBe(before)
    fail.mockRestore()
    expect(store.savePlan('B', 'B')).toBe('saved')
    expect(store.isPlanDirty('A')).toBe(true)
    expect(store.isPlanDirty('B')).toBe(false)
    expect(store.savedBlueprints.activeBlueprintId).toBe(store.getPlan('B')!.saveTargetId)
    expect(store.getPlan('B')!.blueprint).not.toBe(store.findBlueprintById(store.getPlan('B')!.saveTargetId!))
  })

  it('promotes the complete B context and refuses absent B operations', () => {
    const store = setup()
    expect(store.savePlan('B')).toBe('invalid')
    store.openComparison()
    store.getPlan('B')!.blueprint!.name = 'unsaved B'
    const b = JSON.stringify(store.getPlan('B'))
    expect(store.closeComparison('B')).toBe(true)
    expect(JSON.stringify(store.getPlan('A'))).toBe(b)
    expect(store.isPlanDirty('A')).toBe(true)
    expect(store.getPlan('B')).toBeNull()
  })

  it('previews B group and attached shields against B hull without changing either side', () => {
    const store = setup()
    store.openComparison()
    const bShip = 'ship_ter_m_corvette_02_a'
    store.replaceComparisonShip(bShip)
    const rows = store.getConnectionRows(store.findShip(bShip))
    const engines = rows.filter(row => row.slotType === 'engine')
    const keys = engines.map(row => row.connectionKey)
    const before = JSON.stringify([store.getPlan('A'), store.getPlan('B'), store.savedBlueprints])
    const preview = store.buildPreviewBlueprint({ connectionKeys: keys, equipmentId: 'engine_ter_m_allround_01_mk1', mode: 'group', targetCount: 1 }, 'B')!
    expect(preview.shipId).toBe(bShip)
    expect(preview.connections.flatMap(c => c.group).reduce((sum, g) => sum + g.count, 0)).toBe(1)
    expect(JSON.stringify([store.getPlan('A'), store.getPlan('B'), store.savedBlueprints])).toBe(before)
    store.applyTargetAssignment({ connectionKeys: keys, equipmentId: 'engine_ter_m_allround_01_mk1', mode: 'group', targetCount: 1 }, 'B')
    expect(store.isPlanDirty('A')).toBe(false)
    expect(store.isPlanDirty('B')).toBe(true)
    expect(store.buildPreviewBlueprint({ connectionKeys: keys, equipmentId: null, mode: 'connection' }, 'A')).toBeNull()
    const hull = store.getPlanStats(preview).find(row => row.key === 'hull')!
    expect(hull.value).toBe(store.findShip(bShip)!.hull)
    const aHull = store.getPlanStats(store.blueprint).find(row => row.key === 'hull')!
    expect(aHull.value).toBe(store.findShip(shipId)!.hull)
  })

  it('does not reset B when its current hull is selected and does not overwrite a deleted target', () => {
    const store = setup()
    store.openComparison()
    store.savePlan('B', 'B')
    const b = store.getPlan('B')!
    b.blueprint!.name = 'edited B'
    store.replaceComparisonShip(shipId)
    expect(store.getPlan('B')).toBe(b)
    const before = JSON.stringify(b)
    store.deleteBlueprint(b.saveTargetId!)
    expect(JSON.stringify(b)).toBe(before)
    expect(store.findBlueprintById(b.saveTargetId!)).not.toBeNull()
    const connections = JSON.stringify(b.blueprint!.connections)
    store.deleteBlueprint(b.saveTargetId!, 'B')
    expect(b.blueprint!.name).toBe('')
    expect(b.blueprint!.id).toBe('')
    expect(b.saveTargetId).toBeNull()
    expect(JSON.stringify(b.blueprint!.connections)).toBe(connections)
    expect(store.isPlanDirty('B')).toBe(true)
    expect(store.getPlanStatusLabel('B')).toBe('Custom')
    expect(store.planRequiresSaveAs('B')).toBe(true)
    expect(store.savePlan('B')).toBe('needs-name')
    expect(store.findBlueprintById(store.getPlan('A')!.saveTargetId!)!.name).toBe('A')
  })

  it('allows deleting the current A with an unsaved B and leaves B untouched', () => {
    const store = setup()
    store.openComparison()
    const beforeB = JSON.stringify(store.getPlan('B'))
    const id = store.getPlan('A')!.saveTargetId!
    store.deleteBlueprint(id, 'A')
    expect(store.findBlueprintById(id)).toBeNull()
    expect(store.getPlan('A')!.saveTargetId).toBeNull()
    expect(store.getPlanStatusLabel('A')).toBe('Custom')
    expect(store.isPlanDirty('A')).toBe(true)
    expect(JSON.stringify(store.getPlan('B'))).toBe(beforeB)
  })
})
