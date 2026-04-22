import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchCapabilities } from '@/types/production-workbench-contract'
import type { ProductionTabItem } from '@/types/production-ui'
import type { StationType } from '@/types/x4'
import i18n from '@/i18n'

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
  session: {
    workbenchMode: 'overview' | 'station' | 'transit'
    activeStationId: string | null
    activeTransitSectorId: string | null
  }
  capabilities: ProductionWorkbenchCapabilities
  orderedStations?: Array<{
    id: string
    name: string
    sectorId?: string | null
    type?: StationType
    tag?: string
    factoryGroup?: string
  }>
  sectors?: Array<{
    id: string
    name: string
  }>
  orderedStationsBySector?: Array<{
    id: string
    name: string
    sectorId?: string | null
    type?: StationType
    tag?: string
    factoryGroup?: string
  }>
  tabSemanticsById?: Record<string, { tag?: string; factoryGroup?: string }>
  expandedSectorId?: string | null
  selectStation(stationId: string | null): void
  selectTransitSector?(sectorId: string | null): void
  createStation(name?: string): unknown
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): unknown
  deleteStation(stationId: string): void
  setExpandedSector?(sectorId: string | null): void
}

function getFallbackTagForStationType(type?: StationType): string | undefined {
  if (type === 'shipyard') return 'shipyard'
  if (type === 'supply' || type === 'transit') return 'tradestation'
  return undefined
}

function resolveTabSemantics(
  store: TabbarPresenterStore,
  station: {
    type?: StationType
    tag?: string
    factoryGroup?: string
  },
  stationId: string
) {
  const semantics = store.tabSemanticsById?.[stationId]
  const tag = semantics?.tag ?? station.tag ?? getFallbackTagForStationType(station.type)
  const factoryGroup = semantics?.factoryGroup ?? station.factoryGroup
  return { tag, factoryGroup }
}

export function useProductionTabbarPresenter(store: TabbarPresenterStore): UseProductionTabbarPresenterReturn {
  const tabs = computed<ProductionTabItem[]>(() => {
    if (!store.capabilities.hasSectors) {
      return (store.orderedStations || []).map((station) => ({
        id: station.id,
        type: 'station',
        name: station.name,
        sectorId: station.sectorId ?? undefined,
        stationType: station.type,
        ...resolveTabSemantics(store, station, station.id)
      }))
    }

    const result: ProductionTabItem[] = [
      { id: 'overview', type: 'overview', name: i18n.global.t('sector.overview') }
    ]

    const grouped = new Map<string, ProductionTabItem[]>()
    const stations = store.orderedStationsBySector || []
    stations.forEach((station) => {
      const sectorId = station.sectorId || ''
      const item: ProductionTabItem = {
        id: station.id,
        type: 'station',
        name: station.name,
        sectorId: station.sectorId ?? undefined,
        stationType: station.type,
        ...resolveTabSemantics(store, station, station.id)
      }
      if (!sectorId) {
        result.push(item)
        return
      }
      const arr = grouped.get(sectorId) || []
      arr.push(item)
      grouped.set(sectorId, arr)
    })

    ;(store.sectors || []).forEach((sector) => {
      result.push({
        id: `transit:${sector.id}`,
        type: 'transit',
        name: sector.name,
        sectorId: sector.id
      })
      if (store.expandedSectorId === sector.id) {
        result.push(...(grouped.get(sector.id) || []))
      }
    })

    return result
  })

  const props: TabbarPresenterProps = {
    tabs,
    activeTabId: computed(() => {
      if (store.session.workbenchMode === 'transit' && store.session.activeTransitSectorId) {
        return `transit:${store.session.activeTransitSectorId}`
      }
      if (store.session.workbenchMode === 'overview') return 'overview'
      return store.session.activeStationId
    }),
    expandedSectorId: computed(() => store.expandedSectorId ?? null),
    canCreateStation: !store.capabilities.uniqueStation,
    canOpenContextMenu: !store.capabilities.uniqueStation
  }

  const emits: TabbarPresenterEmits = {
    selectOverview: () => store.selectStation(null),
    selectTransit: (sectorId: string) => (store.selectTransitSector || (() => {}))(sectorId),
    selectStation: (stationId: string) => store.selectStation(stationId),
    createStation: () => store.createStation(),
    renameStation: (stationId: string) => store.renameStation(stationId, ''),
    duplicateStation: (stationId: string) => store.duplicateStation(stationId),
    deleteStation: (stationId: string) => store.deleteStation(stationId),
    expandSector: (sectorId: string | null) => (store.setExpandedSector || (() => {}))(sectorId)
  }

  return { props, emits }
}
