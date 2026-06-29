// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectorGroupCard from '@/components/empire/sector-overview/SectorGroupCard.vue'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false
  })
}))

function baseGroup(overrides: Partial<GroupDraftInfo> = {}): GroupDraftInfo {
  return {
    id: 'cluster_01_sector001_macro',
    name: 'Hub',
    sectorMacro: 'cluster_01_sector001_macro',
    jumpRange: 2,
    originalJumpRange: 2,
    coverageSectorMacros: [],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true,
    tradeStationRetainEnabled: true,
    baseline: true,
    ...overrides
  }
}

describe('SectorGroupCard structure lock', () => {
  it('disables pin and unpin button without hiding hub content', () => {
    const group = baseGroup()
    const wrapper = mount(SectorGroupCard, {
      props: {
        group,
        groups: [group],
        assignments: [],
        maps: null,
        sectorGraph: {},
        sectorClusterMap: {},
        playerSectorMacros: [],
        editable: false,
        diffEnabled: true,
        structureDisabled: true
      }
    })

    const pinButton = wrapper.find('button.state-btn')

    expect(pinButton.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.group-name').text()).toBe('Hub')
  })

  it('uses saved binding sectorMacro baseline for new-group highlight', () => {
    const group = baseGroup({ id: 'runtime-random-id', isNew: true })
    const wrapper = mount(SectorGroupCard, {
      props: {
        group,
        groups: [group],
        assignments: [],
        maps: null,
        sectorGraph: {},
        sectorClusterMap: {},
        playerSectorMacros: [],
        editable: false,
        diffEnabled: true,
        baselineCoverageByGroupId: { [group.sectorMacro!]: [] },
        baselineConnectedGroupIdsByGroupId: { [group.sectorMacro!]: [] }
      }
    })

    expect(wrapper.find('.group-item').classes()).not.toContain('group-item--new')
  })
})
