import type { X4Module, X4Ware, SaveBindingPlan, BindingStationPlan } from '@/types/x4'
import type { ArchiveStationData, PlayerStationRecord, SaveArchive } from '@/types/saveArchive'
import type { TradeMember, TradeStationFacts } from '@/store/logic/tradeAutoFill'
import { DEFAULT_STATION_SETTINGS } from '@/store/state/stationSettings'
import { CURRENT_PARSER_VERSION } from '@/workers/saveParser.post'

export const wares = Object.fromEntries(['hullparts', 'energycells', 'input', 'future'].map(id => [id, { id, volume: 1, transport: 'container', price: { min: 1, avg: 2, max: 3 } }])) as Record<string, X4Ware>
export const modules = {
  factory: { id: 'factory', macroId: 'factory_macro', group: 'production', type: 'production', method: 'default', race: 'argon', buildCost: { hullparts: 100 }, outputs: { hullparts: 10, energycells: 1 }, inputs: { input: 2 }, cycleTime: 60, workforce: { capacity: 0, needed: 0, maxBonus: 0 } },
  future: { id: 'future', macroId: 'future_macro', group: 'production', type: 'production', method: 'default', race: 'argon', buildCost: { energycells: 50 }, outputs: { future: 10 }, inputs: {}, cycleTime: 60, workforce: { capacity: 0, needed: 0, maxBonus: 0 } }
} as unknown as Record<string, X4Module>
export const makePlan = (): BindingStationPlan => ({ id: 'p', saveStationCode: 'AAA', groupId: 'a', name: 'Station', type: 'industrial', modules: [{ id: 'factory', count: 4 }], settings: { ...DEFAULT_STATION_SETTINGS, workforceAuto: false }, warePriority: { energycells: 1 } })
export const makeBinding = (): SaveBindingPlan => ({ gameGuid: 'g', selectedArchiveTime: 1, updatedAt: 0, stationPlans: [makePlan()], groups: [{ sectorMacro: 'a', name: 'A', order: 0, jumpRange: 0, coverageSectorMacros: [], tradeStation: { id: 'hub', name: 'Hub' } }] })
export const makeMember = (): TradeMember => ({ entityId: 'AAA', referenceId: 'station:p', name: 'Station', role: 'station', stationCode: 'AAA', sectorMacro: 'a', plan: makePlan() })
export const makeArchiveStation = (): ArchiveStationData => ({ code: 'AAA', sectorMacro: 'a', sector: { name: 'A', resources: [], sunlight: 100 }, modules: [{ id: 'factory', count: 1 }], building: { modules: [{ id: 'factory', count: 2 }], cargo: [{ ware: 'hullparts', amount: 20 }], reservation: [{ ware: 'hullparts', amount: 999 }], inProgressModule: { id: 'factory', count: 1 } }, cargo: [{ ware: 'hullparts', amount: 30 }] })
export const makeRecords = (): PlayerStationRecord[] => [
  { id: 's', archiveId: 'g_1', sectorMacro: 'a', code: 'AAA', type: 'station', data: { code: 'AAA', owner: 'player', macro: 'factory', buildstorage_code: 'BLD', modules: [{ ref: 'factory', module_id: 'factory', amount: 1 }], cargo: [{ ware: 'hullparts', amount: 30 }], position: { x: 0, y: 0, z: 0 }, relative_position: { x: 0, y: 0, z: 0 } } },
  { id: 'b', archiveId: 'g_1', sectorMacro: 'a', code: 'BLD', type: 'buildstorage', data: { code: 'BLD', owner: 'player', station_code: 'AAA', modules: [{ ref: 'factory', module_id: 'factory', amount: 2 }], cargo: [{ ware: 'hullparts', amount: 20 }], reservation: [{ ware: 'hullparts', amount: 999 }], constructions: [{ ref: 'factory' }], progress: { end: 20, sequenceindex: 0 } } }
] as PlayerStationRecord[]
export const makeSaveArchive = (): SaveArchive => ({ meta: { guid: 'g', time: 1, parser_version: CURRENT_PARSER_VERSION }, isValid: true, isCompatible: true, sectors: { a: { player_stations: { AAA: makeRecords()[0]!.data } } }, playerRelations: {} }) as unknown as SaveArchive
export const fact = (entityId: string, role: 'trade' | 'station', r = 0, b = 0, c = 0): TradeStationFacts => ({ entityId, role, requirements: { hullparts: r }, buildingStock: { hullparts: b }, stock: { hullparts: c }, producedWareIds: ['hullparts'], primaryWareIds: ['hullparts'] })
