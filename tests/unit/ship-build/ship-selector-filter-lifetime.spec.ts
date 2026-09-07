// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, defineStore } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ShipBuildView from '@/components/ship-build/ShipBuildView.vue'
import ShipBuildSelectorView from '@/components/ship-build/ShipBuildSelectorView.vue'

vi.mock('@/utils/UseX4I18n', () => ({ useX4I18n: () => ({
  translateShip: (ship: { id: string }) => ship.id,
  translateShipType: (type: { id: string }) => type.id,
  translateEquipment: () => '', translateEquipmentType: () => ''
}) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => ({}) }))
vi.mock('@/store/useShipBuildStore', () => ({ useShipBuildStore: () => useTestStore() }))

const ships = [
  { id: 'katana', class: 'ship_m', race: 'terran', type: 'corvette', dlc_tag: 'base' },
  { id: 'nemesis', class: 'ship_m', race: 'argon', type: 'corvette', dlc_tag: 'base' },
  { id: 'destroyer', class: 'ship_l', race: 'argon', type: 'destroyer', dlc_tag: 'base' }
]
const useTestStore = defineStore('ship-selector-lifetime-test', {
  state: () => ({
    viewMode: 'workbench', selectedShipId: 'katana',
    blueprint: { shipId: 'katana', equipment: 'retained' },
    shipMap: new Map(ships.map(ship => [ship.id, ship])),
    shipRaces: [{ id: 'terran' }, { id: 'argon' }],
    shipTypes: [{ id: 'corvette', class: ['ship_m'] }, { id: 'destroyer', class: ['ship_l'] }]
  }),
  actions: {
    setDisplayResolvers() {},
    isShipDlcUsable() { return true },
    findShip(id: string) { return this.shipMap.get(id) },
    cancelShipSelector() { this.viewMode = 'workbench' },
    loadBlueprint(id: string) {
      if (id === 'missing') return
      this.blueprint = { shipId: this.selectedShipId, equipment: id }
    },
    setSelectedShipId(id: string) {
      if (id !== this.selectedShipId) this.blueprint = { shipId: id, equipment: '' }
      this.selectedShipId = id
      this.viewMode = 'workbench'
    }
  }
})

function render() {
  const pinia = createPinia()
  const store = useTestStore(pinia)
  const wrapper = mount(ShipBuildView, { global: {
    plugins: [pinia], stubs: { ShipBuildWorkspaceView: true, ShipBuildPanelShip: true }
  } })
  const button = (suffix: string) => wrapper.get(`[data-testid="ship-build-${suffix}"]`)
  const reopen = async () => { store.viewMode = 'selector'; await nextTick() }
  return { store, wrapper, button, reopen }
}

describe('ship selector filter lifetime', () => {
  it('refills filters for same-ship blueprint loads but not equipment edits', async () => {
    const { store, wrapper, button, reopen } = render()
    await reopen()
    await button('filter-race-btn-argon').trigger('click')
    store.blueprint.equipment = 'edited'
    await nextTick()
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-active')
    store.loadBlueprint('missing')
    await nextTick()
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-active')
    await button('cancel-ship-change').trigger('click')
    store.loadBlueprint('other-blueprint')
    await nextTick()
    await reopen()
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-idle')
    await button('filter-race-btn-argon').trigger('click')
    await button('cancel-ship-change').trigger('click')
    store.loadBlueprint('other-blueprint')
    await nextTick()
    await reopen()
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-idle')
    expect(store.selectedShipId).toBe('katana')
    await button('filter-race-btn-argon').trigger('click')
    const selectorState = (wrapper.getComponent(ShipBuildSelectorView).vm.$ as unknown as {
      setupState: { selectedRaces: string[] }
    }).setupState
    wrapper.unmount()
    store.loadBlueprint('after-unmount')
    await nextTick()
    expect(selectorState.selectedRaces).toEqual(['terran', 'argon'])
  })

  it('retains same-class race filters through cancel and reopen without changing blueprint', async () => {
    const { store, wrapper, button, reopen } = render()
    await reopen()
    const before = JSON.stringify(store.blueprint)
    await button('filter-race-btn-argon').trigger('click')
    await button('cancel-ship-change').trigger('click')
    expect(store.viewMode).toBe('workbench')
    await reopen()
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-active')
    expect(button('filter-class-btn-ship_m').classes()).toContain('filter-chip-active')
    expect(JSON.stringify(store.blueprint)).toBe(before)
    wrapper.unmount()
  })

  it('restores selected ship filters after a cross-class cancellation', async () => {
    const { wrapper, button, reopen } = render()
    await reopen()
    await button('filter-class-btn-ship_l').trigger('click')
    await button('filter-race-btn-argon').trigger('click')
    await button('cancel-ship-change').trigger('click')
    await reopen()
    expect(button('filter-class-btn-ship_m').classes()).toContain('filter-chip-active')
    expect(button('filter-race-btn-terran').classes()).toContain('filter-chip-active')
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-idle')
    expect(button('filter-type-btn-corvette').classes()).toContain('filter-chip-active')
    wrapper.unmount()
  })

  it('does not confirm a cancelled pending ship on the next visit', async () => {
    const { store, wrapper, button, reopen } = render()
    await reopen()
    await button('filter-race-btn-argon').trigger('click')
    await wrapper.findAll('.list-item').find(item => item.text().includes('nemesis'))!.trigger('click')
    expect(store.selectedShipId).toBe('katana')
    await button('cancel-ship-change').trigger('click')
    await reopen()
    await button('confirm-ship').trigger('click')
    expect(store.selectedShipId).toBe('katana')
    expect(store.blueprint.equipment).toBe('retained')
    wrapper.unmount()
  })

  it('confirms a different ship and initializes filters for a ship loaded while hidden', async () => {
    const { store, wrapper, button, reopen } = render()
    await reopen()
    await button('filter-race-btn-argon').trigger('click')
    await wrapper.findAll('.list-item').find(item => item.text().includes('nemesis'))!.trigger('click')
    await button('confirm-ship').trigger('click')
    expect(store.selectedShipId).toBe('nemesis')
    expect(store.blueprint.equipment).toBe('')
    store.selectedShipId = 'destroyer'
    await nextTick()
    await reopen()
    expect(button('filter-class-btn-ship_l').classes()).toContain('filter-chip-active')
    expect(button('filter-race-btn-argon').classes()).toContain('filter-chip-active')
    expect(button('filter-type-btn-destroyer').classes()).toContain('filter-chip-active')
    expect(wrapper.findComponent(ShipBuildSelectorView).exists()).toBe(true)
    wrapper.unmount()
  })
})
