import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ProductionContextState, ProductionSessionState, ProductionStationState } from '@/types/production-workbench-contract'
import type { SavedModule, StationSettings, StationType, BindingSectorGroup } from '@/types/x4'
import type { ArchiveStationData } from '@/types/saveArchive'
import type { BindingStationPlan, TradeStationBinding } from '@/types/x4'
import i18n from '@/i18n'

export interface ToolbarPresenterProps {
  workbenchMode: ComputedRef<'overview' | 'station' | 'transit' | 'terraforming' | 'tech-tree' | 'research' | 'blueprint-recipe'>
  mode: ComputedRef<'planning' | 'live'>
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
  hasBinding: ComputedRef<boolean>
  hasArchive: ComputedRef<boolean>
  hasActiveBinding: ComputedRef<boolean>
  canToggle: ComputedRef<boolean>
  showImportModal: Ref<boolean>
  importStationId: ComputedRef<string | null>
  importStation: ComputedRef<{ id: string; modules: SavedModule[] } | null>
  isImportOverview: ComputedRef<boolean>
  createImportStation: (name: string, type?: StationType) => { id: string; modules: SavedModule[] } | null
  applyImportedStationPayload: (stationId: string, payload: {
    modules: SavedModule[]
    lockedWares: string[]
    warePriority: Record<string, number>
  }) => void
  updateImportStationModules: (stationId: string, modules: SavedModule[]) => void
  getImportStationById: (stationId: string) => { id: string; modules: SavedModule[] } | null
  moduleScope: ComputedRef<'built' | 'building' | 'all'>
  hasBuildingModules: ComputedRef<boolean>
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
  toggleMode: () => void
  closeImport: () => void
  cycleModuleScope: () => void
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
  archiveStation?: ArchiveStationData | null
  bindingStation?: BindingStationPlan | TradeStationBinding | null
  activeBinding?: { gameGuid: string; groups?: BindingSectorGroup[] } | null
  updateBindingGroupName?: (sectorId: string, name: string) => void
  toggleMode?: () => void
  createStation?: (name: string, type?: StationType) => unknown
  activeStationId?: string | null
  getStationById?: (stationId: string) => { id: string; modules: SavedModule[] } | null
  applyImportedStationPayload?: (stationId: string, payload: {
    modules: SavedModule[]
    lockedWares: string[]
    warePriority: Record<string, number>
  }) => void
  updateStationModules?: (stationId: string, modules: SavedModule[]) => void
  moduleScope?: 'built' | 'building' | 'all'
  hasBuildingModules?: boolean
  cycleModuleScope?: () => void
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

  const showImportModal = ref(false)

  const importStation = computed<{ id: string; modules: SavedModule[] } | null>(() => {
    const station = store.stationState
    if (!station || station.entityType !== 'station') return null
    return {
      id: station.id,
      modules: station.plannedModules
    }
  })

  const createImportStation = (name: string, type?: StationType) => {
    const created = store.createStation?.(name, type)
    if (!created) return null
    if (typeof created === 'string') {
      return store.getStationById?.(created) || null
    }
    if (typeof created === 'object' && 'id' in created && typeof created.id === 'string') {
      return store.getStationById?.(created.id) || null
    }
    return null
  }

  const props: ToolbarPresenterProps = {
    workbenchMode: computed(() => store.session.workbenchMode),
    mode: computed(() => store.session.mode),
    titleModel: computed(() => {
      if (store.session.workbenchMode === 'transit' && store.activeBinding?.groups) {
        const group = store.activeBinding.groups.find(g => g.id === store.session.activeTransitSectorId)
        if (group) return { value: group.name, placeholder: store.titlePlaceholder }
      }
      return { value: store.titleValue, placeholder: store.titlePlaceholder }
    }),
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
    singleBerthThroughput: computed(() => Math.max(1, store.stationState?.settings.transportShipCapacity || 1) * 15),
    hasBinding: computed(() => store.bindingStation != null),
    hasArchive: computed(() => store.archiveStation != null),
    hasActiveBinding: computed(() => store.activeBinding != null),
    canToggle: computed(() => store.session.canToggle),
    showImportModal,
    importStationId: computed(() => store.session.activeStationId),
    importStation,
    isImportOverview: computed(() => store.session.workbenchMode === 'overview'),
    createImportStation,
    applyImportedStationPayload: (stationId, payload) => store.applyImportedStationPayload?.(stationId, payload),
    updateImportStationModules: (stationId, modules) => store.updateStationModules?.(stationId, modules),
    getImportStationById: (stationId) => store.getStationById?.(stationId) || null,
    moduleScope: computed(() => store.moduleScope ?? 'built'),
    hasBuildingModules: computed(() => store.hasBuildingModules ?? false)
  }

  const dummyThrow = (method: string) => () => {
    throw new Error(`Method ${method} not implemented in this mode`)
  }

  const emits: ToolbarPresenterEmits = {
    updateTitle: (value: string) => {
      if (store.session.workbenchMode === 'transit' && store.session.activeTransitSectorId) {
        store.updateBindingGroupName?.(store.session.activeTransitSectorId, value)
      } else {
        store.updateTitle(value)
      }
    },
    updateStationName: (value: string) => store.updateStationName(value),
    updateStationType: (value) => store.updateStationType(value),
    updateStationCount: (value: number) => (store.updateStationCount || dummyThrow('updateStationCount'))(value),
    toggleMineral: (mineral: string) => (store.toggleMineral || dummyThrow('toggleMineral'))(mineral),
    updateSunlight: (value: number) => store.settingActions.updateSunlight(value),
    updateTransportMinutes: (value: number) => store.settingActions.updateTransportMinutes(value),
    updateRacePreference: (value: string) => store.settingActions.updateRacePreference(value),
    updateWorkforce: (value: boolean) => store.settingActions.updateWorkforce(value),
    updateShowEmpireGaps: (value: boolean) => store.settingActions.updateShowEmpireGaps(value),
    openImport: () => { showImportModal.value = true },
    toggleMode: () => store.toggleMode?.(),
    closeImport: () => { showImportModal.value = false },
    cycleModuleScope: () => store.cycleModuleScope?.()
  }

  return { props, emits }
}
