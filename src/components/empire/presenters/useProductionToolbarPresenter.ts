import { computed, type ComputedRef } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { StationSettings, StationType } from '@/types/x4'
import i18n from '@/i18n'

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
  titleValue: string
  titlePlaceholder: string
  settingActions: {
    updateSunlight(value: number): void
    updateTransportMinutes(value: number): void
    updateRacePreference(value: string): void
    updateWorkforce(value: boolean): void
    updateShowEmpireGaps(value: boolean): void
  }
  updateTitle(value: string): void
  updateStationName(value: string): void
  updateStationType(value: StationType): void
  updateStationCount?(value: number): void
  toggleMineral?(mineral: string): void
}

export function useProductionToolbarPresenter(store: ToolbarPresenterStore): UseProductionToolbarPresenterReturn {
  const races = [
    { value: 'argon', label: i18n.global.t('toolbar.races.argon') },
    { value: 'terran', label: i18n.global.t('toolbar.races.terran') },
    { value: 'teladi', label: i18n.global.t('toolbar.races.teladi') },
    { value: 'paranid', label: i18n.global.t('toolbar.races.paranid') },
    { value: 'split', label: i18n.global.t('toolbar.races.split') }
  ]

  const stationTypes = [
    { value: 'industrial' as StationType, label: i18n.global.t('toolbar.station_types.industrial') },
    { value: 'supply' as StationType, label: i18n.global.t('toolbar.station_types.supply') },
    { value: 'transit' as StationType, label: i18n.global.t('toolbar.station_types.transit') },
    { value: 'shipyard' as StationType, label: i18n.global.t('toolbar.station_types.shipyard') }
  ]

  const availableMinerals = ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane']

  const props: ToolbarPresenterProps = {
    mode: computed(() => store.session.workbenchMode),
    titleModel: computed(() => ({
      value: store.titleValue,
      placeholder: store.titlePlaceholder
    })),
    settings: computed(() => store.stationState?.settings || null),
    station: computed(() => {
      const station = store.stationState
      if (!station) return null
      return {
        id: station.id,
        name: station.name,
        type: station.stationType || 'industrial',
        count: station.count ?? 1,
        minerals: station.minerals || []
      }
    }),
    stationCode: computed(() => store.context.stationCode),
    sectorName: computed(() => store.context.sectorName),
    sectorNameId: computed(() => store.context.sectorNameId),
    position: computed(() => store.context.position),
    sectorResources: computed(() => store.context.sectorResources),
    sectorSunlight: computed(() => store.context.sectorSunlight),
    races,
    stationTypes,
    availableMinerals,
    singleBerthThroughput: computed(() => Math.max(1, store.stationState?.settings.transportShipCapacity || 1) * 15)
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
    openImport: () => {}
  }

  return { props, emits }
}
