/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import NpcTradeWorkbench from '@/components/empire/NpcTradeWorkbench.vue'

const presenter = vi.hoisted(() => ({
  props: {
    direction: { value: 'sell' },
    selectedPlayerStationGroupId: { value: 'sector-a' },
    selectedPlayerStationId: { value: 'trade-a' },
    jumpLimit: { value: 5 },
    searchQuery: { value: '' },
    rankMode: { value: 'primary' },
    sortMetric: { value: 'quantity' },
    primaryWareId: { value: null },
    groupBySector: { value: false },
    stationGroups: { value: [{ id: 'sector-a', label: '希望之歌的选择 I', options: [] }] },
    selectedStationOptions: {
      value: [{
        id: 'trade-a',
        label: '希望之歌的选择 I-希望之歌的选择 I',
        disabled: false,
        disabledReason: null,
        sectorMacro: 'sector-a',
        position: { x: 1, y: 0, z: 2 }
      }]
    },
    searchGroups: { value: [{ id: 'energy', label: 'Energy', items: [{ id: 'energycells', label: 'Energy Cells', color: '#0ea5e9' }] }] },
    wareTargets: { value: [] },
    candidateSections: { value: [] },
    shipGroups: { value: [] },
    pageState: { value: 'stationNotSelected' },
    pageStateLabel: { value: '' },
    canUseComposite: { value: false },
    canUseTargetMetric: { value: false }
  },
  emits: {
    setDirection: vi.fn(),
    selectPlayerStationGroup: vi.fn(),
    selectPlayerStation: vi.fn(),
    setJumpLimit: vi.fn(),
    setSearchQuery: vi.fn(),
    addWare: vi.fn(),
    updateTargetQty: vi.fn(),
    removeWare: vi.fn(),
    setRankMode: vi.fn(),
    setSortMetric: vi.fn(),
    setPrimaryWare: vi.fn(),
    setGroupBySector: vi.fn()
  }
}))

vi.mock('@/components/empire/presenters/useNpcTradePresenter', () => ({
  useNpcTradePresenter: () => presenter
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

describe('NpcTradeWorkbench station selector', () => {
  afterEach(() => {
    presenter.props.searchGroups.value = []
    vi.clearAllMocks()
  })

  it('hides the placeholder after selection and renders sector-station', () => {
    const wrapper = mount(NpcTradeWorkbench, {
      global: { stubs: { X4NumberInput: true } }
    })

    const options = wrapper.get('[data-testid="npc-trade-player-station"]').findAll('option')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toBe('希望之歌的选择 I-希望之歌的选择 I')
  })

  it('opens grouped ware candidates and closes after selecting one', async () => {
    presenter.props.searchGroups.value = [{
      id: 'energy',
      label: 'Energy',
      items: [{ id: 'energycells', label: 'Energy Cells', color: '#0ea5e9' }]
    }]
    const wrapper = mount(NpcTradeWorkbench, {
      global: { stubs: { X4NumberInput: true } }
    })

    await wrapper.get('[data-testid="candidate-search-input"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const popover = document.body.querySelector('[data-testid="grouped-candidate-popover"]')
    expect(popover).not.toBeNull()
    expect(popover?.querySelector('[data-testid="grouped-candidate-group-energy"]')).not.toBeNull()

    await popover?.querySelector<HTMLElement>('[data-testid="grouped-candidate-item-energycells"]')?.click()
    expect(presenter.emits.addWare).toHaveBeenCalledWith('energycells')
    expect(document.body.querySelector('[data-testid="grouped-candidate-popover"]')).toBeNull()
  })
})
