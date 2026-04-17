import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { StationSettings, StationType } from '@/types/x4'

export interface ToolbarPresenterProps {
  mode: ComputedRef<'overview' | 'station' | 'transit'>
  titleModel: ComputedRef<{ value: string; placeholder: string }>
  settings: ComputedRef<StationSettings | null>
  station: ComputedRef<{
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null>
  stationCode: ComputedRef<string>
  sectorName: ComputedRef<string>
  sectorNameId: ComputedRef<string | undefined>
  position: ComputedRef<{ x: number; y: number; z: number } | undefined>
  sectorResources: ComputedRef<string[]>
  sectorSunlight: ComputedRef<number>
  races: Array<{ value: string; label: string }>
  stationTypes: Array<{ value: StationType; label: string }>
  availableMinerals: string[]
  singleBerthThroughput: ComputedRef<number>
}

export interface ToolbarPresenterEmits {
  updateTitle: (value: string) => void
  updateStationName: (value: string) => void
  updateStationType: (value: StationType) => void
  updateStationCount: (value: number) => void
  toggleMineral: (mineral: string) => void
  updateSunlight: (value: number) => void
  updateTransportMinutes: (value: number) => void
  updateRacePreference: (value: string) => void
  updateWorkforce: (value: boolean) => void
  updateShowEmpireGaps: (value: boolean) => void
  openImport: () => void
}

export interface UseProductionToolbarPresenterReturn {
  props: ToolbarPresenterProps
  emits: ToolbarPresenterEmits
}

export interface ToolbarPresenterStore {
  session: ProductionSessionState
  context: ProductionContextState
  stationState: ProductionStationState | null
  settingActions: {
    updateSunlight(value: number): void
    updateTransportMinutes(value: number): void
    updateRacePreference(value: string): void
    updateWorkforce(value: boolean): void
    updateShowEmpireGaps(value: boolean): void
  }
  getTitleModel(): { value: string; placeholder: string }
  getToolbarStation(): {
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null
  getToolbarRaces(): Array<{ value: string; label: string }>
  getToolbarStationTypes(): Array<{ value: StationType; label: string }>
  getAvailableMinerals(): string[]
  getSingleBerthThroughput(): number
  updateTitle(value: string): void
  updateStationName(value: string): void
  updateStationType(value: StationType): void
  updateStationCount?(value: number): void
  toggleMineral?(mineral: string): void
  openImport(): void
}

export function useProductionToolbarPresenter(store: ToolbarPresenterStore): UseProductionToolbarPresenterReturn {
  const props: ToolbarPresenterProps = {
    mode: computed(() => store.session.workbenchMode),
    titleModel: computed(() => store.getTitleModel()),
    settings: computed(() => store.stationState?.settings || null),
    station: computed(() => store.getToolbarStation()),
    stationCode: computed(() => store.context.stationCode),
    sectorName: computed(() => store.context.sectorName),
    sectorNameId: computed(() => store.context.sectorNameId),
    position: computed(() => store.context.position),
    sectorResources: computed(() => store.context.sectorResources),
    sectorSunlight: computed(() => store.context.sectorSunlight),
    races: store.getToolbarRaces(),
    stationTypes: store.getToolbarStationTypes(),
    availableMinerals: store.getAvailableMinerals(),
    singleBerthThroughput: computed(() => store.getSingleBerthThroughput())
  }

  const dummyThrow = (method: string) => () => {
    throw new Error(`Method ${method} not implemented in this mode`)
  }

  const emits: ToolbarPresenterEmits = {
    updateTitle: (value: string) => store.updateTitle(value),
    updateStationName: (value: string) => store.updateStationName(value),
    updateStationType: (value) => store.updateStationType(value),
    updateStationCount: (value: number) => (store.updateStationCount || dummyThrow('updateStationCount'))(value),
    toggleMineral: (mineral: string) => (store.toggleMineral || dummyThrow('toggleMineral'))(mineral),
    updateSunlight: (value: number) => store.settingActions.updateSunlight(value),
    updateTransportMinutes: (value: number) => store.settingActions.updateTransportMinutes(value),
    updateRacePreference: (value: string) => store.settingActions.updateRacePreference(value),
    updateWorkforce: (value: boolean) => store.settingActions.updateWorkforce(value),
    updateShowEmpireGaps: (value: boolean) => store.settingActions.updateShowEmpireGaps(value),
    openImport: () => store.openImport()
  }

  return { props, emits }
}