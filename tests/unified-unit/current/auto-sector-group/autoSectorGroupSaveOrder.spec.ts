/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'

function draftGroup(sectorMacro: string): GroupDraftInfo {
  return {
    id: sectorMacro,
    name: sectorMacro,
    sectorMacro,
    jumpRange: 2,
    originalJumpRange: 2,
    coverageSectorMacros: [sectorMacro],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true
  }
}

describe('auto sector group save order', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('persists reordered draft groups through createAutoGroups', () => {
    const gameGuid = 'game-1'
    const activeViewStore = useActiveViewStore()
    activeViewStore.switchToBinding(gameGuid)

    const saveBindingStore = useSaveBindingStore()
    saveBindingStore.loadData({
      vsn: 2,
      list: [
        {
          gameGuid,
          selectedArchiveTime: null,
          groups: [
            { name: 'A', order: 0, sectorMacro: 'A', jumpRange: 2, coverageSectorMacros: [{ ref: 'A', jump: 0 }], connectedGroupIds: [] },
            { name: 'B', order: 1, sectorMacro: 'B', jumpRange: 2, coverageSectorMacros: [{ ref: 'B', jump: 0 }], connectedGroupIds: [] },
            { name: 'C', order: 2, sectorMacro: 'C', jumpRange: 2, coverageSectorMacros: [{ ref: 'C', jump: 0 }], connectedGroupIds: [] }
          ],
          stationPlans: [],
          updatedAt: 1
        }
      ]
    })

    saveBindingStore.createAutoGroups(
      gameGuid,
      [draftGroup('B'), draftGroup('A'), draftGroup('C')],
      {},
      {},
      undefined,
      undefined,
      undefined,
      { A: { A: 0 }, B: { B: 0 }, C: { C: 0 } }
    )

    expect(saveBindingStore.activeBinding?.groups.map((group) => group.sectorMacro)).toEqual(['B', 'A', 'C'])
    expect(saveBindingStore.activeBinding?.groups.map((group) => group.order)).toEqual([0, 1, 2])
  })
})
