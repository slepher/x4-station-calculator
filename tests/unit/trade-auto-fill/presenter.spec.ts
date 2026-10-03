// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import zh from '@/locales/zh-CN.json'
import NpcTradeWorkbench from '@/components/empire/NpcTradeWorkbench.vue'
import { useNpcTradePresenter } from '@/components/empire/presenters/useNpcTradePresenter'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useNpcTradeStore } from '@/store/useNpcTradeStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import type { X4Ship, LocalizedX4Ship } from '@/types/x4'
import type { GameDataFiles } from '@/store/logic/useGameData'
import type { PlayerShipEntry } from '@/types/saveArchive'
import { makeBinding, makeRecords, makeSaveArchive, modules, wares } from './fixtures'

vi.mock('@/db/saveArchiveDB', async importOriginal => ({ ...await importOriginal<typeof import('@/db/saveArchiveDB')>(), loadPlayerStationsFlatByArchiveId: vi.fn(() => new Promise(() => {})) }))
let scopes: EffectScope[] = []
const present = () => { const scope = effectScope(); scopes.push(scope); return scope.run(() => useNpcTradePresenter())! }
const select = (p: ReturnType<typeof present>) => { p.emits.selectPlayerStationGroup('a'); p.emits.selectPlayerStation('station:p') }

beforeEach(async () => {
  const game = useGameDataStore(); game.isReady = true; game.modulesMap = modules; game.waresMap = wares
  game.localizedWaresMap = Object.fromEntries(Object.entries(wares).map(([id, w]) => [id, { ...w, localeName: id, displayLabel: id, nameId: id, group: 'others', dlc_tag: 'base' }])) as typeof game.localizedWaresMap
  const binding = useSaveBindingStore(); binding.savedBindings.list = [makeBinding()]
  useActiveViewStore().activeBinding = 'g'; binding.draftBinding = makeBinding()
  const live = useLiveProductionStore(); useSaveStore().selectedArchive = makeSaveArchive()
  await nextTick()
  live.playerStationRecords = makeRecords(); live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
  useNpcTradeStore().direction = 'buy'
  i18n.global.setLocaleMessage('zh-CN', zh)
  i18n.global.locale.value = 'zh-CN'
})
afterEach(() => { scopes.forEach(s => s.stop()); scopes = []; vi.restoreAllMocks() })

describe('auto fill presenter', () => {
  it('allows the button with either checkbox state, replaces rather than appends and exposes scope/source/undo', () => {
    const p = present(); select(p)
    const store = useNpcTradeStore(); expect(store.autoFillEnabled).toBe(false)
    expect(p.props.autoFillAvailable.value).toBe(true); p.emits.autoFill()
    expect(store.targets).toEqual([{ wareId: 'hullparts', targetQty: 150 }])
    expect(p.props.autoFillScope.value).toContain('本站'); expect(p.props.autoFillCanUndo.value).toBe(true)
    expect(p.props.autoFillSource.value).toContain('空间站')
    p.emits.setAutoFillEnabled(true); p.emits.autoFill(); expect(store.targets).toHaveLength(1)
    p.emits.setAutoFillEnabled(false); expect(store.targets).toHaveLength(1)
  })
  it('triggers once on enabling and changing direction, never on same selection or query/sort/page/target edits', () => {
    const p = present(); select(p)
    const store = useNpcTradeStore(); const before = store.targetRevision
    p.emits.setAutoFillEnabled(true)
    const revision = store.targetRevision
    expect(revision).toBe(before + 1)
    p.emits.removeWare('hullparts'); p.emits.addWare('input'); p.emits.updateTargetQty('input', 8)
    const afterEdit = store.targetRevision
    p.emits.selectPlayerStation('station:p'); p.emits.selectPlayerStationGroup('a'); p.emits.setDirection('buy')
    p.emits.setSearchQuery('energy'); p.emits.setJumpLimit(2); p.emits.setRankMode('composite'); p.emits.setSortMetric('price'); p.emits.setPrimaryWare('input'); p.emits.setCandidatePage(1); p.emits.setShipPage(1)
    expect(store.targetRevision).toBe(afterEdit); expect(store.targets).toEqual([{ wareId: 'input', targetQty: 8 }])
    expect(afterEdit).toBeGreaterThan(revision)
    p.emits.setDirection('sell'); expect(store.targets).toEqual([])
    expect(store.targetRevision).toBe(afterEdit + 1)
  })
  it('marks disabled mode results stale and invalidates undo on a context round trip', () => {
    const p = present(); select(p); p.emits.autoFill()
    p.emits.setDirection('sell')
    expect(useNpcTradeStore().targets[0]!.targetQty).toBe(150); expect(p.props.autoFillStatus.value).toContain('条件已改变')
    expect(p.props.autoFillCanUndo.value).toBe(false)
    p.emits.setDirection('buy'); expect(p.props.autoFillCanUndo.value).toBe(false)
  })
  it('waits for initial selection and loading without applying an empty result', () => {
    const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null
    const p = present(); p.emits.addWare('input'); p.emits.updateTargetQty('input', 4)
    p.emits.setAutoFillEnabled(true); select(p)
    expect(p.props.autoFillAvailable.value).toBe(false); expect(p.props.autoFillDisabledReason.value).toContain('等待')
    expect(useNpcTradeStore().targets[0]!.wareId).toBe('input')
    live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
    expect(useNpcTradeStore().targets).toEqual([{ wareId: 'hullparts', targetQty: 150 }])
  })
  it('applies only the latest direction when loading completes and never resurrects a cancelled edit', () => {
    const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null
    const p = present(); select(p); p.emits.addWare('input'); p.emits.setAutoFillEnabled(true); p.emits.setDirection('sell')
    live.loadedTradeArchiveKey = JSON.stringify(['g', 1]); expect(useNpcTradeStore().targets).toEqual([])
    live.loadedTradeArchiveKey = null; p.emits.setDirection('buy'); p.emits.addWare('input'); p.emits.updateTargetQty('input', 7)
    live.loadedTradeArchiveKey = JSON.stringify(['g', 1]); expect(useNpcTradeStore().targets).toEqual([{ wareId: 'input', targetQty: 7 }]); expect(useNpcTradeStore().autoFillEnabled).toBe(true)
  })
  it('retains unavailable targets and handles only the latest snapshot after rapid changes', async () => {
    const p = present(); select(p); p.emits.autoFill(); p.emits.setAutoFillEnabled(true)
    const binding = useSaveBindingStore(); const save = useSaveStore(); const live = useLiveProductionStore()
    binding.draftBinding!.selectedArchiveTime = 2; binding.savedBindings.list[0]!.selectedArchiveTime = 2
    binding.draftBinding!.selectedArchiveTime = 3; binding.savedBindings.list[0]!.selectedArchiveTime = 3
    save.selectedArchive = { ...makeSaveArchive(), meta: { ...makeSaveArchive().meta, time: 2 } }
    await nextTick(); live.loadedTradeArchiveKey = JSON.stringify(['g', 2])
    expect(useNpcTradeStore().targets[0]!.targetQty).toBe(150)
    save.selectedArchive = { ...makeSaveArchive(), meta: { ...makeSaveArchive().meta, time: 3 } }
    await nextTick(); const records = makeRecords(); records.forEach(r => { r.archiveId = 'g_3' }); records[0]!.data.cargo = [{ ware: 'hullparts', amount: 190 }]; live.playerStationRecords = records
    live.loadedTradeArchiveKey = JSON.stringify(['g', 3]); expect(useNpcTradeStore().targets).toEqual([])
  })
  it('remounts without refilling manual changes and detects context changes made while away', () => {
    const p = present(); select(p); p.emits.setAutoFillEnabled(true); p.emits.removeWare('hullparts'); p.emits.addWare('input'); p.emits.updateTargetQty('input', 5)
    scopes[0]!.stop(); const revision = useNpcTradeStore().targetRevision
    const again = present(); expect(useNpcTradeStore().targetRevision).toBe(revision); expect(useNpcTradeStore().targets[0]!.wareId).toBe('input')
    expect(again.props.autoFillStatus.value).toContain('下次切换')
    scopes[1]!.stop(); useNpcTradeStore().direction = 'sell'; present(); expect(useNpcTradeStore().targets).toEqual([])
  })
  it('preserves a pending current request across remount and cancels it when edited while away', () => {
    const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null
    const p = present(); select(p); p.emits.setAutoFillEnabled(true); const id = useNpcTradeStore().pendingFill!.id
    scopes[0]!.stop(); present(); expect(useNpcTradeStore().pendingFill!.id).toBe(id)
    scopes[1]!.stop(); useNpcTradeStore().addWare('input'); live.loadedTradeArchiveKey = JSON.stringify(['g', 1]); present()
    expect(useNpcTradeStore().targets).toEqual([{ wareId: 'input', targetQty: null }])
  })
  it('labels an actual trade station only once and shows per-station applied building stock', () => {
    const binding = useSaveBindingStore(); binding.savedBindings.list[0]!.groups[0]!.tradeStation!.saveStationCode = 'AAA'
    const p = present(); select(p)
    expect(p.props.selectedStationOptions.value).toHaveLength(1)
    expect(p.props.selectedStationOptions.value[0]!.label).toBe('中转站 · a · Station')
    expect(p.props.autoFillScope.value).toContain('全组')
    p.emits.autoFill(); const detail = p.props.autoFillDetails.value.find(d => d.wareId === 'hullparts')!
    expect(detail.summary).toContain('实际抵扣 20'); expect(detail.stations).toHaveLength(1)
    p.emits.removeWare('hullparts'); expect(p.props.autoFillDetails.value.find(d => d.wareId === 'hullparts')!.currentLabel).toContain('已移除')
    expect(p.props.wareTargets.value).toEqual([])
  })
  it('keeps generated targets despite no NPC matches and shows adjusted quantities and empty reasons', () => {
    const p = present(); select(p); p.emits.autoFill()
    expect(p.props.pageState.value).toBe('noMatches'); expect(p.props.wareTargets.value[0]!.targetQty).toBe(150)
    p.emits.updateTargetQty('hullparts', 5)
    expect(p.props.autoFillStatus.value).toBe('已手动调整。'); expect(p.props.wareTargets.value[0]!.sourceLabel).toBe('已调整')
    expect(p.props.autoFillDetails.value.find(d => d.wareId === 'hullparts')!.summary).toContain('原建议 150')
    p.emits.setDirection('sell'); p.emits.autoFill(); expect(p.props.autoFillStatus.value).toBe('没有可出售盈余。')
  })
  it('leaves a new group unselected until the user chooses a valid child', () => {
    const binding = useSaveBindingStore()
    binding.savedBindings.list[0]!.groups.push({ name: 'B', sectorMacro: 'b', order: 1, jumpRange: 0, coverageSectorMacros: [], tradeStation: { id: 'hb', name: 'Hub B' } })
    const p = present(); select(p); p.emits.setAutoFillEnabled(true); p.emits.selectPlayerStationGroup('b')
    expect(p.props.selectedPlayerStationId.value).toBeNull(); expect(useNpcTradeStore().targets[0]!.targetQty).toBe(150)
    p.emits.selectPlayerStation('trade:1:hb'); expect(useNpcTradeStore().targets).toEqual([])
  })
  it('renders accessible controls with presenter events, disabled reasons, undo and folded details', async () => {
    const wrapper = mount(NpcTradeWorkbench, { global: { plugins: [i18n], stubs: { X4NumberInput: true } } })
    expect(wrapper.get('[data-testid="npc-trade-auto-fill-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="npc-trade-auto-fill-enabled"]').element.closest('label')!.textContent).toContain('随选择')
    await wrapper.get('[data-testid="npc-trade-player-station-group"]').setValue('a')
    await wrapper.get('[data-testid="npc-trade-player-station"]').setValue('station:p')
    await wrapper.get('[data-testid="npc-trade-auto-fill-button"]').trigger('click')
    expect(wrapper.find('[data-testid="npc-trade-auto-fill-undo"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="npc-trade-auto-fill-details"]').attributes('open')).toBeUndefined()
    await wrapper.get('[data-testid="npc-trade-auto-fill-enabled"]').setValue(true)
    expect(useNpcTradeStore().autoFillEnabled).toBe(true)
    await wrapper.get('[data-testid="npc-trade-remove-hullparts"]').trigger('click')
    expect(wrapper.get('[data-testid="npc-trade-auto-fill-status"]').text()).toContain('已手动调整')
    expect(wrapper.find('[data-testid="npc-trade-auto-fill-undo"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

it('isolates automatic session state when bindings change while the presenter is unmounted', () => {
  const p = present(); select(p); p.emits.setAutoFillEnabled(true); scopes[0]!.stop()
  const view = useActiveViewStore(); view.activeBinding = 'other'; view.activeBinding = 'g'
  expect(useNpcTradeStore().autoFillEnabled).toBe(false)
  expect(useNpcTradeStore().lastFill).toBeNull()
  expect(useNpcTradeStore().fillUndo).toBeNull()
})

it('preserves an archive-only selection during remount while the next snapshot records are loading', () => {
  const binding = useSaveBindingStore(); binding.savedBindings.list[0]!.stationPlans = []; binding.savedBindings.list[0]!.groups[0]!.tradeStation = undefined
  const p = present(); p.emits.selectPlayerStationGroup('a'); p.emits.selectPlayerStation('archive:AAA'); p.emits.setAutoFillEnabled(true)
  scopes[0]!.stop(); const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null; live.playerStationRecords = []
  const again = present()
  expect(again.props.selectedPlayerStationId.value).toBe('archive:AAA')
  live.playerStationRecords = makeRecords(); live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
  expect(useNpcTradeStore().targets).toEqual([{ wareId: 'hullparts', targetQty: 50 }])
})

it('keeps only the latest selected station request while waiting for records', () => {
  const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null
  const p = present(); select(p); p.emits.setAutoFillEnabled(true)
  p.emits.selectPlayerStation('trade:0:hub'); p.emits.selectPlayerStation('station:p')
  live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
  expect(useNpcTradeStore().targets).toEqual([{ wareId: 'hullparts', targetQty: 150 }])
  expect(p.props.autoFillScope.value).toContain('本站')
})

it('shows unavailable status for lost data and preserves manual edits when confirmed facts change', () => {
  const p = present(); select(p); p.emits.setAutoFillEnabled(true); p.emits.updateTargetQty('hullparts', 7)
  useSaveBindingStore().savedBindings.list[0]!.stationPlans[0]!.modules = [{ id: 'factory', count: 10 }]
  expect(useNpcTradeStore().targets[0]!.targetQty).toBe(7)
  useLiveProductionStore().loadedTradeArchiveKey = null
  expect(p.props.autoFillStatus.value).toContain('未更新')
  expect(useNpcTradeStore().targets[0]!.targetQty).toBe(7)
})

it('reports all four scopes and distinguishes satisfied construction from no sale surplus', () => {
  const p = present(); select(p)
  expect(p.props.autoFillScope.value).toContain('本站建筑')
  p.emits.setDirection('sell'); expect(p.props.autoFillScope.value).toContain('本站主产物')
  p.emits.selectPlayerStation('trade:0:hub'); expect(p.props.autoFillScope.value).toContain('全组主产物')
  p.emits.setDirection('buy'); expect(p.props.autoFillScope.value).toContain('全组建筑')
  const records = makeRecords(); records[0]!.data.cargo = [{ ware: 'hullparts', amount: 1000 }]; useLiveProductionStore().playerStationRecords = records
  p.emits.autoFill(); expect(p.props.autoFillStatus.value).toBe('建筑材料已满足。')
})

it('renders exact building stock versus applied material and supports presenter undo', () => {
  const records = makeRecords(); records[1]!.data.cargo = [{ ware: 'hullparts', amount: 300 }]; useLiveProductionStore().playerStationRecords = records
  const p = present(); select(p); p.emits.addWare('input'); p.emits.updateTargetQty('input', 8); p.emits.autoFill()
  const item = p.props.autoFillDetails.value.find(d => d.wareId === 'hullparts')!
  expect(item.summary).toContain('已入库 300'); expect(item.summary).toContain('实际抵扣 200')
  p.emits.undoAutoFill(); expect(useNpcTradeStore().targets).toEqual([{ wareId: 'input', targetQty: 8 }]); expect(p.props.autoFillCanUndo.value).toBe(false)
})


function installTransportShips() {
  const game = useGameDataStore()
  game.ships = [
    { id: 'heron', macro: 'heron_macro', class: 'ship_l', type: 'freighter', cargo: [{ type: 'container', capacity: 62000 }] },
    { id: 'other', macro: 'other_macro', class: 'ship_m', type: 'transporter', cargo: [{ type: 'container', capacity: 12000 }] },
    { id: 'miner', macro: 'miner_macro', class: 'ship_l', type: 'miner', cargo: [{ type: 'container', capacity: 90000 }] }
  ] as X4Ship[]
  game.localizedShipsMap = Object.fromEntries(game.ships.map(ship => [ship.id, { ...ship, localeName: '苍鹭 改进型' }])) as Record<string, LocalizedX4Ship>
  game.gameData = { shipTypes: [{ id: 'freighter', nameId: '', name: '货船' }, { id: 'transporter', nameId: '', name: '运输船' }] } as GameDataFiles
  game.localizedWaresMap.input!.volume = 3
  const ship = (id: string, macro = 'heron_macro'): PlayerShipEntry => ({
    component_id: id, code: id, name: id, macro, class: 'ship_l',
    relative_position: { x: 0, y: 0, z: 0 }, assignment: { state: 'none' },
    default_order: { id: 'wait', order: 'Wait', failed: false }, is_repeat: false,
    cargo: [{ ware: 'hullparts', amount: 500 }]
  })
  const archive = makeSaveArchive()
  for (let index = 0; index < 11; index++) {
    const sector = index === 0 ? 'a' : 'sector-' + index
    archive.sectors[sector] = { player_ships: { ['ship-' + index]: ship('ship-' + index) } } as typeof archive.sectors[string]
  }
  archive.sectors['sector-10']!.player_ships!.other = ship('other', 'other_macro')
  archive.sectors.a!.player_ships!.miner = ship('miner', 'miner_macro')
  archive.sectors.a!.player_ships!.assigned = { ...ship('assigned', 'other_macro'), assignment: { state: 'resolved', commander_kind: 'station', commander_id: 'AAA' } }
  useSaveStore().selectedArchive = archive
}

it('deduplicates transport models across sectors before pagination and keeps distinct same-name macros', () => {
  installTransportShips()
  const p = present()
  expect(p.props.shipPageCount.value).toBe(2)
  expect(p.props.shipTypes.value.map(model => [model.macro, model.capacity])).toEqual([
    ['heron_macro', 62000], ['other_macro', 12000]
  ])
  expect(p.props.shipTypes.value.every(model => model.shipName === '苍鹭 改进型')).toBe(true)
  const models = p.props.shipTypes.value
  p.emits.setShipPage(2)
  expect(p.props.shipGroups.value).toHaveLength(1)
  expect(p.props.shipTypes.value).toBe(models)
  expect(p.props.shipGroups.value[0]!.ships[0]).not.toHaveProperty('capacity')
  expect(p.props.shipGroups.value[0]!.ships[0]).not.toHaveProperty('loadLimits')
})

it('updates model load limits for selected wares, preserves empty-hold capacity and follows ship filters', () => {
  installTransportShips()
  const p = present()
  expect(p.props.shipTypes.value[0]!.loadLimits).toEqual([])
  p.emits.addWare('hullparts'); p.emits.addWare('input'); p.emits.updateTargetQty('input', 1)
  expect(p.props.shipTypes.value[0]!.loadLimits.map(item => [item.wareId, item.maxAmount])).toEqual([
    ['hullparts', 62000], ['input', 20666]
  ])
  p.emits.removeWare('hullparts')
  expect(p.props.shipTypes.value[0]!.loadLimits.map(item => item.wareId)).toEqual(['input'])
  p.emits.removeWare('input')
  expect(p.props.shipTypes.value[0]!.loadLimits).toEqual([])
  const game = useGameDataStore()
  game.maps = { ...game.maps, clusters: { local: { sector_links: { self: { sector_a_id: 'a', sector_b_id: 'a' } } } } } as typeof game.maps
  select(p); p.emits.setJumpLimit(0)
  expect(p.props.shipTypes.value.map(model => model.macro)).toEqual(['heron_macro'])
  useSaveStore().selectedArchive = makeSaveArchive()
  expect(p.props.shipTypes.value).toEqual([])
})
