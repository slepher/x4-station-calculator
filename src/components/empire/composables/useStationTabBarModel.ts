import { computed, type Ref, type ComputedRef } from 'vue'
import type { StationPlan } from '@/types/x4'

interface StationTabItem {
  id: string
  name: string
  stationType?: StationPlan['type']
}

interface SimplifiedStationTabBarProps {
  tabs: StationTabItem[]
  activeTabId: string | null
  canCreateStation: boolean
  canOpenContextMenu: boolean
}

interface SimplifiedStationTabBarEmits {
  selectStation: (stationId: string) => void
  createStation: () => void
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => void
  deleteStation: (stationId: string) => void
}

export interface UseStationTabBarModelDeps {
  orderedStations: ComputedRef<StationPlan[]>
  activeStationId: Ref<string | null>
}

export interface UseStationTabBarModelReturn {
  props: ComputedRef<SimplifiedStationTabBarProps>
  emits: SimplifiedStationTabBarEmits
}

export function useStationTabBarModel(deps: UseStationTabBarModelDeps): UseStationTabBarModelReturn {
  const {
    orderedStations,
    activeStationId
  } = deps

  const tabs = computed<StationTabItem[]>(() => {
    return orderedStations.value.map((station) => ({
      id: station.id,
      name: station.name,
      stationType: station.type
    }))
  })

  const activeTabId = computed(() => {
    return activeStationId.value
  })

  const canCreateStation = computed(() => true)
  const canOpenContextMenu = computed(() => true)

  const props = computed<SimplifiedStationTabBarProps>(() => ({
    tabs: tabs.value,
    activeTabId: activeTabId.value,
    canCreateStation: canCreateStation.value,
    canOpenContextMenu: canOpenContextMenu.value
  }))

  const emits: SimplifiedStationTabBarEmits = {
    selectStation: (stationId: string) => {
      activeStationId.value = stationId
    },
    createStation: () => {
    },
    renameStation: (_stationId: string) => {
    },
    duplicateStation: (_stationId: string) => {
    },
    deleteStation: (_stationId: string) => {
    }
  }

  return {
    props,
    emits
  }
}