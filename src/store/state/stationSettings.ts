import type { StationSettings, X4Module, X4Ware } from '@/types/x4'
import type { RaceMedicalConsumption } from '@/types/x4'

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
  transportShipCapacity: 62000,
  enforceDlcActivation: false
}

export interface StationComputeDeps {
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  medicalConsumptionMap: RaceMedicalConsumption
  modulesByMacroId?: Record<string, X4Module>
  enforceDlcActivation?: boolean
  isModuleDlcActive?: (moduleId: string) => boolean
}
