import { describe, expect, it } from 'vitest'
import { resolveTradeMembers } from '@/store/logic/tradeAutoFill'
import type { SaveBindingPlan, BindingStationPlan } from '@/types/x4'
import type { PlayerStationRecord } from '@/types/saveArchive'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'

const record = (code: string, sectorMacro = 'a') => ({ code, sectorMacro, type: 'station', data: { code } }) as PlayerStationRecord
const plan = (id: string, code?: string): BindingStationPlan => ({ id, saveStationCode: code, name: '中转站', type: 'industrial', groupId: 'a', modules: [], settings: { ...DEFAULT_STATION_SETTINGS } })
const binding = (): SaveBindingPlan => ({ gameGuid: 'g', selectedArchiveTime: 1, updatedAt: 0, stationPlans: [], groups: [{ name: 'A', order: 0, sectorMacro: 'a', jumpRange: 0, coverageSectorMacros: [{ ref: 'b' }, { ref: 'b' }], connectedGroupIds: ['c'], tradeStation: { id: 'hub', name: 'Hub', saveStationCode: 'AAA' } }, { name: 'C', order: 1, sectorMacro: 'c', jumpRange: 0, coverageSectorMacros: [] }] })

describe('confirmed trade station membership', () => {
  it('deduplicates plan, archive and trade references with trade identity priority', () => {
    const b = binding(); b.stationPlans = [plan('p', 'AAA')]
    const result = resolveTradeMembers(b, 'a', [record('AAA'), record('BBB', 'b'), record('CCC', 'c')])
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.members.map(m => [m.entityId, m.role])).toEqual([['AAA', 'trade'], ['BBB', 'station']])
    expect(result.members[0]!.referenceId).toBe('station:p')
  })
  it('uses explicit virtual plans and never promotes a named station to trade', () => {
    const b = binding(); b.groups[0]!.tradeStation!.saveStationCode = undefined; b.stationPlans = [plan('trade:fake')]
    const r = resolveTradeMembers(b, 'a', [])
    expect(r.status).toBe('ready')
    if (r.status === 'ready') expect(r.members.map(m => [m.entityId, m.role])).toEqual([['trade:fake', 'station'], ['hub', 'trade']])
  })
  it('does not turn a missing real reference into a virtual station', () => {
    expect(resolveTradeMembers(binding(), 'a', []).status).toBe('unavailable')
  })
  it('rejects ambiguous coverage but respects a confirmed explicit plan owner', () => {
    const b = binding(); b.groups[1]!.coverageSectorMacros = [{ ref: 'b' }]
    expect(resolveTradeMembers(b, 'a', [record('AAA'), record('BBB', 'b')]).status).toBe('unavailable')
    b.stationPlans = [plan('p', 'BBB')]
    const r = resolveTradeMembers(b, 'a', [record('AAA'), record('BBB', 'b')])
    expect(r.status).toBe('ready')
    if (r.status === 'ready') expect(r.members).toHaveLength(2)
  })
  it('rejects conflicting confirmed ownership and multiple plans for one actual entity', () => {
    const b = binding(); const p = plan('p', 'AAA'); p.groupId = 'c'; b.stationPlans = [p]
    expect(resolveTradeMembers(b, 'a', [record('AAA')]).status).toBe('unavailable')
    b.stationPlans = [plan('p', 'AAA'), plan('q', 'AAA')]
    expect(resolveTradeMembers(b, 'a', [record('AAA')]).status).toBe('unavailable')
  })
})

it('retains the configured actual trade station name when no station plan exists', () => {
  const r = resolveTradeMembers(binding(), 'a', [record('AAA')])
  expect(r.status === 'ready' && r.members[0]!.name).toBe('Hub')
})

it('rejects duplicate confirmed plan IDs and group anchors', () => {
  const b = binding(); b.stationPlans = [plan('p'), plan('p')]
  expect(resolveTradeMembers(b, 'a', [record('AAA')])).toMatchObject({ status: 'unavailable', reason: 'ownership' })
  b.stationPlans = []; b.groups.push({ ...b.groups[0]! })
  expect(resolveTradeMembers(b, 'a', [record('AAA')])).toMatchObject({ status: 'unavailable', reason: 'ownership' })
})
