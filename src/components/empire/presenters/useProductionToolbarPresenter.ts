import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState } from '@/types/production-workbench-contract'
import type { StationType } from '@/types/x4'

export interface ToolbarPresenterProps {
  mode: ComputedRef<'overview' | 'station' | 'transit'>
  titleModel: ComputedRef<{ value: string; placeholder: string }>
  settings: ComputedRef<any>
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
  getTitleModel(): { value: string; placeholder: string }
  getToolbarSettings(): any
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
  updateStationCount(value: number): void
  toggleMineral(mineral: string): void
  updateSunlight(value: number): void
  updateTransportMinutes(value: number): void
  updateRacePreference(value: string): void
  updateWorkforce(value: boolean): void
  updateShowEmpireGaps(value: boolean): void
  openImport(): void
}

export function useProductionToolbarPresenter(store: ToolbarPresenterStore): UseProductionToolbarPresenterReturn {
  const props: ToolbarPresenterProps = {
    mode: computed(() => store.session.workbenchMode),
    titleModel: computed(() => store.getTitleModel()),
    settings: computed(() => store.getToolbarSettings()),
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

  const emits: ToolbarPresenterEmits = {
    updateTitle: (value: string) => store.updateTitle(value),
    updateStationName: (value: string) => store.updateStationName(value),
    updateStationType: (value) => store.updateStationType(value),
    updateStationCount: (value: number) => store.updateStationCount(value),
    toggleMineral: (mineral: string) => store.toggleMineral(mineral),
    updateSunlight: (value: number) => store.updateSunlight(value),
    updateTransportMinutes: (value: number) => store.updateTransportMinutes(value),
    updateRacePreference: (value: string) => store.updateRacePreference(value),
    updateWorkforce: (value: boolean) => store.updateWorkforce(value),
    updateShowEmpireGaps: (value: boolean) => store.updateShowEmpireGaps(value),
    openImport: () => store.openImport()
  }

  return { props, emits }
}
