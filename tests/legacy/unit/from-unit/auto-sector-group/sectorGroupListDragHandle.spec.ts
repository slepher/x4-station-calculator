/**
 * @vitest-environment jsdom
 */
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SectorGroupList from '@/components/empire/sector-overview/SectorGroupList.vue'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const DraggableStub = defineComponent({
  name: 'Draggable',
  props: {
    list: { type: Array, required: true },
    handle: { type: String, required: false }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'draggable-stub', 'data-handle': props.handle ?? '' },
      (props.list as GroupDraftInfo[]).map((element) => slots.item?.({ element }))
    )
  }
})

const SectorGroupCardStub = defineComponent({
  name: 'SectorGroupCard',
  props: {
    group: { type: Object, required: true },
    showDragHandle: { type: Boolean, default: false }
  },
  setup(props) {
    return () => h('div', {
      class: 'sector-group-card-stub',
      'data-group-id': (props.group as GroupDraftInfo).id,
      'data-show-drag-handle': props.showDragHandle ? 'true' : 'false'
    })
  }
})

function group(id: string): GroupDraftInfo {
  return {
    id,
    name: id,
    sectorMacro: id,
    jumpRange: 2,
    originalJumpRange: 2,
    coverageSectorMacros: [],
    connectedGroupIds: [],
    excludedDefaultAssignmentSectorMacros: [],
    isNew: false,
    isPinned: true,
    coverageRetainEnabled: true,
    connectionRetainEnabled: true
  }
}

describe('SectorGroupList drag handle', () => {
  it('hides drag handles by default while keeping the list draggable', () => {
    const wrapper = mount(SectorGroupList, {
      props: {
        groups: [group('A'), group('B')],
        assignments: [],
        maps: null,
        sectorGraph: {},
        sectorClusterMap: {},
        playerSectorMacros: [],
        editable: false,
        diffEnabled: false,
        draggable: true
      },
      global: {
        stubs: {
          draggable: DraggableStub,
          SectorGroupCard: SectorGroupCardStub
        }
      }
    })

    expect(wrapper.find('.draggable-stub').exists()).toBe(true)
    expect(wrapper.find('.draggable-stub').attributes('data-handle')).toBe('')
    expect(wrapper.findAll('.sector-group-card-stub').map((card) => card.attributes('data-show-drag-handle'))).toEqual(['false', 'false'])
  })
})
