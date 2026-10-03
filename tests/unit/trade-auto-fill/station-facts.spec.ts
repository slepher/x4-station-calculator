// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { buildTradeStationFacts } from '@/store/logic/tradeAutoFill'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { wares, modules, makeMember, makeArchiveStation, makeBinding, makeRecords, makeSaveArchive } from './fixtures'

vi.mock('@/db/saveArchiveDB', async importOriginal => ({ ...await importOriginal<typeof import('@/db/saveArchiveDB')>(), loadPlayerStationsFlatByArchiveId: vi.fn(() => new Promise(() => {})) }))

const input = () => ({ member: makeMember(), archive: makeArchiveStation(), targetModules: [{ id: 'factory', count: 4 }], priorityLevels: { hullparts: 2, energycells: 1 }, modulesMap: modules, waresMap: wares })

describe('station facts', () => {
  it('excludes built and consumed construction while avoiding queued/target double counting', () => {
    const data = input()
    const r = buildTradeStationFacts(data)
    expect(r.status === 'ready' && r.facts.requirements).toEqual({ hullparts: 200 })
    data.targetModules = []
    const noPlan = buildTradeStationFacts(data)
    expect(noPlan.status === 'ready' && noPlan.facts.requirements).toEqual({ hullparts: 100 })
  })
  it('intersects resolved primary classification with built outputs only', () => {
    const data = input(); data.targetModules.push({ id: 'future', count: 1 }); data.priorityLevels = { hullparts: 2, energycells: 1, future: 2 } as typeof data.priorityLevels
    const r = buildTradeStationFacts(data)
    expect(r.status === 'ready' && r.facts.primaryWareIds).toEqual(['hullparts'])
    expect(r.status === 'ready' && r.facts.producedWareIds).toEqual(['hullparts', 'energycells'])
    expect(buildTradeStationFacts({ ...data, priorityLevels: null })).toMatchObject({ status: 'unavailable', reason: 'classification' })
    const empty = buildTradeStationFacts({ ...data, priorityLevels: { hullparts: 1, energycells: 1 } })
    expect(empty.status === 'ready' && empty.facts.primaryWareIds).toEqual([])
  })
  it('requires primary classification for actual trade stations too', () => {
    const data = input(); data.member.role = 'trade'
    expect(buildTradeStationFacts({ ...data, priorityLevels: null })).toMatchObject({ status: 'unavailable', reason: 'classification' })
  })
  it('keeps virtual plans distinct from missing real stations', () => {
    const data = input()
    expect(buildTradeStationFacts({ ...data, archive: null }).status).toBe('unavailable')
    data.member.stationCode = null
    const virtual = buildTradeStationFacts({ ...data, archive: null })
    expect(virtual.status === 'ready' && virtual.facts).toMatchObject({ requirements: { hullparts: 400 }, stock: {}, producedWareIds: [] })
    data.member.role = 'trade'
    const hub = buildTradeStationFacts({ ...data, archive: null })
    expect(hub.status === 'ready' && hub.facts.requirements).toEqual({})
  })
  it('rejects unknown module and build material mappings', () => {
    const data = input(); data.targetModules.push({ id: 'unknown', count: 1 })
    expect(buildTradeStationFacts(data)).toMatchObject({ status: 'unavailable', reason: 'moduleUnknown' })
    const copy = structuredClone(modules); copy.factory!.buildCost.unknown = 20
    expect(buildTradeStationFacts({ ...input(), modulesMap: copy })).toMatchObject({ status: 'unavailable', reason: 'wareUnknown' })
  })
})

describe('explicit live store fact reader', () => {
  beforeEach(async () => {
    const game = useGameDataStore(); game.isReady = true; game.modulesMap = modules; game.waresMap = wares
    const binding = useSaveBindingStore(); binding.savedBindings.list = [makeBinding()]
    useActiveViewStore().activeBinding = 'g'; binding.draftBinding = makeBinding()
    const live = useLiveProductionStore()
    useSaveStore().selectedArchive = makeSaveArchive()
    await nextTick()
    live.playerStationRecords = makeRecords(); live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
  })
  it('reads canonical confirmed targets without modifying station or view selection', () => {
    const live = useLiveProductionStore(); const binding = useSaveBindingStore()
    binding.draftBinding!.stationPlans[0]!.modules = [{ id: 'factory', count: 999 }]
    const before = [live.activeStationId, live.mode, live.visualMode, live.workbenchMode]
    const r = live.getTradeAutoFill('a', 'AAA', 'buy')
    expect(r.status).toBe('ready')
    if (r.status === 'ready') expect(r.targets).toEqual([{ wareId: 'hullparts', targetQty: 150 }])
    expect([live.activeStationId, live.mode, live.visualMode, live.workbenchMode]).toEqual(before)
    live.mode = 'live'; live.visualMode = 'planning' as typeof live.visualMode
    expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toEqual(r)
  })
  it('distinguishes loading/missing record from a complete empty inventory', () => {
    const live = useLiveProductionStore(); live.loadedTradeArchiveKey = null
    expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'loading' })
    live.loadedTradeArchiveKey = JSON.stringify(['g', 1]); live.playerStationRecords = []
    expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'stationMissing' })
    const records = makeRecords(); (records[0]!.data).cargo = []; (records[1]!.data).cargo = []
    live.playerStationRecords = records
    expect(live.getTradeAutoFill('a', 'AAA', 'buy').status).toBe('ready')
  })
  it('requires matching binding, expected snapshot and parser compatibility', () => {
    const live = useLiveProductionStore(); const save = useSaveStore(); const archive = save.selectedArchive!
    archive.meta.guid = 'other'
    expect(live.getTradeAutoFill('a', 'AAA', 'buy').status).toBe('unavailable')
    archive.meta.guid = 'g'; archive.meta.time = 2
    expect(live.getTradeAutoFill('a', 'AAA', 'buy').status).toBe('unavailable')
    archive.meta.time = 1; archive.isCompatible = false
    expect(live.getTradeAutoFill('a', 'AAA', 'buy').status).toBe('unavailable')
  })
  it('does not silently skip unmapped modules or missing owned build storage', () => {
    const live = useLiveProductionStore(); live.playerStationRecords = [makeRecords()[0]!]
    expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'storageMissing' })
    const records = makeRecords(); (records[0]!.data).modules![0]!.module_id = undefined; live.playerStationRecords = records
    expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'moduleUnknown' })
  })
  it('sells only resolved main outputs for actual and virtual hubs and respects priority overrides', () => {
    const live = useLiveProductionStore(); const binding = useSaveBindingStore()
    const records = makeRecords(); records[0]!.data.cargo = [{ ware: 'hullparts', amount: 1000 }, { ware: 'energycells', amount: 888 }, { ware: 'future', amount: 777 }]; live.playerStationRecords = records
    const confirmed = binding.savedBindings.list[0]!
    confirmed.stationPlans[0]!.modules.push({ id: 'future', count: 1 })
    const virtualHub = live.getTradeAutoFill('a', 'hub', 'sell')
    expect(virtualHub.status === 'ready' && virtualHub.targets).toEqual([{ wareId: 'hullparts', targetQty: 820 }])
    confirmed.groups[0]!.tradeStation!.saveStationCode = 'AAA'
    const actualHub = live.getTradeAutoFill('a', 'AAA', 'sell')
    expect(actualHub.status === 'ready' && actualHub.targets).toEqual(virtualHub.status === 'ready' && virtualHub.targets)
    confirmed.stationPlans[0]!.warePriority = { hullparts: 1, energycells: 2 }
    const updated = live.getTradeAutoFill('a', 'AAA', 'sell')
    expect(updated.status === 'ready' && updated.targets).toEqual([{ wareId: 'energycells', targetQty: 838 }])
  })
  it('uses archive queued modules when an actual station has no plan', () => {
    useSaveBindingStore().savedBindings.list[0]!.stationPlans = []
    const r = useLiveProductionStore().getTradeAutoFill('a', 'AAA', 'buy')
    expect(r.status === 'ready' && r.targets).toEqual([{ wareId: 'hullparts', targetQty: 50 }])
  })
})

it('keeps confirmed virtual planning demand and excludes un-applied group drafts', async () => {
  const game = useGameDataStore(); game.isReady = true; game.modulesMap = modules; game.waresMap = wares
  const binding = useSaveBindingStore(); const confirmed = makeBinding(); confirmed.stationPlans[0]!.saveStationCode = undefined
  binding.savedBindings.list = [confirmed]; useActiveViewStore().activeBinding = 'g'; binding.draftBinding = makeBinding()
  const live = useLiveProductionStore(); useSaveStore().selectedArchive = makeSaveArchive(); await nextTick()
  live.playerStationRecords = makeRecords(); live.loadedTradeArchiveKey = JSON.stringify(['g', 1])
  binding.draftBinding!.groups[0]!.coverageSectorMacros = [{ ref: 'unapplied' }]
  live.virtualStationDrafts = [{ ...confirmed.stationPlans[0]!, id: 'draft', modules: [{ id: 'factory', count: 999 }] }]
  const buy = live.getTradeAutoFill('a', 'p', 'buy')
  expect(buy.status === 'ready' && buy.targets).toEqual([{ wareId: 'hullparts', targetQty: 370 }])
  const sell = live.getTradeAutoFill('a', 'p', 'sell')
  expect(sell.status === 'ready' && sell.targets).toEqual([])
})

it('rejects inventory from a different snapshot and multiply referenced build storage', async () => {
  const game = useGameDataStore(); game.isReady = true; game.modulesMap = modules; game.waresMap = wares
  const binding = useSaveBindingStore(); binding.savedBindings.list = [makeBinding()]
  useActiveViewStore().activeBinding = 'g'; binding.draftBinding = makeBinding()
  const live = useLiveProductionStore(); useSaveStore().selectedArchive = makeSaveArchive(); await nextTick()
  live.loadedTradeArchiveKey = JSON.stringify(['g', 1]); const records = makeRecords(); records[0]!.archiveId = 'g_0'; live.playerStationRecords = records
  expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'context' })
  const complete = makeRecords(); complete.push({ ...complete[1]!, id: 'duplicate' }); live.playerStationRecords = complete
  expect(live.getTradeAutoFill('a', 'AAA', 'buy')).toMatchObject({ status: 'unavailable', reason: 'ownership' })
})
