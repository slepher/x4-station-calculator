import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createSaveBindingActions } from '@/store/logic/saveBindingActions'

describe('saveBindingActions connected sector groups', () => {
  it('stores connected sector groups symmetrically', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [
        { id: 'a', name: 'A', order: 0 },
        { id: 'b', name: 'B', order: 1 }
      ],
      stations: [],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            { sectorGroupId: 'a', jumpRange: 2, coverageSectorMacros: [], stationBindings: [] },
            { sectorGroupId: 'b', jumpRange: 2, coverageSectorMacros: [], stationBindings: [] }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.setGroupConnection('g-1', 'a', 'b', true)

    const bindingA = actions.getGroupBinding('g-1', 'a')
    const bindingB = actions.getGroupBinding('g-1', 'b')

    expect(bindingA?.connectedSectorGroupIds).toEqual(['b'])
    expect(bindingB?.connectedSectorGroupIds).toEqual(['a'])
  })

  it('removes mirrored connections when a group binding is cleared', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [
        { id: 'a', name: 'A', order: 0 },
        { id: 'b', name: 'B', order: 1 }
      ],
      stations: [],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            { sectorGroupId: 'a', jumpRange: 2, coverageSectorMacros: [], stationBindings: [], connectedSectorGroupIds: ['b'] },
            { sectorGroupId: 'b', jumpRange: 2, coverageSectorMacros: [], stationBindings: [], connectedSectorGroupIds: ['a'] }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.clearSectorGroupBinding('g-1', 'a')

    const bindingB = actions.getGroupBinding('g-1', 'b')
    expect(bindingB?.connectedSectorGroupIds || []).toEqual([])
  })
})
