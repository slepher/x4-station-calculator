import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchStoreContract } from '@/types/production-workbench-contract'
import type { ProductionTabItem, StationTabBarEmits } from '@/types/production-ui'

export interface TabbarPresenterProps {
  tabs: ComputedRef<ProductionTabItem[]>
  activeTabId: ComputedRef<string | null>
  expandedSectorId: ComputedRef<string | null>
  canCreateStation: boolean
  canOpenContextMenu: boolean
}

export interface UseProductionTabbarPresenterReturn {
  props: TabbarPresenterProps
  emits: StationTabBarEmits
}

export function useProductionTabbarPresenter(store: ProductionWorkbenchStoreContract): UseProductionTabbarPresenterReturn {
  const props: TabbarPresenterProps = {
    tabs: computed(() => store.getTabs()),
    activeTabId: computed(() => store.getActiveTabId()),
    expandedSectorId: computed(() => store.getExpandedSectorId()),
    canCreateStation: !store.capabilities.uniqueStation,
    canOpenContextMenu: !store.capabilities.uniqueStation
  }

  const emits: StationTabBarEmits = {
    selectOverview: () => store.selectOverview(),
    selectTransit: (sectorId: string) => store.selectTransit(sectorId),
    selectStation: (stationId: string) => store.selectStation(stationId),
    createStation: () => store.createStation(),
    renameStation: (stationId: string) => store.renameStation(stationId, ''),
    duplicateStation: (stationId: string) => store.duplicateStation(stationId),
    deleteStation: (stationId: string) => store.deleteStation(stationId),
    expandSector: (sectorId: string | null) => store.expandSector(sectorId)
  }

  return { props, emits }
}