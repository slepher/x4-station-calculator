import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchCapabilities } from '@/types/production-workbench-contract'
import type { ProductionTabItem } from '@/types/production-ui'

export interface TabbarPresenterProps {
  tabs: ComputedRef<ProductionTabItem[]>
  activeTabId: ComputedRef<string | null>
  expandedSectorId: ComputedRef<string | null>
  canCreateStation: boolean
  canOpenContextMenu: boolean
}

export interface TabbarPresenterEmits {
  selectOverview: () => void
  selectTransit: (sectorId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => unknown
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => unknown
  deleteStation: (stationId: string) => void
  expandSector: (sectorId: string | null) => void
}

export interface UseProductionTabbarPresenterReturn {
  props: TabbarPresenterProps
  emits: TabbarPresenterEmits
}

export interface TabbarPresenterStore {
  capabilities: ProductionWorkbenchCapabilities
  getTabs(): ProductionTabItem[]
  getActiveTabId(): string | null
  getExpandedSectorId(): string | null
  selectOverview(): void
  selectTransit(sectorId: string): void
  selectStation(stationId: string): void
  createStation(name?: string): unknown
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): unknown
  deleteStation(stationId: string): void
  expandSector(sectorId: string | null): void
}

export function useProductionTabbarPresenter(store: TabbarPresenterStore): UseProductionTabbarPresenterReturn {
  const props: TabbarPresenterProps = {
    tabs: computed(() => store.getTabs()),
    activeTabId: computed(() => store.getActiveTabId()),
    expandedSectorId: computed(() => store.getExpandedSectorId()),
    canCreateStation: !store.capabilities.uniqueStation,
    canOpenContextMenu: !store.capabilities.uniqueStation
  }

  const emits: TabbarPresenterEmits = {
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
