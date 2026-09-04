import { describe, it, expect } from 'vitest'
import { generateFilteredWaresGrouped } from '@/store/logic/searchWare'
import type { LocalizedX4Ware, LocalizedX4ModuleGroup, WareGroupResult } from '@/types/x4'

function makeWare(overrides: Partial<LocalizedX4Ware> & { id: string }): LocalizedX4Ware {
  return {
    name: overrides.id,
    nameId: '',
    dlc_tag: 'base',
    transport: 'container',
    volume: 1,
    price: 100,
    minPrice: 50,
    maxPrice: 200,
    tier: 1,
    group: 'hightech',
    localeName: overrides.id,
    ...overrides
  }
}

function makeGroup(id: string, name: string, type: string = 'production'): LocalizedX4ModuleGroup {
  return {
    id,
    name,
    type,
    color_rgb: '255,255,255',
    localeName: name
  } as LocalizedX4ModuleGroup
}

describe('generateFilteredWaresGrouped', () => {
  const groupsMap: Record<string, LocalizedX4ModuleGroup> = {
    hightech: makeGroup('hightech', 'High Tech'),
    shiptech: makeGroup('shiptech', 'Ship Tech'),
    refined: makeGroup('refined', 'Refined'),
    energy: makeGroup('energy', 'Energy'),
    minerals: makeGroup('minerals', 'Minerals', 'processingmodule')
  }

  const waresMap: Record<string, LocalizedX4Ware> = {
    claytronics: makeWare({ id: 'claytronics', group: 'hightech', localeName: 'Claytronics' }),
    hullparts: makeWare({ id: 'hullparts', group: 'refined', localeName: 'Hull Parts' }),
    energycells: makeWare({ id: 'energycells', group: 'energy', localeName: 'Energy Cells' }),
    missilecomponents: makeWare({ id: 'missilecomponents', group: 'shiptech', localeName: 'Missile Components' }),
    ore: makeWare({ id: 'ore', group: 'minerals', transport: 'solid', localeName: 'Ore' }),
    silicon: makeWare({ id: 'silicon', group: 'minerals', transport: 'solid', localeName: 'Silicon' }),
    plasmaconductors: makeWare({ id: 'plasmaconductors', group: 'hightech', localeName: 'Plasma Conductors' })
  }

  it('returns all wares grouped by their group when query is empty', () => {
    const result = generateFilteredWaresGrouped('', 'en', waresMap, groupsMap)

    expect(result.length).toBeGreaterThan(0)
    const allWares = result.flatMap(g => g.wares)
    expect(allWares.length).toBe(Object.keys(waresMap).length)
  })

  it('filters wares by localeName in EN mode', () => {
    const result = generateFilteredWaresGrouped('hull', 'en', waresMap, groupsMap)

    expect(result.length).toBeGreaterThan(0)
    const allWares = result.flatMap(g => g.wares)
    expect(allWares.some(w => w.id === 'hullparts')).toBe(true)
  })

  it('filters wares by id in EN mode', () => {
    const result = generateFilteredWaresGrouped('missile', 'en', waresMap, groupsMap)

    const allWares = result.flatMap(g => g.wares)
    expect(allWares.some(w => w.id === 'missilecomponents')).toBe(true)
  })

  it('filters wares by localeName in non-EN mode', () => {
    const zhWaresMap: Record<string, LocalizedX4Ware> = {
      ...waresMap,
      hullparts: makeWare({ id: 'hullparts', group: 'refined', localeName: '船体部件' })
    }

    const result = generateFilteredWaresGrouped('船体', 'zh-CN', zhWaresMap, groupsMap)

    const allWares = result.flatMap(g => g.wares)
    expect(allWares.some(w => w.id === 'hullparts')).toBe(true)
  })

  it('includes group header displayLabel from localizedModuleGroupsMap', () => {
    const result = generateFilteredWaresGrouped('', 'en', waresMap, groupsMap)

    const hightechGroup = result.find(g => g.group === 'hightech')
    expect(hightechGroup).toBeDefined()
    expect(hightechGroup!.displayLabel).toBe('High Tech')
  })

  it('each ware has displayLabel and moduleGroup', () => {
    const result = generateFilteredWaresGrouped('', 'en', waresMap, groupsMap)

    for (const group of result) {
      for (const ware of group.wares) {
        expect(ware.displayLabel).toBeTruthy()
        expect(ware.moduleGroup).toBeDefined()
      }
    }
  })

  it('sorts groups by type priority then group priority', () => {
    const result = generateFilteredWaresGrouped('', 'en', waresMap, groupsMap)

    const groupOrder = result.map(g => g.group)
    expect(groupOrder.indexOf('shiptech')).toBeLessThan(groupOrder.indexOf('minerals'))
  })

  it('shows group name in displayLabel when matched by group but not by ware name', () => {
    const result = generateFilteredWaresGrouped('High Tech', 'en', waresMap, groupsMap)

    const hightechGroup = result.find(g => g.group === 'hightech')
    expect(hightechGroup).toBeDefined()
    expect(hightechGroup!.wares.length).toBe(2)
  })

  it('can filter with includeWare callback', () => {
    const result = generateFilteredWaresGrouped('', 'en', waresMap, groupsMap, (w) => w.transport !== 'solid')

    const allWares = result.flatMap(g => g.wares)
    expect(allWares.some(w => w.id === 'ore')).toBe(false)
    expect(allWares.some(w => w.id === 'silicon')).toBe(false)
  })
})
