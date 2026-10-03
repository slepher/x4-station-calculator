// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { getActivePinia } from 'pinia'
import draggable from 'vuedraggable'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import ProductionSidebar from '@/components/empire/ProductionSidebar.vue'
import { useProductionSidebarPresenter, type ProductionSidebarPresenter, type SidebarSource } from '@/components/empire/presenters/useProductionSidebarPresenter'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/i18n', () => ({ default: { global: { t: (key: string) => key } } }))
vi.mock('@/store/useSaveBindingStore', () => ({ useSaveBindingStore: () => ({ isDirty: false, updateGroupMetadata: vi.fn(() => true) }) }))
vi.mock('@/store/useTerraformingStore', () => ({ useTerraformingStore: () => ({ terraformingData: { clusters: [{ id: 'earth', macro: 'earth', initialStats: {} }], stats: [] }, activePlan: null, selectCluster: vi.fn() }) }))
vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => ({ maps: { clusters: {}, sectors: {} } }) }))
let wrappers: VueWrapper[] = []
beforeEach(() => {
  localStorage.removeItem('x4_production_sidebar')
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 })
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
})
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers = []; vi.restoreAllMocks(); document.body.innerHTML = '' })
function setup(mode: 'blueprint' | 'live' = 'live') {
  const store = reactive({
    session: { workbenchMode: 'station', activeStationId: 's1', activeTransitSectorId: null },
    activeEmpire: { id: 'empire-a' }, isDirty: false, orderedStations: [{ id: 's1', name: 'One' }], createStation: vi.fn(), renameStation: vi.fn(), duplicateStation: vi.fn(), reorderStations: vi.fn(),
    activeBinding: { gameGuid: 'game-a', groups: [{ name: 'Alpha', sectorMacro: 'g1', color: '#123456' }, { name: 'Beta', sectorMacro: 'g2' }] },
    isReady: true, loadedBindingGameGuid: 'game-a', sectors: [{ id: 'g1', name: 'Alpha' }, { id: 'g2', name: 'Beta' }],
    orderedStationsBySector: [{ id: 's1', name: 'One', sectorId: 'g1' }, { id: 's2', name: 'Two', sectorId: 'g1' }], tabSemanticsById: {}, supportsNpcTrade: true, autoGroupResult: null, needsAutoGroupRecalc: false,
    selectStation: vi.fn(), selectTransitSector: vi.fn(), selectResearch: vi.fn(), selectTerraforming: vi.fn(), selectBlueprintRecipe: vi.fn(), selectNpcTrade: vi.fn(), selectAutoSectorGroup: vi.fn(), openStationBinding: vi.fn(), jumpToMapBinding: vi.fn(), canDeleteStation: vi.fn(() => false), deleteStation: vi.fn()
  })
  let presenter!: ProductionSidebarPresenter
  const wrapper = mount(defineComponent({ setup() {
    presenter = useProductionSidebarPresenter({ mode, store } as unknown as SidebarSource)
    return () => h(ProductionSidebar, { presenter })
  } }), { attachTo: document.body, global: { plugins: [getActivePinia()!] } })
  wrappers.push(wrapper)
  return { wrapper, presenter, store }
}

async function pointer(element: Element, type: string, pointerId: number, clientX = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  element.dispatchEvent(event)
  await nextTick()
}

if (HTMLElement.prototype.scrollIntoView === undefined) HTMLElement.prototype.scrollIntoView = () => {}

describe('sidebar DOM events (tasks 4, 8, 9, 12)', () => {
  it.each(['blueprint', 'live'] as const)('uses one content scroller with fixed controls in %s desktop and drawer', async mode => {
    const { wrapper, presenter, store } = setup(mode)
    presenter.togglePin('s1')
    await nextTick()
    const body = wrapper.get('.sidebar-body').element
    const scroll = wrapper.get('.sidebar-scroll')
    const toggle = wrapper.get('[data-testid="sidebar-toggle"]')
    expect(toggle.element.parentElement).toBe(body)
    expect(scroll.element.contains(wrapper.get('[data-testid="sidebar-overview"]').element)).toBe(true)
    expect(scroll.element.contains(wrapper.get('[data-testid="sidebar-pinned"]').element)).toBe(true)
    expect(scroll.element.contains(wrapper.get('[data-testid="sidebar-search"]').element)).toBe(true)
    expect(scroll.element.contains(wrapper.get('[data-station-id="s1"]').element)).toBe(true)
    if (mode === 'blueprint') {
      const footer = wrapper.get('.sidebar-footer')
      expect(footer.element.parentElement).toBe(body)
      expect(scroll.element.contains(footer.element)).toBe(false)
    } else expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
    const element = scroll.element as HTMLElement
    element.scrollTop = 175
    await scroll.trigger('scroll')
    await toggle.trigger('click')
    expect(element.scrollTop).toBe(175)
    expect(toggle.element.parentElement).toBe(body)
    expect(scroll.element.contains(wrapper.get('[data-testid="sidebar-research"]').element)).toBe(true)
    window.innerWidth = 600; window.dispatchEvent(new Event('resize')); await nextTick()
    await wrapper.get('[data-testid="sidebar-drawer-toggle"]').trigger('click')
    expect(wrapper.get('aside').classes()).toContain('drawer-open')
    expect(toggle.element.parentElement).toBe(body)
    expect(scroll.element.contains(wrapper.get('[data-testid="sidebar-search"]').element)).toBe(true)
    if (mode === 'blueprint') {
      expect(wrapper.get('.sidebar-footer').element.parentElement).toBe(body)
      await wrapper.get('[data-testid="sidebar-add-station"]').trigger('click')
      expect(store.createStation).toHaveBeenCalledOnce()
    } else expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
  })
  it('retains clickable live entries in the 64px rail without an add/bind footer', async () => {
    const { wrapper, store } = setup()
    expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
    await wrapper.get('[data-testid="sidebar-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="production-sidebar"]').attributes('style')).toContain('64px')
    const station = wrapper.get('[data-station-id="s1"]')
    expect(station.attributes('title')).toBe('One — Alpha')
    await station.get('.sidebar-nav').trigger('click')
    await wrapper.get('[data-testid="sidebar-research"] .sidebar-nav').trigger('click')
    expect(wrapper.find('[data-testid="sidebar-bind-station"]').exists()).toBe(false)
    expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
    expect(store.selectStation).toHaveBeenCalledExactlyOnceWith('s1')
    expect(store.selectResearch).toHaveBeenCalledOnce()
    expect(store.openStationBinding).not.toHaveBeenCalled()
  })
  it('shows a graphical collapse control in both states and keeps the blueprint add action', async () => {
    const { wrapper, store } = setup('blueprint')
    const toggle = wrapper.get('[data-testid="sidebar-toggle"]')
    expect(toggle.find('svg').exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await toggle.trigger('click')
    expect(toggle.find('svg').exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await wrapper.get('[data-testid="sidebar-add-station"]').trigger('click')
    expect(store.createStation).toHaveBeenCalledOnce()
  })
  it.each([false, true])('uses the group title only to fold, and the first child to navigate (compact=%s)', async compact => {
    const { wrapper, presenter, store } = setup()
    if (compact) await wrapper.get('[data-testid="sidebar-toggle"]').trigger('click')
    const group = wrapper.get('[data-sector-id="g1"][data-testid="sidebar-sector"]')
    const toggle = group.get('[data-testid="sidebar-sector-toggle"]')
    const firstChild = wrapper.get('[data-sector-id="g1"][data-testid="sidebar-transit"]')
    expect(firstChild.attributes('data-entry-id')).toBe('transit:g1')
    expect(firstChild.element.compareDocumentPosition(wrapper.get('[data-station-id="s1"]').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(group.find('[aria-current="page"]').exists()).toBe(false)
    expect(toggle.get('.sidebar-fold-icon').attributes('style')).toContain('station-group-expanded.svg')
    store.selectTransitSector.mockImplementation(id => Object.assign(store.session, { workbenchMode: 'transit', activeTransitSectorId: id }))
    await firstChild.get('.sidebar-nav').trigger('click')
    expect(store.selectTransitSector).toHaveBeenCalledExactlyOnceWith('g1')
    expect(presenter.groups[0]!.expanded).toBe(true)
    expect(firstChild.classes()).toContain('active')
    expect(group.classes()).not.toContain('active')
    if (compact) await toggle.get('.sidebar-fold-icon').trigger('click')
    else await toggle.get('.sidebar-item-label').trigger('click')
    expect(wrapper.find('[data-station-id="s1"]').exists()).toBe(false)
    expect(wrapper.find('[data-entry-id="transit:g1"]').exists()).toBe(false)
    expect(store.session.workbenchMode).toBe('transit')
    expect(store.selectTransitSector).toHaveBeenCalledTimes(1)
    expect(toggle.get('.sidebar-fold-icon').attributes('style')).toContain('station-group-collapsed.svg')
    await toggle.trigger('click')
    expect(wrapper.get('[data-entry-id="transit:g1"]').classes()).toContain('active')
    if (!compact) {
      await group.get('[data-testid="sidebar-group-menu"]').trigger('click')
      expect(document.querySelector('[data-testid="sidebar-group-editor"]')).not.toBeNull()
      expect(document.querySelectorAll('[data-testid="sidebar-group-color"]')).toHaveLength(10)
    }
    expect(store.selectTransitSector).toHaveBeenCalledTimes(1)
    expect(store.selectStation).not.toHaveBeenCalled()
  })
  it('shows a separate tree collapse control in the narrow sidebar without navigating', async () => {
    const { wrapper, presenter, store } = setup()
    await wrapper.get('[data-testid="sidebar-toggle"]').trigger('click')
    const toggle = wrapper.get('[data-testid="sidebar-terraforming"] [data-testid="sidebar-tree-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.get('.sidebar-fold-icon').attributes('style')).toContain('terraforming-collapsed.svg')
    await toggle.trigger('click')
    expect(toggle.get('.sidebar-fold-icon').attributes('style')).toContain('terraforming-expanded.svg')
    expect(presenter.expandedTerraforming).toBe(true)
    expect(wrapper.find('[data-entry-id="terraforming:earth"]').exists()).toBe(true)
    expect(store.selectTerraforming).not.toHaveBeenCalled()
    expect(store.selectStation).not.toHaveBeenCalled()
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-entry-id="terraforming:earth"]').exists()).toBe(false)
  })
  it('opens identical actions through ⋮ and right click without navigating, rejects stale targets', async () => {
    const { wrapper, presenter, store } = setup()
    const station = wrapper.get('[data-station-id="s1"]')
    await station.get('[data-testid="sidebar-station-menu"]').trigger('click')
    const actions = Array.from(document.querySelectorAll('.sidebar-context-menu button')).map(button => button.getAttribute('data-testid'))
    presenter.closeOverlays(); await nextTick()
    await station.trigger('contextmenu', { clientX: 5, clientY: 5 })
    expect(Array.from(document.querySelectorAll('.sidebar-context-menu button')).map(button => button.getAttribute('data-testid'))).toEqual(actions)
    expect(store.selectStation).not.toHaveBeenCalled()
    store.orderedStationsBySector = []
    presenter.runMenuAction('binding')
    expect(store.jumpToMapBinding).not.toHaveBeenCalled()
  })
  it('captures resize input, saves on pointerup once and cancels on lost capture/unmount', async () => {
    const captured = new Set<number>()
    const set = vi.fn((id: number) => captured.add(id))
    const release = vi.fn((id: number) => captured.delete(id))
    HTMLElement.prototype.setPointerCapture = set
    HTMLElement.prototype.hasPointerCapture = (id: number) => captured.has(id)
    HTMLElement.prototype.releasePointerCapture = release
    const { wrapper, presenter, store } = setup()
    const handle = wrapper.get('[data-testid="sidebar-resize-handle"]')
    await pointer(handle.element, 'pointerdown', 1, 240)
    expect(set).toHaveBeenCalledWith(1)
    await pointer(handle.element, 'pointermove', 1, 300)
    expect(presenter.width).toBe(300)
    await pointer(handle.element, 'pointercancel', 1)
    expect(presenter.width).toBe(240)
    await pointer(handle.element, 'pointerdown', 2, 240)
    await pointer(handle.element, 'pointermove', 2, 310)
    await pointer(handle.element, 'pointerup', 2)
    await pointer(handle.element, 'lostpointercapture', 2)
    expect(presenter.width).toBe(310)
    await pointer(handle.element, 'pointerdown', 3, 310)
    store.activeBinding.gameGuid = 'game-b'; store.loadedBindingGameGuid = 'game-b'
    await nextTick()
    expect(release).toHaveBeenCalledWith(3)
    await pointer(handle.element, 'pointerdown', 4, 310)
    wrapper.unmount(); wrappers = wrappers.filter(item => item !== wrapper)
    expect(release).toHaveBeenCalledWith(4)
    expect(captured.size).toBe(0)
  })
  it('restores DOM scroll after ordinary return and locates explicit navigation after DOM update', async () => {
    const { wrapper, presenter } = setup()
    const scroll = wrapper.get('.sidebar-scroll').element as HTMLElement
    scroll.scrollTop = 84
    await wrapper.get('.sidebar-scroll').trigger('scroll')
    presenter.setQuery('Two'); await nextTick()
    presenter.setQuery(''); await nextTick(); await nextTick()
    expect(scroll.scrollTop).toBe(84)
    presenter.toggleGroup('g1'); presenter.setQuery('Two')
    vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear()
    useActiveViewStore().navigateToProduction('live', 'game-a', 's1')
    await flushPromises()
    expect(wrapper.find('[data-station-id="s1"]').exists()).toBe(true)
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })
  it('passes one sort proposal only after a release inside the source list and rejects external/pointer cancellation', async () => {
    const { wrapper, presenter } = setup()
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn() })
    const list = wrapper.findAllComponents(draggable).find(component => component.attributes('data-sort-scope') === 'g1')!
    const hit = wrapper.get('[data-station-id="s1"]').element
    const commit = vi.spyOn(presenter, 'endSort')
    list.vm.$emit('start', { from: list.element })
    list.vm.$emit('update:modelValue', [...presenter.groups[0]!.stations].reverse())
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s1', 's2'])
    vi.mocked(document.elementFromPoint).mockReturnValue(hit)
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 100 }))
    list.vm.$emit('end')
    expect(commit).toHaveBeenLastCalledWith(true)
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s2', 's1'])
    list.vm.$emit('start', { from: list.element })
    list.vm.$emit('update:modelValue', [...presenter.groups[0]!.stations].reverse())
    vi.mocked(document.elementFromPoint).mockReturnValue(document.body)
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 900, clientY: 100 }))
    list.vm.$emit('end')
    expect(commit).toHaveBeenLastCalledWith(false)
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s2', 's1'])
    list.vm.$emit('start', { from: list.element })
    list.vm.$emit('update:modelValue', [...presenter.groups[0]!.stations].reverse())
    document.dispatchEvent(new Event('pointercancel'))
    vi.mocked(document.elementFromPoint).mockReturnValue(hit)
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 100 }))
    list.vm.$emit('end')
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s2', 's1'])
    await nextTick()
    expect(wrapper.get('[data-sort-scope="g1"]').element).not.toBe(list.element)
  })
  it('shows the narrow drawer and closes only on navigation/backdrop, leaving desktop width intact', async () => {
    const { wrapper, presenter } = setup()
    presenter.startResize(1, 0); presenter.moveResize(1, 80); presenter.endResize(1, true)
    window.innerWidth = 767; window.dispatchEvent(new Event('resize')); await nextTick()
    await wrapper.get('[data-testid="sidebar-drawer-toggle"]').trigger('click')
    expect(wrapper.get('aside').classes()).toContain('drawer-open')
    expect(wrapper.get('[data-testid="sidebar-drawer"]').find('[data-testid="sidebar-research"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="sidebar-drawer"]').find('.sidebar-footer').exists()).toBe(false)
    await wrapper.get('[data-testid="sidebar-group-menu"][data-sector-id="g1"]').trigger('click')
    expect(presenter.drawerOpen).toBe(true)
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(presenter.editor).toBeNull()
    expect(presenter.drawerOpen).toBe(true)
    document.querySelector<HTMLButtonElement>('[data-testid="sidebar-drawer-backdrop"]')!.click(); await nextTick()
    expect(presenter.drawerOpen).toBe(false)
    presenter.toggleCollapsed(); presenter.select('s1'); expect(presenter.drawerOpen).toBe(false)
    window.innerWidth = 768; window.dispatchEvent(new Event('resize')); await nextTick()
    expect(presenter.width).toBe(320)
  })
  it('removes every registered global listener with its original function on unmount', () => {
    const windowAdd = vi.spyOn(window, 'addEventListener'); const windowRemove = vi.spyOn(window, 'removeEventListener')
    const documentAdd = vi.spyOn(document, 'addEventListener'); const documentRemove = vi.spyOn(document, 'removeEventListener')
    const { wrapper } = setup()
    const registered = documentAdd.mock.calls.filter(([name]) => ['mouseup', 'touchend', 'pointercancel', 'touchcancel', 'pointerdown'].includes(name))
    wrapper.unmount(); wrappers = wrappers.filter(item => item !== wrapper)
    for (const [name, handler, capture] of registered) {
      expect(documentRemove.mock.calls.some(([removedName, removedHandler, removedCapture]) => removedName === name && removedHandler === handler && removedCapture === capture)).toBe(true)
    }
    const resize = windowAdd.mock.calls.find(([name]) => name === 'resize')!
    expect(windowRemove).toHaveBeenCalledWith('resize', resize[1])
    const blur = windowAdd.mock.calls.find(([name]) => name === 'blur')!
    expect(windowRemove).toHaveBeenCalledWith('blur', blur[1])
  })
})
