import type { StationSettings, X4Module, X4Ware } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'
import { deepClone } from '@/utils/deepClone'

export const DEFAULT_STATION_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: false,
  internalSupply: false,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1.0,
  primaryProductBufferHours: 12.0,
  secondaryProductBufferHours: 2.0,
  transportMinutes: 30,
  transportShipCapacity: 62000
}

export interface StationComputeDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  buildPriceMultiplier?: number
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}

export function migrateStationSettings(raw: Partial<StationSettings> | null | undefined): StationSettings {
  const source = deepClone(raw || {}) as any
  source.racePreference = source.racePreference || 'argon'
  if ('productBufferHours' in source) {
    const oldValue = source.productBufferHours
    source.primaryProductBufferHours = oldValue
    delete source.productBufferHours
  }
  source.primaryProductBufferHours = source.primaryProductBufferHours ?? 12.0
  source.secondaryProductBufferHours = source.secondaryProductBufferHours ?? 2.0
  source.resourceBufferHours = source.resourceBufferHours !== undefined ? source.resourceBufferHours : 2
  source.transportMinutes = source.transportMinutes ?? 30
  source.transportShipCapacity = source.transportShipCapacity ?? 62000
  source.showEmpireGaps = source.showEmpireGaps ?? false
  return { ...DEFAULT_STATION_SETTINGS, ...source }
}