import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { ContextToolbarEmits } from '@/types/production-ui'
import type { StationType } from '@/types/x4'

export interface ToolbarPresenterProps {
  mode: ComputedRef<'overview' | 'station' | 'transit'>
  isBindingMode: boolean
  titleModel: ComputedRef<{ value: string; placeholder: string }>
  station: ComputedRef<{
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null>
  settings: ComputedRef<any>
  races: Array<{ value: string; label: string }>
  stationTypes: Array<{ value: StationType; label: string }>
  availableMinerals: string[]
  singleBerthThroughput: ComputedRef<number>
}

export interface UseProductionToolbarPresenterReturn {
  props: ToolbarPresenterProps
  emits: ContextToolbarEmits
}

export function useProductionToolbarPresenter(store: ProductionWorkbenchStoreContract): UseProductionToolbarPresenterReturn {
  const props: ToolbarPresenterProps = {
    mode: computed(() => store.getWorkbenchMode()),
    isBindingMode: store.mode === 'live',
    titleModel: computed(() => store.getTitleModel()),
    station: computed(() => store.getToolbarStation()),
    settings: computed(() => store.getToolbarSettings()),
    races: store.getToolbarRaces(),
    stationTypes: store.getToolbarStationTypes(),
    availableMinerals: store.getAvailableMinerals(),
    singleBerthThroughput: computed(() => store.getSingleBerthThroughput())
  }

  const emits: ContextToolbarEmits = {
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