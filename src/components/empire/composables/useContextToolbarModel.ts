import { computed, type Ref, type ComputedRef } from 'vue'
import type { StationPlan, StationSettings, StationType } from '@/types/x4'
import type { ContextToolbarProps, ContextToolbarEmits } from '@/types/production-ui'
import { useI18n } from 'vue-i18n'

export interface UseContextToolbarModelDeps {
  isBindingMode: ComputedRef<boolean>
  activeStation: ComputedRef<StationPlan | null>
  activeTransitSectorId: ComputedRef<string | null>
  sectors: ComputedRef<{ id: string; name: string }[]>
  settings: ComputedRef<StationSettings>
  activeBindingName: Ref<string>
  activeEmpireName: Ref<string>
  singleBerthThroughput: ComputedRef<number>
}

export interface UseContextToolbarModelReturn {
  props: ComputedRef<ContextToolbarProps>
  emits: ContextToolbarEmits
}

export function useContextToolbarModel(deps: UseContextToolbarModelDeps): UseContextToolbarModelReturn {
  const {
    isBindingMode,
    activeStation,
    activeTransitSectorId,
    sectors,
    settings,
    activeBindingName,
    activeEmpireName,
    singleBerthThroughput
  } = deps

  const { t } = useI18n()

  const mode = computed<'overview' | 'station' | 'transit'>(() => {
    if (activeTransitSectorId.value) return 'transit'
    if (activeStation.value) return 'station'
    return 'overview'
  })

  const isOverview = computed(() => mode.value === 'overview')
  const isSupplyOverview = computed(() => mode.value === 'transit')

  const activeSupplySector = computed(() => {
    if (!activeTransitSectorId.value) return null
    return sectors.value.find((sector) => sector.id === activeTransitSectorId.value) || null
  })

  const titleModel = computed(() => {
    if (isBindingMode.value && isOverview.value) {
      return {
        value: activeBindingName.value,
        placeholder: t('binding.new_binding_name')
      }
    }
    return {
      value: isSupplyOverview.value
        ? (activeSupplySector.value?.name || '')
        : (activeEmpireName.value || ''),
      placeholder: t('sector.new_sector_name')
    }
  })

  const station = computed(() => {
    if (!activeStation.value) return null
    return {
      id: activeStation.value.id,
      name: activeStation.value.name,
      type: activeStation.value.type || 'industrial',
      count: activeStation.value.count ?? 1,
      minerals: activeStation.value.minerals || []
    }
  })

  const settingsProps = computed(() => {
    if (mode.value === 'station') {
      return settings.value
    }
    if (mode.value === 'transit') {
      return {
        racePreference: settings.value.racePreference
      }
    }
    return null
  })

  const races = computed(() => [
    { value: 'argon', label: t('toolbar.races.argon') },
    { value: 'terran', label: t('toolbar.races.terran') },
    { value: 'teladi', label: t('toolbar.races.teladi') },
    { value: 'paranid', label: t('toolbar.races.paranid') },
    { value: 'split', label: t('toolbar.races.split') }
  ])

  const stationTypes = computed<{ value: StationType; label: string }[]>(() => [
    { value: 'industrial' as StationType, label: t('toolbar.station_types.industrial') },
    { value: 'supply' as StationType, label: t('toolbar.station_types.supply') },
    { value: 'transit' as StationType, label: t('toolbar.station_types.transit') },
    { value: 'shipyard' as StationType, label: t('toolbar.station_types.shipyard') }
  ])

  const availableMinerals = ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane']

  const props = computed<ContextToolbarProps>(() => {
    const modeValue = mode.value
    const stationValue = station.value
    const settingsPropsValue = settingsProps.value
    
    return {
      mode: modeValue,
      isBindingMode: isBindingMode.value,
      titleModel: titleModel.value,
      station: stationValue,
      settings: settingsPropsValue as any,
      races: races.value,
      stationTypes: stationTypes.value,
      availableMinerals,
      singleBerthThroughput: singleBerthThroughput.value
    }
  })

  const emits: ContextToolbarEmits = {
    updateTitle: (value: string) => {
      if (isBindingMode.value && isOverview.value) {
        activeBindingName.value = value
      } else if (isSupplyOverview.value && activeSupplySector.value) {
        // renameBindingSector should be handled by parent
      } else {
        activeEmpireName.value = value
      }
    },
    updateStationName: (_value: string) => {
      // Handled by parent
    },
    updateStationType: (_value: StationType) => {
      // Handled by parent
    },
    updateStationCount: (_value: number) => {
      // Handled by parent
    },
    toggleMineral: (_mineral: string) => {
      // Handled by parent
    },
    updateSunlight: (_value: number) => {
      // Handled by parent via settings update
    },
    updateTransportMinutes: (_value: number) => {
      // Handled by parent via settings update
    },
    updateRacePreference: (_value: string) => {
      // Handled by parent via settings update
    },
    updateWorkforce: (_value: boolean) => {
      // Handled by parent via settings update
    },
    updateShowEmpireGaps: (_value: boolean) => {
      // Handled by parent via settings update
    },
    openImport: () => {
      // Handled by parent
    }
  }

  return {
    props,
    emits
  }
}