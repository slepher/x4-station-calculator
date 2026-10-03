/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import NpcTradeWorkbench from '@/components/empire/NpcTradeWorkbench.vue'
import type { NpcTradeShipGroup, NpcTradeShipType } from '@/components/empire/presenters/useNpcTradePresenter'

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
    candidatePage: { value: 1 },
    candidatePageCount: { value: 1 },
    ineligibleFactionGroups: { value: [] },
    shipTypes: { value: [] as NpcTradeShipType[] },
    shipGroups: { value: [] as NpcTradeShipGroup[] },
    shipPage: { value: 1 },
    shipPageCount: { value: 1 },
    pageState: { value: 'stationNotSelected' },
    pageStateLabel: { value: '' },
    autoFillEnabled: { value: false },
    autoFillAvailable: { value: false },
    autoFillDisabledReason: { value: null },
    autoFillScope: { value: '' },
    autoFillStatus: { value: '' },
    autoFillSource: { value: '' },
    autoFillCanUndo: { value: false },
    autoFillDetails: { value: [] },
    canUseComposite: { value: false },
    canUseTargetMetric: { value: false }
  },
  emits: {
    autoFill: vi.fn(),
    setAutoFillEnabled: vi.fn(),
    undoAutoFill: vi.fn(),
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
    setCandidatePage: vi.fn(),
    setIneligibleFactionExpanded: vi.fn(),
    setIneligibleFactionPage: vi.fn(),
    setShipPage: vi.fn()
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
    presenter.props.candidateSections.value = []
    presenter.props.candidatePage.value = 1
    presenter.props.candidatePageCount.value = 1
    presenter.props.ineligibleFactionGroups.value = []
    presenter.props.shipTypes.value = []
    presenter.props.shipGroups.value = []
    presenter.props.shipPage.value = 1
    presenter.props.shipPageCount.value = 1
    presenter.props.pageState.value = 'stationNotSelected'
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

  it('pages sector groups and does not mount a collapsed reputation group', async () => {
    const sector = {
      key: 'sector-a',
      sectorLabel: 'Sector A',
      sectorOwnerLabel: null,
      jumpLabel: '1 jump',
      stations: []
    }
    presenter.props.pageState.value = 'results'
    presenter.props.candidateSections.value = [sector]
    presenter.props.candidatePageCount.value = 2
    presenter.props.ineligibleFactionGroups.value = [{
      key: 'faction-a',
      factionLabel: 'Faction A',
      reputationLabel: '-10',
      expanded: false,
      page: 1,
      pageCount: 2,
      sectors: [sector]
    }]
    const wrapper = mount(NpcTradeWorkbench, {
      global: { stubs: { X4NumberInput: true } }
    })

    expect(wrapper.find('[data-testid="npc-trade-ineligible-sectors-faction-a"]').exists()).toBe(false)
    await wrapper.get('[data-testid="npc-trade-page-next"]').trigger('click')
    expect(presenter.emits.setCandidatePage).toHaveBeenCalledWith(2)

    const details = wrapper.get('[data-testid="npc-trade-ineligible-faction-faction-a"]')
    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')
    expect(presenter.emits.setIneligibleFactionExpanded).toHaveBeenCalledWith('faction-a', true)
  })

  it('shares one model cargo card while keeping individual ship identity and availability', () => {
    presenter.props.shipTypes.value = [{
      macro: 'heron_macro', shipName: '苍鹭 改进型', shipType: '货船', size: 'L', capacity: 62000,
      loadLimits: [
        { wareId: 'claytronics', wareLabel: '电子黏土', maxAmount: 2583 },
        { wareId: 'energycells', wareLabel: '能量电池', maxAmount: 62000 },
        { wareId: 'hullparts', wareLabel: '船体部件', maxAmount: 5166 }
      ]
    }]
    presenter.props.shipGroups.value = [{
      sectorMacro: 'sector-a', sectorLabel: '希望之歌的选择 I', bindingGroupNames: [],
      ships: ['ship-a', 'ship-b'].map(componentId => ({
        componentId, shipName: '苍鹭 改进型', customName: '诺皮利奥贸易运输' + componentId,
        relativeLabel: '1 跳', availability: 'immediatelyAvailable', availabilityLabel: '立即可用'
      }))
    }]
    const wrapper = mount(NpcTradeWorkbench, { global: { stubs: { X4NumberInput: true } } })
    const modelCard = wrapper.get('[data-testid="npc-trade-ship-types"]')
    expect(modelCard.text()).toContain('货船 · L')
    expect(modelCard.text()).toContain('npc_trade.ship.capacity: 62000')
    expect(modelCard.findAll('dl > div').map(item => [item.get('dt').text(), item.get('dd').text()])).toEqual([
      ['电子黏土', '2583'], ['能量电池', '62000'], ['船体部件', '5166']
    ])
    expect(modelCard.findAll('[data-testid="npc-trade-ship-type-heron_macro"]')).toHaveLength(1)
    const ships = wrapper.findAll('.ship-row')
    expect(ships).toHaveLength(2)
    ships.forEach((card, index) => {
      expect(card.text()).toContain('苍鹭 改进型')
      expect(card.text()).toContain('诺皮利奥贸易运输ship-' + (index === 0 ? 'a' : 'b'))
      expect(card.text()).toContain('立即可用')
      expect(card.text()).toContain('1 跳')
      expect(card.text()).not.toContain('npc_trade.ship.capacity')
      expect(card.text()).not.toContain('货船 · L')
      expect(card.find('dl').exists()).toBe(false)
    })
    wrapper.unmount()
  })

  it('keeps a reclaimable ship and model capacity visible without an empty cargo section', () => {
    presenter.props.shipTypes.value = [{
      macro: 'freighter_macro', shipName: 'Freighter', shipType: 'Transport', size: 'M', capacity: 0, loadLimits: []
    }]
    presenter.props.shipGroups.value = [{
      sectorMacro: 'sector-a', sectorLabel: 'Sector A', bindingGroupNames: [],
      ships: [{
        componentId: 'ship-b', shipName: 'Freighter', customName: null, relativeLabel: '2 jumps',
        availability: 'reclaimable', availabilityLabel: '可收回'
      }]
    }]
    const wrapper = mount(NpcTradeWorkbench, { global: { stubs: { X4NumberInput: true } } })
    expect(wrapper.get('.ship-row').text()).toContain('可收回')
    expect(wrapper.get('[data-testid="npc-trade-ship-types"]').text()).toContain('npc_trade.ship.capacity: 0')
    expect(wrapper.find('dl').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('npc_trade.ship.load_limits')
    wrapper.unmount()
  })

  it('hides the model card when no ships pass the filters and retains the ship empty state', () => {
    const wrapper = mount(NpcTradeWorkbench, { global: { stubs: { X4NumberInput: true } } })
    expect(wrapper.find('[data-testid="npc-trade-ship-types"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('npc_trade.no_ships')
    wrapper.unmount()
  })

  it('pages available ships by complete sector groups', async () => {
    presenter.props.shipPageCount.value = 2
    const wrapper = mount(NpcTradeWorkbench, {
      global: { stubs: { X4NumberInput: true } }
    })

    await wrapper.get('[data-testid="npc-trade-ship-page-next"]').trigger('click')
    expect(presenter.emits.setShipPage).toHaveBeenCalledWith(2)
  })
})
