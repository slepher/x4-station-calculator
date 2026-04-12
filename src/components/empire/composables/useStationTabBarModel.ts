import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type { StationPlan, SectorPlan } from '@/types/x4'
import type { ProductionTabItem, StationTabBarProps, StationTabBarEmits } from '@/types/production-ui'
import { fromTransitTabId, toTransitTabId } from '@/store/logic/empireSourceView'

export interface UseStationTabBarModelDeps {
  sectors: ComputedRef<SectorPlan[]>
  orderedStationsBySector: ComputedRef<StationPlan[]>
  activeStationId: Ref<string | null>
  isBindingMode: ComputedRef<boolean>
  getLinkedSectors: (sectorId: string) => string[]
}

export interface UseStationTabBarModelReturn {
  props: ComputedRef<StationTabBarProps>
  expandedSectorId: Ref<string | null>
  emits: StationTabBarEmits
}

export function useStationTabBarModel(deps: UseStationTabBarModelDeps): UseStationTabBarModelReturn {
  const {
    sectors,
    orderedStationsBySector,
    activeStationId,
    isBindingMode,
    getLinkedSectors
  } = deps

  const expandedSectorId = ref<string | null>(null)

  const activeTransitSectorId = computed(() => fromTransitTabId(activeStationId.value))

  const computeDefaultExpandedSectorId = (): string | null => {
    if (activeTransitSectorId.value) return activeTransitSectorId.value
    if (activeStationId.value) {
      const activeStation = orderedStationsBySector.value.find(s => s.id === activeStationId.value)
      return activeStation?.sectorId || null
    }
    return null
  }

  const tabGroups = computed(() => {
    const unassigned = orderedStationsBySector.value.filter((station) => !station.sectorId)
    const sectorGroups = sectors.value.map((sector) => ({
      id: sector.id,
      name: sector.name,
      stations: orderedStationsBySector.value.filter((station) => station.sectorId === sector.id)
    }))
    return {
      unassigned,
      sectorGroups
    }
  })

  const visibleSectorGroups = computed(() => {
    const stationCountBySector = new Map<string, number>()
    tabGroups.value.sectorGroups.forEach((group) => {
      stationCountBySector.set(group.id, group.stations.length)
    })

    return tabGroups.value.sectorGroups
      .map((group) => {
        const hasOwnStations = group.stations.length > 0
        const hasLinkedStations = getLinkedSectors(group.id)
          .some((linkedSectorId) => (stationCountBySector.get(linkedSectorId) ?? 0) > 0)
        return {
          ...group,
          showTransitTab: hasOwnStations || hasLinkedStations
        }
      })
      .filter((group) => group.showTransitTab || group.stations.length > 0)
  })

  const tabs = computed<ProductionTabItem[]>(() => {
    const result: ProductionTabItem[] = []

    result.push({
      id: 'overview',
      type: 'overview',
      name: ''
    })

    const unassigned = tabGroups.value.unassigned
    if (unassigned.length > 0) {
      unassigned.forEach((station) => {
        result.push({
          id: station.id,
          type: 'station',
          name: station.name,
          sectorId: station.sectorId ?? undefined,
          stationType: station.type
        })
      })
    }

    visibleSectorGroups.value.forEach((group) => {
      if (group.showTransitTab) {
        result.push({
          id: toTransitTabId(group.id),
          type: 'transit',
          name: group.name,
          sectorId: group.id
        })
      }

      if (expandedSectorId.value === group.id) {
        group.stations.forEach((station) => {
          result.push({
            id: station.id,
            type: 'station',
            name: station.name,
sectorId: station.sectorId ?? undefined,
            stationType: station.type
          })
        })
      }
    })

    return result
  })

  const activeTabId = computed(() => {
    if (activeTransitSectorId.value) {
      return toTransitTabId(activeTransitSectorId.value)
    }
    if (activeStationId.value) {
      return activeStationId.value
    }
    return 'overview'
  })

  const canCreateStation = computed(() => !isBindingMode.value)
  const canOpenContextMenu = computed(() => !isBindingMode.value)

  const props = computed<StationTabBarProps>(() => ({
    tabs: tabs.value,
    activeTabId: activeTabId.value,
    expandedSectorId: expandedSectorId.value,
    canCreateStation: canCreateStation.value,
    canOpenContextMenu: canOpenContextMenu.value
  }))

  const emits: StationTabBarEmits = {
    selectOverview: () => {
      activeStationId.value = null
      expandedSectorId.value = null
    },
    selectTransit: (sectorId: string) => {
      expandedSectorId.value = sectorId
      activeStationId.value = toTransitTabId(sectorId)
    },
    selectStation: (stationId: string) => {
      const station = orderedStationsBySector.value.find(s => s.id === stationId)
      if (station?.sectorId) {
        expandedSectorId.value = station.sectorId
      }
      activeStationId.value = stationId
    },
    createStation: () => {
      // This emit should be handled by the parent container
      // The actual createStation call is handled in ProductionWorkbenchView or MainWorkbench
    },
    renameStation: (_stationId: string) => {
      // This emit should be handled by the parent container
    },
    duplicateStation: (_stationId: string) => {
      // This emit should be handled by the parent container
    },
    deleteStation: (_stationId: string) => {
      // This emit should be handled by the parent container
    },
    expandSector: (sectorId: string | null) => {
      expandedSectorId.value = sectorId
    }
  }

  watch(
    [activeStationId, activeTransitSectorId, visibleSectorGroups],
    () => {
      const defaultSector = computeDefaultExpandedSectorId()
      if (defaultSector && visibleSectorGroups.value.some(g => g.id === defaultSector)) {
        expandedSectorId.value = defaultSector
      }
    },
    { immediate: true }
  )

  return {
    props,
    expandedSectorId,
    emits
  }
}