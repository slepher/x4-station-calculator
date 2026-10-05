// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, type EffectScope } from 'vue'
import { useProductionSidebarPresenter, type SidebarSource } from '@/components/empire/presenters/useProductionSidebarPresenter'
import { useProductionSidebarStateStore } from '@/store/useProductionSidebarStateStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'

const mocks = vi.hoisted(() => ({ binding: null as any, update: vi.fn(), terraform: null as any }))
vi.mock('@/store/useSaveBindingStore', () => ({ useSaveBindingStore: () => ({ get isDirty() { return false }, updateGroupMetadata: mocks.update }) }))
vi.mock('@/store/useTerraformingStore', () => ({ useTerraformingStore: () => mocks.terraform }))
vi.mock('@/store/useGameDataStore', () => ({ useGameDataStore: () => ({ maps: { clusters: {}, sectors: {} } }) }))
vi.mock('@/i18n', () => ({ default: { global: { t: (key: string) => key } } }))
let scopes: EffectScope[] = []
beforeEach(() => {
  localStorage.removeItem('x4_production_sidebar')
  localStorage.removeItem('x4_station_active_view')
  mocks.terraform = reactive({ terraformingData: { clusters: [{ id: 'earth', macro: 'macro.earth', initialStats: { temperature: 10 } }], stats: [{ id: 'temperature', ranges: [{ start: 0, end: 50, state: 2 }] }] }, activePlan: { selectedClusterId: null }, selectCluster: vi.fn() })
  mocks.update.mockReset()
  mocks.update.mockImplementation((contextId, groupKey, original, patch) => {
    const binding = mocks.binding
    if (binding === null || binding.gameGuid !== contextId) return false
    const group = binding.groups.find((item: any) => item.sectorMacro === groupKey)
    if (group === undefined || group.name !== original.name || group.color !== original.color) return false
    Object.assign(group, patch)
    return true
  })
})
afterEach(() => { scopes.forEach(scope => scope.stop()); scopes = [] })
function setup(mode: 'blueprint' | 'live' = 'live', ready = true) {
  const common = {
    session: { workbenchMode: 'station', activeStationId: 's1', activeTransitSectorId: null }, tabSemanticsById: {},
    selectStation: vi.fn(), selectResearch: vi.fn(), selectTerraforming: vi.fn(), selectBlueprintRecipe: vi.fn(), deleteStation: vi.fn()
  }
  const store = reactive({ ...common,
    activeEmpire: { id: 'empire-a' }, isDirty: false,
    activeBinding: { gameGuid: 'binding-a', groups: [{ sectorMacro: 'g1', name: 'Alpha', color: '#123456' }, { sectorMacro: 'g2', name: 'Beta' }], stationPlans: [], selectedArchiveTime: null, updatedAt: 0 },
    orderedStations: [{ id: 's1', name: 'Ore Works' }, { id: 's2', name: 'Solar Plant' }],
    sectors: [{ id: 'g1', name: 'Alpha' }, { id: 'g2', name: 'Beta' }],
    orderedStationsBySector: [{ id: 's1', name: 'Ore Works', sectorId: 'g1' }, { id: 's2', name: 'Solar Plant', sectorId: 'g1' }, { id: 's3', name: 'Refinery', sectorId: 'g2' }],
    isReady: ready, loadedBindingGameGuid: 'binding-a', supportsNpcTrade: true, autoGroupResult: null, needsAutoGroupRecalc: false,
    createStation: vi.fn(), renameStation: vi.fn(), duplicateStation: vi.fn(), reorderStations: vi.fn(() => true),
    selectTransitSector: vi.fn(), selectNpcTrade: vi.fn(), selectAutoSectorGroup: vi.fn(), openStationBinding: vi.fn(), jumpToMapBinding: vi.fn(), canDeleteStation: vi.fn((id: string) => id === 's2')
  })
  mocks.binding = store.activeBinding
  const scope = effectScope(); scopes.push(scope)
  const presenter = scope.run(() => useProductionSidebarPresenter({ mode, store } as unknown as SidebarSource))!
  return { presenter, store, prefs: useProductionSidebarStateStore(), navigation: useActiveViewStore(), scope }
}

describe('sidebar source and actions (tasks 1, 2, 4, 9)', () => {
  it('builds flat blueprint and grouped live rows, fixed capabilities, station/transit activity and special tree', () => {
    const { presenter: blueprint } = setup('blueprint')
    expect(blueprint.groups).toEqual([])
    expect(blueprint.flatItems.map(item => item.id)).toEqual(['s1', 's2'])
    expect(blueprint.fixedItems.map(item => item.id)).toEqual(['overview', 'blueprint-recipe', 'research', 'terraforming'])
    const { presenter, store } = setup()
    expect(presenter.groups.map(group => [group.id, group.stations.map(item => item.id)])).toEqual([['g1', ['s1', 's2']], ['g2', ['s3']]])
    expect(presenter.groups[0]!.active).toBe(true)
    expect(presenter.fixedItems.map(item => item.id)).toContain('npc-trade')
    expect(presenter.terraformItems[0]!.iconClass).toBe('icon-temp-state-2')
    store.session.workbenchMode = 'transit'; store.session.activeTransitSectorId = 'g2'
    expect(presenter.groups[1]!.row.active).toBe(true)
    presenter.select('transit:g1')
    expect(store.selectTransitSector).toHaveBeenCalledWith('g1')
  })
  it('offers only blueprint creation and keeps group collapse selection-neutral', () => {
    const blueprint = setup('blueprint'); blueprint.presenter.runPrimaryAction()
    expect(blueprint.store.createStation).toHaveBeenCalledOnce()
    const { presenter, store } = setup()
    presenter.runPrimaryAction()
    expect(presenter.primaryAction).toBeNull()
    expect(store.openStationBinding).not.toHaveBeenCalled()
    expect(store.createStation).not.toHaveBeenCalled()
    presenter.toggleGroup('g1')
    expect(presenter.groups[0]!.expanded).toBe(false)
    expect(store.selectStation).not.toHaveBeenCalled()
    presenter.toggleCollapsed()
    expect(presenter.width).toBe(64)
    expect(presenter.fixedItems.length).toBe(6)
    presenter.toggleGroup('g1')
    expect(presenter.groups[0]!.stations[0]!.tooltip).toBe('Ore Works — Alpha')
    presenter.select('s1')
    expect(store.selectStation).toHaveBeenCalledWith('s1')
  })
  it('uses one menu action matrix and revalidates identity/permissions before actions and deletion', () => {
    const { presenter, store } = setup()
    presenter.openMenu('s1')
    expect(presenter.menuActions.map(action => action.id)).toEqual(['binding', 'pin'])
    expect(store.selectStation).not.toHaveBeenCalled()
    presenter.runMenuAction('delete')
    expect(store.deleteStation).not.toHaveBeenCalled()
    presenter.openMenu('s1'); presenter.runMenuAction('binding')
    expect(store.jumpToMapBinding).toHaveBeenCalledWith('s1', 'station')
    presenter.openMenu('s2'); presenter.runMenuAction('delete')
    presenter.cancelDelete()
    expect(store.deleteStation).not.toHaveBeenCalled()
    presenter.openMenu('s2'); presenter.runMenuAction('delete')
    store.canDeleteStation.mockReturnValue(false)
    presenter.confirmDelete()
    expect(store.deleteStation).not.toHaveBeenCalled()
    presenter.openMenu('s1'); store.orderedStationsBySector = []
    presenter.runMenuAction('binding')
    expect(presenter.feedback).toBe('sidebar.unavailable')
    const blueprint = setup('blueprint')
    blueprint.presenter.openMenu('s1')
    expect(blueprint.presenter.menuActions.map(action => action.id)).toEqual(['rename', 'duplicate', 'delete', 'pin'])
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('  Renamed  ')
    blueprint.presenter.runMenuAction('rename')
    expect(blueprint.store.renameStation).toHaveBeenCalledWith('s1', 'Renamed')
    prompt.mockRestore()
  })
})

describe('group editor (task 5)', () => {
  it('retains custom colors, rejects blank names, trims and atomically updates the canonical group', () => {
    const { presenter, store } = setup()
    presenter.openGroupEditor('g1')
    expect(presenter.colorOptions).toHaveLength(10)
    expect(presenter.colorOptions.find(option => option.selected)?.color).toBe('#123456')
    presenter.editor!.name = '  '
    expect(presenter.applyGroupEditor()).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
    presenter.editor!.name = '  New Alpha  '
    expect(presenter.applyGroupEditor()).toBe(true)
    expect(store.activeBinding.groups[0]!.name).toBe('New Alpha')
    expect(store.activeBinding.groups[0]!.color).toBe('#123456')
    expect(presenter.groups[0]!.name).toBe('New Alpha')
    expect(mocks.update).toHaveBeenCalledWith('binding-a', 'g1', { name: 'Alpha', color: '#123456' }, { name: 'New Alpha', color: '#123456' })
  })
  it('cancels without writes, rejects concurrent name/color changes, permits other fields and closes invalid contexts', async () => {
    const { presenter, store } = setup()
    presenter.openGroupEditor('g2'); presenter.editor!.name = 'Ignored'; presenter.closeOverlays()
    expect(store.activeBinding.groups[1]!.name).toBe('Beta')
    presenter.openGroupEditor('g1'); store.activeBinding.groups[0]!.name = 'Elsewhere'
    expect(presenter.applyGroupEditor()).toBe(false)
    expect(presenter.editor!.error).toBe('sidebar.edit_conflict')
    presenter.closeOverlays(); presenter.openGroupEditor('g1'); store.activeBinding.groups[0]!.color = '#abcdef'
    expect(presenter.applyGroupEditor()).toBe(false)
    presenter.closeOverlays(); presenter.openGroupEditor('g2'); presenter.editor!.name = 'New Beta'
    store.activeBinding.updatedAt = 200
    expect(presenter.applyGroupEditor()).toBe(true)
    expect(store.activeBinding.groups[1]!.color).toBeUndefined()
    presenter.openGroupEditor('g1'); store.activeBinding.gameGuid = 'binding-b'; store.loadedBindingGameGuid = 'binding-b'
    await nextTick()
    expect(presenter.editor).toBeNull()
    expect(presenter.applyGroupEditor()).toBe(false)
    presenter.openGroupEditor('g1'); store.activeBinding.groups = []
    await nextTick()
    expect(presenter.editor).toBeNull()
  })
})

describe('restoration, navigation and search (tasks 6, 7)', () => {
  it('waits for entity loading before restoring scroll and ignores scroll events from an empty loading list', async () => {
    const prefs = useProductionSidebarStateStore()
    prefs.setContext('live', 'binding-a', { scrollTop: 172, collapsedGroupKeys: ['g1'] })
    const { presenter, store } = setup('live', false)
    presenter.setScrollTop(0)
    await nextTick()
    expect(presenter.location).toBeNull()
    expect(prefs.context('live', 'binding-a')!.scrollTop).toBe(172)
    store.isReady = true
    await nextTick(); await nextTick()
    expect(presenter.location?.scrollTop).toBe(172)
    expect(presenter.groups[0]!.expanded).toBe(false)
  })
  it('keeps manual collapse on unrelated list updates and restores context scroll/collapse', async () => {
    const { presenter, store, prefs } = setup()
    presenter.toggleGroup('g1'); presenter.setScrollTop(127)
    store.orderedStationsBySector.push({ id: 's4', name: 'New', sectorId: 'g1' })
    await nextTick()
    expect(presenter.groups[0]!.expanded).toBe(false)
    store.activeBinding.gameGuid = 'binding-b'; store.loadedBindingGameGuid = 'binding-b'
    await nextTick()
    expect(prefs.context('live', 'binding-b')?.scrollTop).toBe(0)
    store.activeBinding.gameGuid = 'binding-a'; store.loadedBindingGameGuid = 'binding-a'
    await nextTick(); await nextTick()
    expect(presenter.groups[0]!.expanded).toBe(false)
    expect(presenter.location?.scrollTop).toBe(127)
  })
  it('processes repeated explicit navigation after DOM tick, once per token, and ignores missing targets', async () => {
    const { presenter, navigation } = setup()
    presenter.toggleGroup('g1'); presenter.setQuery('Refinery')
    navigation.navigateToProduction('live', 'binding-a', 's1')
    expect(presenter.location).toBeNull()
    await nextTick(); await nextTick()
    expect(presenter.query).toBe('')
    expect(presenter.groups[0]!.expanded).toBe(true)
    expect(presenter.location?.stationId).toBe('s1')
    const first = presenter.location!.serial
    expect(navigation.productionNavigation).toBeNull()
    await nextTick(); expect(presenter.location!.serial).toBe(first)
    navigation.navigateToProduction('live', 'binding-a', 's1')
    await nextTick(); await nextTick()
    expect(presenter.location!.serial).toBeGreaterThan(first)
    const last = presenter.location!.serial
    navigation.navigateToProduction('live', 'binding-a', 'gone')
    await nextTick(); await nextTick()
    expect(presenter.location!.serial).toBe(last)
    expect(navigation.productionNavigation).toBeNull()
  })
  it('retains matched group context, expands search results, restores snapshot and does not select', async () => {
    const { presenter, store, prefs } = setup()
    presenter.toggleGroup('g1'); presenter.setScrollTop(91)
    const before = JSON.parse(JSON.stringify(prefs.context('live', 'binding-a')))
    presenter.setQuery('  ALPHA ')
    expect(presenter.groups.map(group => [group.id, group.stations.map(item => item.id), group.expanded])).toEqual([['g1', ['s1', 's2'], true]])
    expect(presenter.canSort).toBe(false)
    presenter.setQuery('solar')
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s2'])
    presenter.setScrollTop(0)
    expect(store.selectStation).not.toHaveBeenCalled()
    presenter.setQuery('nothing')
    expect(presenter.noResults).toBe(true)
    presenter.setQuery('')
    await nextTick()
    expect(prefs.context('live', 'binding-a')).toEqual(before)
    expect(presenter.groups[0]!.expanded).toBe(false)
    expect(presenter.location?.scrollTop).toBe(91)
    presenter.setQuery('Ore'); store.activeBinding.gameGuid = 'other'; store.loadedBindingGameGuid = 'other'
    expect(presenter.query).toBe('')
  })
})

describe('width, sort, pins and drawer (tasks 8, 10, 11, 12)', () => {
  it('previews bounded width and persists once on matching pointerup, cancels and restores width across collapse/mode', () => {
    const { presenter, prefs } = setup()
    const write = vi.spyOn(prefs, 'setMode')
    presenter.startResize(7, 0); presenter.moveResize(7, 900)
    expect(presenter.width).toBe(400)
    expect(prefs.state.modes.live.expandedWidth).toBe(240)
    presenter.endResize(7, true); presenter.endResize(7, true)
    expect(write).toHaveBeenCalledTimes(1)
    presenter.startResize(8, 0); presenter.moveResize(8, -999); expect(presenter.width).toBe(200)
    presenter.endResize(8, false); expect(presenter.width).toBe(400)
    presenter.toggleCollapsed(); expect(presenter.width).toBe(64)
    presenter.toggleCollapsed(); expect(presenter.width).toBe(400)
    expect(prefs.state.modes.blueprint.expandedWidth).toBe(240)
  })
  it('commits one complete blueprint permutation, rejects duplicate/missing/extra IDs and external/cancelled releases', () => {
    const { presenter, store } = setup('blueprint')
    for (const ids of [['s1', 's1'], ['s1'], ['s1', 'wrong']]) {
      presenter.startSort('stations', null); presenter.proposeSort(ids)
      expect(presenter.endSort(true)).toBe(false)
    }
    presenter.startSort('stations', null); presenter.proposeSort(['s2', 's1'])
    expect(presenter.endSort(false)).toBe(false)
    presenter.startSort('stations', null); presenter.proposeSort(['s2', 's1']); presenter.cancelInteraction()
    expect(presenter.endSort(true)).toBe(false)
    presenter.startSort('stations', null); presenter.proposeSort(['s2', 's1'])
    expect(store.reorderStations).not.toHaveBeenCalled()
    expect(presenter.endSort(true)).toBe(true)
    expect(presenter.endSort(true)).toBe(false)
    expect(store.reorderStations).toHaveBeenCalledExactlyOnceWith([{ id: 's2' }, { id: 's1' }])
    expect(store.session.activeStationId).toBe('s1')
  })
  it('stores live display permutations without mutating groups/members, rejects cross-group and context changes', () => {
    const { presenter, store, prefs } = setup()
    const original = JSON.stringify(store.activeBinding)
    presenter.startSort('stations', 'g1'); presenter.proposeSort(['s2', 's1']); expect(presenter.endSort(true)).toBe(true)
    expect(presenter.groups[0]!.stations.map(item => item.id)).toEqual(['s2', 's1'])
    presenter.startSort('stations', 'g1'); presenter.proposeSort(['s3', 's1']); expect(presenter.endSort(true)).toBe(false)
    presenter.startSort('groups', null); presenter.proposeSort(['g2', 'g1']); expect(presenter.endSort(true)).toBe(true)
    expect(presenter.groups.map(group => group.id)).toEqual(['g2', 'g1'])
    expect(JSON.stringify(store.activeBinding)).toBe(original)
    expect(prefs.context('live', 'binding-a')?.stationOrderByGroup.g1).toEqual(['s2', 's1'])
    presenter.startSort('groups', null); presenter.proposeSort(['g1', 'g2']); store.activeBinding.gameGuid = 'b'; store.loadedBindingGameGuid = 'b'
    expect(presenter.endSort(true)).toBe(false)
    presenter.toggleCollapsed(); expect(presenter.startSort('groups', null)).toBe(false)
    presenter.toggleCollapsed(); presenter.setQuery('Ore'); expect(presenter.startSort('stations', 'g1')).toBe(false)
  })
  it('uses stable identity for pinned shortcuts, keeps original membership, clears invalid pins after load and isolates contexts', async () => {
    const { presenter, store, prefs } = setup()
    presenter.togglePin('s1'); expect(presenter.pinnedItems.map(item => item.id)).toEqual(['s1'])
    expect(presenter.groups[0]!.stations[0]!.active).toBe(presenter.pinnedItems[0]!.active)
    expect(presenter.groups[0]!.stations).toHaveLength(2)
    presenter.select(presenter.pinnedItems[0]!.id); expect(store.selectStation).toHaveBeenCalledWith('s1')
    presenter.togglePin('s1'); expect(presenter.pinnedItems).toEqual([])
    presenter.togglePin('s1'); store.isReady = false; store.orderedStationsBySector = []
    await nextTick(); expect(prefs.context('live', 'binding-a')?.pinnedStationIds).toEqual(['s1'])
    store.isReady = true; await nextTick(); expect(presenter.pinnedItems).toEqual([])
    expect(prefs.context('live', 'binding-a')?.pinnedStationIds).toEqual([])
    expect(presenter.fixedItems.every(item => item.status === null)).toBe(true)
  })
  it('switches at 768px, navigation closes drawer but menus/editor/collapse retain desktop preferences and cleans interaction on dispose', () => {
    const { presenter, prefs, scope } = setup()
    prefs.setMode('live', { expandedWidth: 333, collapsed: true })
    presenter.setViewport(767); expect(presenter.narrowScreen).toBe(true); expect(presenter.compact).toBe(false)
    presenter.toggleCollapsed(); expect(presenter.drawerOpen).toBe(true)
    presenter.openMenu('s1'); expect(presenter.drawerOpen).toBe(true)
    presenter.openGroupEditor('g1'); presenter.toggleGroup('g1'); expect(presenter.drawerOpen).toBe(true)
    expect(presenter.startResize(1, 0)).toBe(false)
    presenter.select('s1'); expect(presenter.drawerOpen).toBe(false)
    presenter.setViewport(768); expect(presenter.width).toBe(64)
    presenter.toggleCollapsed(); expect(presenter.width).toBe(333)
    presenter.startResize(2, 0); presenter.moveResize(2, 30)
    scope.stop(); expect(prefs.state.modes.live.expandedWidth).toBe(333)
    expect(presenter.endSort(true)).toBe(false)
  })
})


describe('desktop hover overlay', () => {
  it.each(['blueprint', 'live'] as const)('uses the remembered expanded width over a 64px layout rail in %s without persisting hover', mode => {
    const { presenter, prefs, store } = setup(mode)
    prefs.setMode(mode, { collapsed: true, expandedWidth: mode === 'blueprint' ? 310 : 333 })
    const saved = localStorage.getItem('x4_production_sidebar')
    const groups = presenter.groups.map(group => group.expanded)
    presenter.enterHover('touch'); expect(presenter.width).toBe(64)
    presenter.enterHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
    expect(presenter.compact).toBe(false)
    expect(presenter.width).toBe(mode === 'blueprint' ? 310 : 333)
    expect(presenter.layoutWidth).toBe(64)
    expect(presenter.collapsed).toBe(true)
    presenter.leaveHover('touch'); expect(presenter.hoverExpanded).toBe(true)
    presenter.leaveHover('mouse')
    expect(presenter.width).toBe(64)
    expect(presenter.groups.map(group => group.expanded)).toEqual(groups)
    expect(store.selectStation).not.toHaveBeenCalled()
    expect(localStorage.getItem('x4_production_sidebar')).toBe(saved)
  })

  it('pins hover expansion and suppresses reopening after manual collapse until pointer reentry', () => {
    const { presenter, prefs } = setup()
    prefs.setMode('live', { collapsed: true, expandedWidth: 310 })
    presenter.enterHover('mouse'); presenter.toggleCollapsed(); presenter.leaveHover('mouse')
    expect(presenter.collapsed).toBe(false)
    expect(presenter.layoutWidth).toBe(310)
    expect(presenter.width).toBe(310)
    presenter.enterHover('mouse'); presenter.toggleCollapsed()
    expect(presenter.compact).toBe(true)
    presenter.enterHover('mouse'); expect(presenter.hoverExpanded).toBe(false)
    presenter.leaveHover('mouse'); presenter.enterHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
  })

  it('holds search, menus, group editor and delete confirmation until each interaction finishes', () => {
    const { presenter, prefs } = setup()
    prefs.setMode('live', { collapsed: true })
    presenter.enterHover('mouse'); presenter.setSearchFocused(true); presenter.setQuery('Ore'); presenter.leaveHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
    presenter.setSearchFocused(false); expect(presenter.compact).toBe(true)
    expect(presenter.query).toBe('Ore')
    presenter.setQuery(''); presenter.enterHover('mouse'); presenter.openMenu('s1'); presenter.leaveHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
    presenter.closeOverlays(); expect(presenter.compact).toBe(true)
    presenter.enterHover('mouse'); presenter.openGroupEditor('g1'); presenter.leaveHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
    presenter.closeOverlays(); expect(presenter.compact).toBe(true)
    presenter.enterHover('mouse'); presenter.openMenu('s2'); presenter.runMenuAction('delete'); presenter.leaveHover('mouse')
    expect(presenter.pendingDelete).not.toBeNull()
    expect(presenter.hoverExpanded).toBe(true)
    presenter.cancelDelete(); expect(presenter.compact).toBe(true)
  })

  it('holds resizing outside the rail, commits remembered width once, and cancels without saving', () => {
    const { presenter, prefs } = setup()
    prefs.setMode('live', { collapsed: true, expandedWidth: 310 })
    const write = vi.spyOn(prefs, 'setMode')
    presenter.enterHover('mouse'); expect(presenter.startResize(1, 310)).toBe(true)
    presenter.leaveHover('mouse'); presenter.moveResize(1, 360)
    expect(presenter.width).toBe(360)
    expect(presenter.layoutWidth).toBe(64)
    presenter.endResize(1, true); presenter.endResize(1, true)
    expect(write).toHaveBeenCalledExactlyOnceWith('live', { expandedWidth: 360 })
    expect(presenter.compact).toBe(true)
    presenter.enterHover('mouse'); expect(presenter.width).toBe(360)
    presenter.startResize(2, 360); presenter.moveResize(2, 400); presenter.leaveHover('mouse'); presenter.endResize(2, false)
    presenter.enterHover('mouse'); expect(presenter.width).toBe(360)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('holds sort outside the rail, rejects external release and commits a legal complete permutation once', () => {
    const { presenter, prefs, store } = setup('blueprint')
    prefs.setMode('blueprint', { collapsed: true })
    presenter.enterHover('mouse'); expect(presenter.startSort('stations', null)).toBe(true)
    presenter.proposeSort(['s2', 's1']); presenter.leaveHover('mouse')
    expect(presenter.hoverExpanded).toBe(true)
    expect(presenter.endSort(false)).toBe(false)
    expect(store.reorderStations).not.toHaveBeenCalled()
    expect(presenter.compact).toBe(true)
    presenter.enterHover('mouse'); presenter.startSort('stations', null); presenter.proposeSort(['s2', 's1'])
    presenter.leaveHover('mouse'); expect(presenter.endSort(true)).toBe(true)
    expect(store.reorderStations).toHaveBeenCalledExactlyOnceWith([{ id: 's2' }, { id: 's1' }])
    expect(presenter.compact).toBe(true)
    expect(presenter.endSort(true)).toBe(false)
    presenter.enterHover('mouse'); presenter.startSort('stations', null); presenter.leaveHover('mouse'); presenter.cancelInteraction()
    expect(presenter.compact).toBe(true)
  })

  it('resets hover across context, breakpoint, blur and disposal without changing desktop preferences', () => {
    const { presenter, prefs, store, scope } = setup()
    prefs.setMode('live', { collapsed: true, expandedWidth: 333 })
    presenter.enterHover('mouse'); store.activeBinding.gameGuid = 'other'; store.loadedBindingGameGuid = 'other'
    expect(presenter.hoverExpanded).toBe(false)
    presenter.enterHover('mouse'); presenter.setViewport(767)
    expect(presenter.layoutWidth).toBe(0)
    presenter.enterHover('mouse'); expect(presenter.hoverExpanded).toBe(false)
    presenter.setViewport(768); expect(presenter.width).toBe(64)
    presenter.enterHover('mouse'); presenter.openMenu('s1'); presenter.resetHover()
    expect(presenter.hoverExpanded).toBe(false)
    presenter.closeOverlays(); presenter.enterHover('mouse'); scope.stop()
    expect(presenter.hoverExpanded).toBe(false)
    expect(prefs.state.modes.live).toEqual({ collapsed: true, expandedWidth: 333 })
  })
})
